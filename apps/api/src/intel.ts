// Automatic triage: every finished session gets a verdict without anyone clicking.
// Trivial sessions are classified by local rules (free); sessions where the attacker
// actually did something go to the analyst agent. Sessions with identical behavior
// share a fingerprint, so a botnet replaying one script from 500 IPs costs one call.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  buildSessions,
  sourceIp,
  type AnalyticsSession,
  type BriefInput,
  type HoneypotEvent,
  type IntelPatch,
  type IntelSnapshot,
  type SessionAnalysis,
  type SessionDigest,
  type SessionIntel,
  type ThreatBrief,
} from "@honeyrizons/shared";
import { ANALYST_MODEL, analystEnabled, analyzeSession, writeBrief } from "./analyst";

const TICK_MS = 10_000;
/** A session is analyzed once it has been quiet this long. */
const SETTLE_MS = 90_000;
const CONCURRENCY = 2;
const BUDGET_PER_HOUR = Number(process.env.OPENAI_MAX_ANALYSES_PER_HOUR ?? 40);
const BRIEF_EVERY_MS = 30 * 60_000;
const DAY_MS = 24 * 3_600_000;
const SEVERITY_RANK = { critical: 3, high: 2, medium: 1, low: 0 } as const;

type Options = {
  events: () => HoneypotEvent[];
  publish: (patch: IntelPatch) => void;
  storePath: string;
};

/** `calls` holds LLM call timestamps so the hourly budget survives restarts. */
type Store = { version?: number; analyses: Record<string, SessionAnalysis>; brief: ThreatBrief | null; calls?: number[] };

const STORE_VERSION = 2;

export function startIntel({ events, publish, storePath }: Options) {
  const loaded: Store | null = existsSync(storePath) ? JSON.parse(readFileSync(storePath, "utf8")) : null;
  // Bumping STORE_VERSION (e.g. when the output format changes) drops old analyses so they are rewritten.
  const store: Store = loaded?.version === STORE_VERSION ? loaded : { version: STORE_VERSION, analyses: {}, brief: null, calls: [] };
  let sessions: Record<string, SessionIntel> = {};
  const failed = new Set<string>();
  const inFlight = new Set<string>();
  const calls: number[] = (store.calls ??= []);
  let briefInFlight = false;
  let analysesSinceBrief = 0;

  // A failed write only loses persistence across restarts; it must not take the API down.
  const save = () => {
    try {
      writeFileSync(storePath, JSON.stringify(store));
    } catch (err) {
      console.error(`[intel] could not save ${storePath}:`, err);
    }
  };
  const budgetUsed = () => {
    const hourAgo = Date.now() - 3_600_000;
    while (calls.length && calls[0] < hourAgo) calls.shift();
    return calls.length;
  };

  const stats = () => {
    const values = Object.values(sessions);
    return {
      enabled: analystEnabled(),
      model: ANALYST_MODEL,
      analyzed: values.filter((s) => s.state === "analyzed").length,
      triaged: values.filter((s) => s.state === "triaged").length,
      queued: values.filter((s) => s.state === "queued").length,
      budgetUsed: budgetUsed(),
      budgetPerHour: BUDGET_PER_HOUR,
    };
  };

  function snapshot(): IntelSnapshot {
    return { sessions, analyses: store.analyses, brief: store.brief, stats: stats() };
  }

  function tick() {
    const now = Date.now();
    const all = buildSessions(events(), now);
    const byFingerprint = new Map<string, AnalyticsSession[]>();
    for (const s of all) {
      const fp = fingerprint(s);
      byFingerprint.set(fp, [...(byFingerprint.get(fp) ?? []), s]);
    }

    const next: Record<string, SessionIntel> = {};
    const newAnalyses: Record<string, SessionAnalysis> = {};
    const queue: { fp: string; session: AnalyticsSession; priority: number }[] = [];

    for (const [fp, group] of byFingerprint) {
      const campaign = { sessions: group.length, ips: new Set(group.map((s) => s.ip).filter(Boolean)).size };
      const rule = triageByRules(group[0]);
      if (rule && !store.analyses[fp]) {
        store.analyses[fp] = rule;
        newAnalyses[fp] = rule;
      }
      for (const s of group) {
        const settled = s.status.kind !== "open" && now - s.end > SETTLE_MS;
        const state: SessionIntel["state"] = store.analyses[fp]
          ? store.analyses[fp].model === "rules"
            ? "triaged"
            : "analyzed"
          : failed.has(fp)
            ? "failed"
            : settled
              ? "queued"
              : "live";
        next[s.key] = { fingerprint: fp, state, campaign };
      }
      const richest = group.reduce((a, b) => (b.interactions.length > a.interactions.length ? b : a));
      if (!store.analyses[fp] && !failed.has(fp) && !inFlight.has(fp) && group.some((s) => next[s.key].state === "queued")) {
        queue.push({ fp, session: richest, priority: signal(richest) + (now - richest.end < DAY_MS ? 5 : 0) });
      }
    }

    // Publish only what changed since the last tick.
    const changed: Record<string, SessionIntel> = {};
    for (const [key, value] of Object.entries(next)) {
      const prev = sessions[key];
      if (!prev || prev.state !== value.state || prev.fingerprint !== value.fingerprint || prev.campaign.sessions !== value.campaign.sessions) {
        changed[key] = value;
      }
    }
    sessions = next;
    if (Object.keys(newAnalyses).length) save();
    if (Object.keys(changed).length || Object.keys(newAnalyses).length) {
      publish({ sessions: changed, analyses: newAnalyses, stats: stats() });
    }

    if (analystEnabled()) {
      queue.sort((a, b) => b.priority - a.priority);
      for (const job of queue) {
        if (inFlight.size >= CONCURRENCY || budgetUsed() >= BUDGET_PER_HOUR) break;
        void analyze(job.fp, job.session);
      }
      maybeBrief(all, now);
    }
  }

  async function analyze(fp: string, session: AnalyticsSession) {
    inFlight.add(fp);
    calls.push(Date.now());
    try {
      const analysis = await analyzeSession(toDigest(session));
      store.analyses[fp] = analysis;
      analysesSinceBrief++;
      save();
      const updated: Record<string, SessionIntel> = {};
      for (const [key, intel] of Object.entries(sessions)) {
        if (intel.fingerprint === fp) updated[key] = sessions[key] = { ...intel, state: "analyzed" };
      }
      publish({ sessions: updated, analyses: { [fp]: analysis }, stats: stats() });
    } catch (error) {
      console.error("[intel] analysis failed:", (error as Error).message);
      failed.add(fp);
      // Give failed fingerprints another chance later instead of hammering the API.
      setTimeout(() => failed.delete(fp), 15 * 60_000);
    } finally {
      inFlight.delete(fp);
    }
  }

  function maybeBrief(all: AnalyticsSession[], now: number) {
    if (briefInFlight) return;
    const age = store.brief ? now - Date.parse(store.brief.generatedAt) : Infinity;
    const verdicts = Object.values(store.analyses).filter((a) => a.model !== "rules").length;
    const queued = Object.values(sessions).some((s) => s.state === "queued");
    // Wait for enough of the analyst's own verdicts before writing the first brief.
    const hasAnalyses = verdicts >= 5 || (verdicts > 0 && !queued);
    if (!hasAnalyses || (age < BRIEF_EVERY_MS && store.brief) || (store.brief && analysesSinceBrief === 0 && age < 6 * BRIEF_EVERY_MS)) return;
    briefInFlight = true;
    writeBrief(briefInput(events(), all, sessions, store.analyses, now))
      .then((brief) => {
        store.brief = brief;
        analysesSinceBrief = 0;
        save();
        publish({ brief, stats: stats() });
      })
      .catch((error) => console.error("[intel] brief failed:", (error as Error).message))
      .finally(() => {
        briefInFlight = false;
      });
  }

  setTimeout(tick, 2_000);
  setInterval(tick, TICK_MS);
  return { snapshot };
}

/** Behavior signature: what the attacker did, not who they are or when. */
function fingerprint(s: AnalyticsSession) {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, "<ip>")
      .replace(/\d+/g, "<n>")
      .replace(/\s+/g, " ")
      .trim();
  const actions = [...new Set(s.interactions.map((i) => normalize(i.input)))].sort();
  const shape = actions.length ? actions.join("\n") : s.creds.length ? "credential-guessing" : "connect-only";
  return new Bun.CryptoHasher("sha1").update(`${s.protocol}|${s.service}|${shape}`).digest("hex").slice(0, 16);
}

function signal(s: AnalyticsSession) {
  return (s.protocol === "MCP" ? 20 : 0) + Math.min(s.interactions.length, 20) * 2 + Math.min(s.creds.length, 5);
}

/** Sessions with nothing to read get a deterministic verdict instead of an LLM call. */
function triageByRules(s: AnalyticsSession): SessionAnalysis | null {
  if (s.interactions.length > 0) return null;
  const service = s.service || s.protocol;
  if (s.creds.length > 0) {
    const mirai = s.protocol === "TELNET";
    return {
      verdict: `Password guessing against ${service}, no commands after login.`,
      category: mirai ? "botnet" : "brute-force",
      severity: "low",
      attacker: mirai ? "botnet" : "automated-scanner",
      summary: `The client tried ${s.creds.length} credential pair${s.creds.length > 1 ? "s" : ""} and left without running anything. This is opportunistic, automated credential guessing.`,
      techniques: [{ id: "T1110.001", name: "Password Guessing", evidence: `${s.creds.length} login attempts on ${service}` }],
      iocs: [...new Set(s.creds.map((c) => `${c.user}:${c.password}`))].slice(0, 5).map((value) => ({ type: "credential" as const, value })),
      recommendation: `Disable password authentication on ${s.protocol} and rate-limit repeated login failures.`,
      model: "rules",
    };
  }
  return {
    verdict: `Connection to ${service} without any interaction.`,
    category: "reconnaissance",
    severity: "low",
    attacker: "automated-scanner",
    summary: "The client opened a connection and left without sending credentials or commands, typical of port scanning and banner grabbing.",
    techniques: [{ id: "T1595", name: "Active Scanning", evidence: `bare connection to ${service}` }],
    iocs: [],
    recommendation: "No action needed beyond perimeter scan detection.",
    model: "rules",
  };
}

function toDigest(s: AnalyticsSession): SessionDigest {
  return {
    protocol: s.protocol,
    service: s.service,
    client: s.client,
    start: new Date(s.start).toISOString(),
    end: new Date(s.end).toISOString(),
    status: s.status.label,
    creds: s.creds,
    interactions: s.interactions.map(({ input, output }) => ({ input, output })),
  };
}

function top(values: string[], n: number) {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

function briefInput(
  allEvents: HoneypotEvent[],
  all: AnalyticsSession[],
  intel: Record<string, SessionIntel>,
  analyses: Record<string, SessionAnalysis>,
  now: number,
): BriefInput {
  const from = now - DAY_MS;
  const events = allEvents.filter((e) => Date.parse(e.DateTime) >= from);
  const sessions = all.filter((s) => s.end >= from);
  const protocols: Record<string, number> = {};
  for (const e of events) protocols[e.Protocol] = (protocols[e.Protocol] ?? 0) + 1;
  // The analyst's own verdicts, most severe first, one per campaign.
  const seen = new Set<string>();
  const notable: string[] = [];
  for (const s of [...sessions].sort((a, b) => rank(analyses, intel, b) - rank(analyses, intel, a))) {
    const fp = intel[s.key]?.fingerprint;
    const analysis = fp ? analyses[fp] : undefined;
    if (!fp || !analysis || seen.has(fp)) continue;
    seen.add(fp);
    notable.push(`[${analysis.severity}] ${analysis.verdict} (${intel[s.key].campaign.ips} IPs)`);
    if (notable.length === 10) break;
  }
  return {
    range: "last 24 hours",
    totals: {
      events: events.length,
      attackers: new Set(events.map(sourceIp).filter(Boolean)).size,
      sessions: sessions.length,
      credentials: events.filter((e) => e.Password).length,
    },
    protocols,
    topCountries: top(
      events.map((e) => e.Geo?.country ?? ""),
      8,
    ).map(({ value, count }) => ({ country: value, events: count })),
    topCredentials: top(
      sessions.flatMap((s) => s.creds.map((c) => `${c.user}:${c.password}`)),
      10,
    ),
    topCommands: top(
      sessions.flatMap((s) => s.interactions.map((i) => i.input)),
      12,
    ),
    notableSessions: notable,
  };
}

function rank(analyses: Record<string, SessionAnalysis>, intel: Record<string, SessionIntel>, s: AnalyticsSession) {
  const fp = intel[s.key]?.fingerprint;
  const analysis = fp ? analyses[fp] : undefined;
  return analysis ? SEVERITY_RANK[analysis.severity] * 10 + (analysis.model === "rules" ? 0 : 1) : -1;
}
