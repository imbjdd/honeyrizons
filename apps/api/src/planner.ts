// The city planner: grows the honeypot's attack surface toward what attackers are actually looking for.
//
// It reads the same facts as the chronicle (sessions and the analyst's verdicts) and looks for demand the honeypot does
// not serve yet: miners trying `docker` in the fake shell, scanners asking for /.env, AI agents probing for LLM APIs.
// When a lure's demand is strong enough it plans it (`lure.planned`); when an open lure stops catching anything it
// retires it (`lure.retired`). Both are chronicle events, so the city's growth replays like the rest of its history.
//
// Deciding and doing are separate. `plan` is pure and only writes the chronicle. `reconcileAnnex` makes the honeypot's
// annex directory match the lures that should stand, and the honeypot's supervisor picks that up (see
// apps/honeypot/scripts/supervise.sh). A lure only counts as open once the honeypot reports serving it.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  LURES,
  lureServiceKey,
  type AnalyticsSession,
  type ChronicleState,
  type LureBlueprint,
  type LureCase,
  type SessionAnalysis,
  type Severity,
} from "@honeyrizons/shared";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const PLANNER = {
  /** Demand a lure needs before it is built. One IP counts once per lure, with the strongest signal it fired. */
  planAt: 10,
  /** Only traffic this recent counts as demand. */
  window: 7 * DAY_MS,
  /** Lures standing (planned or open) at once. */
  capacity: Number(process.env.PLANNER_MAX_LURES ?? 4),
  /** The city grows one building at a time. */
  gap: 20 * 60_000,
  /** An open lure that caught nothing for this long is closed... */
  idle: 3 * DAY_MS,
  /** ...and a closed one needs fresh demand, gathered after it closed, and this long to pass before it reopens. */
  cooldown: DAY_MS,
  /** A planned lure the honeypot never came to serve is given up on, so it does not hold a slot forever. */
  stalled: 30 * 60_000,
};

type Signal = {
  label: string;
  /** 1: circumstantial · 2: suggestive · 3: clear interest · 4: asking for exactly this service. */
  weight: number;
  test: (s: AnalyticsSession, text: string, analysis: SessionAnalysis | undefined) => boolean;
};

const httpPath = (s: AnalyticsSession, re: RegExp) => s.protocol === "HTTP" && s.interactions.some((i) => re.test(i.input));
const technique = (a: SessionAnalysis | undefined, ...ids: string[]) =>
  !!a?.techniques.some((t) => ids.some((id) => t.id === id || t.id.startsWith(`${id}.`)));

/** What, in traffic the honeypot already gets, says a lure would catch something. */
const SIGNALS: Record<string, Signal[]> = {
  "llm-gateway": [
    { label: "LLM inference API probes", weight: 4, test: (s) => httpPath(s, /\/(api\/(tags|generate|chat|pull|show|ps)|v1\/(models|chat\/completions|completions|embeddings))\b/) },
    { label: "LLM API key hunting", weight: 3, test: (_, t) => /\b(openai|anthropic|ollama|huggingface)\b|\bsk-[a-z0-9-]{8,}|(openai|anthropic)_api_key/.test(t) },
    { label: "AI agents abusing tools", weight: 3, test: (_, __, a) => a?.category === "ai-agent-abuse" },
    { label: "AI agents on the MCP bait", weight: 2, test: (s) => s.protocol === "MCP" },
  ],
  "docker-api": [
    { label: "Docker API probes", weight: 4, test: (s) => httpPath(s, /\/(v1\.\d+\/)?(containers|images)\/(json|create)|\/_ping\b/) },
    { label: "Cryptominer drops", weight: 4, test: (_, t) => /xmrig|minerd|kinsing|kdevtmpfsi|stratum\+tcp|c3pool|nicehash|supportxmr|cryptonight/.test(t) },
    { label: "Docker in the shell", weight: 3, test: (s, t) => s.protocol !== "HTTP" && /\bdocker\b|docker\.sock|containerd|\bctr\b/.test(t) },
    { label: "Cryptomining", weight: 3, test: (_, __, a) => a?.category === "cryptomining" },
    { label: "Resource hijacking", weight: 2, test: (_, __, a) => technique(a, "T1496", "T1610") },
  ],
  "staging-site": [
    { label: ".env and .git scans", weight: 4, test: (s) => httpPath(s, /\/\.(env|git)\b/) },
    { label: "Config backup scans", weight: 3, test: (s) => httpPath(s, /\/\.aws\/|wp-config\.php[.~]|\/config\.(json|ya?ml|php)\b|phpinfo|\/backup|\.sql\b|\/actuator\b/) },
    { label: "Secrets read from files", weight: 3, test: (s, t) => s.protocol !== "HTTP" && /\.env\b|\.aws\/credentials|\.git-credentials|id_rsa\b/.test(t) },
    { label: "Credentials in files", weight: 2, test: (_, __, a) => technique(a, "T1552.001") },
  ],
  postgres: [
    { label: "Logins as postgres", weight: 4, test: (s) => s.creds.some((c) => /^(postgres|pgsql|pgadmin)$/i.test(c.user)) },
    { label: "PostgreSQL in the shell", weight: 3, test: (_, t) => /\bpsql\b|pg_dump|postgres(ql)?:\/\/|\bpg_hba/.test(t) },
    { label: "Database dumps", weight: 2, test: (_, t, a) => /\bmysqldump\b|\bselect\b.+\bfrom\b/.test(t) || technique(a, "T1213") },
    { label: "Probes of other databases", weight: 1, test: (s) => s.protocol === "TCP" && /mysql|redis/i.test(s.service) && s.interactions.length > 0 },
  ],
  "kube-api": [
    { label: "Kubernetes recon", weight: 4, test: (_, t) => /kubectl|\.kube\/config|\/api\/v1\/|\/apis\/|kubelet|serviceaccount\/token/.test(t) },
    { label: "Cloud metadata queries", weight: 3, test: (_, t) => /169\.254\.169\.254|metadata\.google\.internal|\/latest\/meta-data|\baws (sts|s3|iam|configure)\b/.test(t) },
    { label: "Cloud credential theft", weight: 3, test: (_, __, a) => technique(a, "T1552.005", "T1530", "T1613") },
    { label: "Agents asked for cloud keys", weight: 2, test: (s) => s.protocol === "MCP" && s.interactions.some((i) => i.input.startsWith("get_cloud_credentials")) },
  ],
  "iot-broker": [
    { label: "Mirai-style payloads", weight: 4, test: (_, t) => /busybox|\btftp\b|\.(arm[4-7]?|mips|mpsl|m68k|ppc|sh4)\b|\bmozi\b|gafgyt|mirai/.test(t) },
    { label: "Default IoT passwords", weight: 2, test: (s) => s.creds.some((c) => /^(xc3511|vizxv|xmhdipc|juantech|hi3518|anko|7ujMko0admin|888888|666666|klv123|zlxx\.)$/i.test(c.password)) },
    { label: "Telnet botnets", weight: 1, test: (s, _, a) => s.protocol === "TELNET" && a?.category === "botnet" },
  ],
};

const SEVERITY_BONUS: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export type Demand = LureCase & { lure: LureBlueprint };

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * How much the traffic since `since` asks for each lure. Each address counts once per lure, with its strongest signal
 * (plus a bonus for a severe analyst verdict), so one noisy scanner cannot build a lure on its own.
 */
export function measureDemand(
  sessions: AnalyticsSession[],
  analysisOf: (s: AnalyticsSession) => SessionAnalysis | undefined,
  since: (lure: string) => number,
): Demand[] {
  const out: Demand[] = [];
  for (const lure of LURES) {
    const signals = SIGNALS[lure.id] ?? [];
    const from = since(lure.id);
    const byIp = new Map<string, number>();
    const fired = new Map<string, number>();
    const samples: string[] = [];
    let count = 0;
    for (const s of sessions) {
      if (s.end < from) continue;
      // A lure's own traffic is supply, not demand.
      if (LURES.some((l) => lureServiceKey(l) === `${s.protocol}|${s.service}`)) continue;
      const analysis = analysisOf(s);
      const text = [...s.interactions.map((i) => i.input), s.client].join("\n").toLowerCase();
      const hits = signals.filter((sig) => sig.test(s, text, analysis));
      if (hits.length === 0) continue;
      count++;
      const strongest = Math.max(...hits.map((h) => h.weight)) + SEVERITY_BONUS[analysis?.severity ?? "low"];
      const ip = s.ip || s.key;
      byIp.set(ip, Math.max(byIp.get(ip) ?? 0, strongest));
      for (const h of hits) fired.set(h.label, (fired.get(h.label) ?? 0) + h.weight);
      // Show the input that fired a signal, not whatever the session happened to start with.
      // Prefer an input that fires on its own content over one that only fires through the analyst's verdict.
      const fires = (i: (typeof s.interactions)[number], verdict: SessionAnalysis | undefined) =>
        hits.some((h) => h.test({ ...s, interactions: [i] }, i.input.toLowerCase(), verdict));
      const firing = s.interactions.find((i) => fires(i, undefined)) ?? s.interactions.find((i) => fires(i, analysis));
      const cred =
        s.creds.find((c) => hits.some((h) => h.test({ ...s, interactions: [], creds: [c] }, "", analysis))) ?? s.creds[0];
      const sample = firing?.input ?? (cred ? `login ${cred.user}:${cred.password}` : "");
      if (sample && samples.length < 3 && !samples.includes(clip(sample, 90))) samples.push(clip(sample, 90));
    }
    if (count === 0) continue;
    const ranked = [...fired.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
    const score = [...byIp.values()].reduce((a, b) => a + b, 0);
    out.push({
      lure,
      score,
      ips: byIp.size,
      sessions: count,
      signals: ranked,
      samples,
      reason: `${ranked[0]} from ${byIp.size} address${byIp.size > 1 ? "es" : ""}`,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

export type PlannerDraft =
  | ({ type: "lure.planned"; lure: string; key: string; name: string } & LureCase)
  | { type: "lure.retired"; lure: string; key: string; name: string; reason: string; manual?: boolean };

/**
 * One planning step: closes what stopped working, then builds at most one new lure. Pure: the chronicle state and the
 * traffic are the whole input, so a decision can always be explained from the log.
 */
/**
 * auto: the planner builds lures itself. propose: it only suggests them, and an operator applies them (demo, or a
 * cautious deployment); idle lures are still closed. off: no planner at all.
 */
export type PlannerMode = "auto" | "propose" | "off";

export type PlannerFacts = {
  now: number;
  sessions: AnalyticsSession[];
  analysisOf: (s: AnalyticsSession) => SessionAnalysis | undefined;
};

/** Lures with enough demand that the planner would build them now, strongest first. */
/**
 * Where a lure's demand starts counting. A lure the planner closed needs demand that came after it closed: the reason it
 * was opened has already been answered. One an operator closed did not fail, so its demand still stands.
 */
export function demandSince(state: ChronicleState, id: string, now: number) {
  const known = state.lures[id];
  const window = now - PLANNER.window;
  return known?.retiredAt && !known.closedManually ? Math.max(window, known.retiredAt) : window;
}

export function suggestions(state: ChronicleState, { now, sessions, analysisOf }: PlannerFacts): Demand[] {
  const demand = measureDemand(sessions, analysisOf, (id) => demandSince(state, id, now));
  return demand.filter(({ lure, score }) => {
    const known = state.lures[lure.id];
    if (score < PLANNER.planAt) return false;
    if (!known) return true;
    if (known.status !== "retired") return false;
    return known.closedManually || now - (known.retiredAt ?? 0) >= PLANNER.cooldown;
  });
}

const standingLures = (state: ChronicleState) => Object.values(state.lures).filter((l) => l.status !== "retired");

const planned = ({ lure, ...why }: Demand): PlannerDraft => ({ type: "lure.planned", lure: lure.id, key: lureServiceKey(lure), name: lure.name, ...why });

/**
 * An operator applying a suggestion. It is held to the same rules as the planner itself (enough demand, cooldown,
 * capacity), only not to the pace: applying is the operator deciding when.
 */
export function approve(state: ChronicleState, facts: PlannerFacts, lureId: string): PlannerDraft | { error: string } {
  if (standingLures(state).length >= PLANNER.capacity) return { error: `The city already holds ${PLANNER.capacity} lures` };
  const suggestion = suggestions(state, facts).find((d) => d.lure.id === lureId);
  return suggestion ? planned(suggestion) : { error: "Not a current suggestion" };
}

/** An operator closing a lure, planned or open. */
export function close(state: ChronicleState, lureId: string): PlannerDraft | { error: string } {
  const l = state.lures[lureId];
  if (!l || l.status === "retired") return { error: "That lure is not standing" };
  return { type: "lure.retired", lure: l.lure, key: l.key, name: l.name, reason: "Closed by the operator", manual: true };
}

export function plan(state: ChronicleState, facts: PlannerFacts, mode: PlannerMode = "auto"): PlannerDraft[] {
  const { now, sessions } = facts;
  const out: PlannerDraft[] = [];
  const lures = Object.values(state.lures);

  const lastHit = new Map<string, number>();
  for (const s of sessions) {
    const key = `${s.protocol}|${s.service}`;
    lastHit.set(key, Math.max(lastHit.get(key) ?? 0, s.end));
  }

  for (const l of lures) {
    if (l.status === "planned" && now - l.plannedAt > PLANNER.stalled) {
      out.push({ type: "lure.retired", lure: l.lure, key: l.key, name: l.name, reason: "The honeypot never came to serve it" });
    }
    if (l.status === "open" && l.openedAt !== undefined) {
      const quietSince = Math.max(l.openedAt, lastHit.get(l.key) ?? 0);
      if (now - quietSince > PLANNER.idle) {
        const caught = state.services[l.key]?.discoveredAt !== undefined;
        out.push({
          type: "lure.retired",
          lure: l.lure,
          key: l.key,
          name: l.name,
          reason: caught ? `Nothing new for ${Math.round(PLANNER.idle / DAY_MS)} days` : `Caught nothing in ${Math.round(PLANNER.idle / DAY_MS)} days`,
        });
      }
    }
  }

  if (mode !== "auto") return out;
  const retiring = new Set(out.map((d) => d.lure));
  const standing = standingLures(state).filter((l) => !retiring.has(l.lure));
  const lastPlanned = Math.max(0, ...lures.map((l) => l.plannedAt));
  if (standing.length >= PLANNER.capacity || now - lastPlanned < PLANNER.gap) return out;

  const next = suggestions(state, facts).find(({ lure }) => !retiring.has(lure.id));
  if (next) out.push(planned(next));
  return out;
}

/** Lures that should be served right now. */
export const wantedLures = (state: ChronicleState) =>
  Object.values(state.lures)
    .filter((l) => l.status !== "retired")
    .map((l) => l.lure);

/**
 * Makes the annex directory hold exactly the wanted lures' configs. Files are only written when their content changes,
 * since every change restarts the annex. Returns whether anything changed.
 */
export function reconcileAnnex(wanted: string[], { blueprints, annex }: { blueprints: string; annex: string }): boolean {
  if (!existsSync(annex)) mkdirSync(annex, { recursive: true });
  let changed = false;
  for (const id of wanted) {
    const source = join(blueprints, `${id}.yaml`);
    if (!existsSync(source)) continue;
    const target = join(annex, `${id}.yaml`);
    const content = readFileSync(source, "utf8");
    if (existsSync(target) && readFileSync(target, "utf8") === content) continue;
    writeFileSync(target, content);
    changed = true;
  }
  for (const file of readdirSync(annex)) {
    if (/\.ya?ml$/.test(file) && !wanted.includes(file.replace(/\.ya?ml$/, ""))) {
      rmSync(join(annex, file));
      changed = true;
    }
  }
  return changed;
}
