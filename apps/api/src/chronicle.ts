// Derives the city's chronicle from what the honeypot already knows. Nothing here reaches outside: it reads the
// sessions and the analyst's verdicts, compares them with the chronicle so far, and appends only what is new.
//
// Every event is a fact about traffic that already happened. The city's shape at any instant is the fold of them.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { approve, close, plan, reconcileAnnex, suggestions, wantedLures, type PlannerFacts, type PlannerMode } from "./planner";
import {
  buildSessions,
  foldChronicle,
  serviceKey,
  SEVERITY_RANK,
  type ChronicleEvent,
  type ChronicleState,
  type HoneypotEvent,
  type HoneypotService,
  type IntelSnapshot,
  type ServiceStatus,
  type Severity,
} from "@honeyrizons/shared";

const TICK_MS = 15_000;
const HOUR_MS = 3_600_000;
/** Sessions per hour that count as a surge, and the lower bound it has to fall back under to end. */
const SURGE_ON = 10;
const SURGE_OFF = 6;
/** No session for this long and a service is called quiet. */
const IDLE_MS = 30 * 60_000;
/** Campaign sizes worth a line in the chronicle. */
const SPREAD_TIERS = [5, 25, 100, 500];
const MILESTONES: [number, string][] = [
  [100, "A hundred sessions"],
  [500, "Five hundred sessions"],
  [1_000, "A thousand sessions"],
  [5_000, "Five thousand sessions"],
  [10_000, "Ten thousand sessions"],
];
const STORE_VERSION = 1;
/** Events older than this are dropped on save; the chronicle is a recent history, not an archive. */
const KEEP_MS = 30 * 24 * HOUR_MS;

type Store = { version: number; events: ChronicleEvent[] };

type Options = {
  events: () => HoneypotEvent[];
  services: () => HoneypotService[];
  intel: () => IntelSnapshot;
  publish: (events: ChronicleEvent[]) => void;
  storePath: string;
  /** The city planner, off when absent: where lure configs come from and where the honeypot's annex reads them. */
  planner?: { mode: Exclude<PlannerMode, "off">; blueprints: string; annex: string };
};

export function startChronicle({ events, services, intel, publish, storePath, planner }: Options) {
  const loaded: Store | null = existsSync(storePath) ? JSON.parse(readFileSync(storePath, "utf8")) : null;
  const store: Store = loaded?.version === STORE_VERSION ? loaded : { version: STORE_VERSION, events: [] };
  let seq = store.events.length;

  // A failed write only loses history across restarts; it must not take the API down.
  const save = () => {
    try {
      const cutoff = Date.now() - KEEP_MS;
      // The genesis line is the chronicle's anchor, so it is never trimmed.
      store.events = store.events.filter((e) => e.type === "genesis" || e.at >= cutoff);
      writeFileSync(storePath, JSON.stringify(store));
    } catch (err) {
      console.error(`[chronicle] could not save ${storePath}:`, err);
    }
  };

  const facts = () => {
    const now = Date.now();
    return { now, sessions: buildSessions(events(), now), services: services(), intel: intel() };
  };

  function tick() {
    const current = facts();
    const fresh = derive(foldChronicle(store.events), current, () => `e${++seq}`);
    // The planner decides on the city as it stands after this tick's facts, so a lure that just opened counts as open.
    if (planner) fresh.push(...planLures(foldChronicle([...store.events, ...fresh]), current, () => `e${++seq}`, planner.mode));
    commit(fresh);
  }

  function commit(fresh: ChronicleEvent[]) {
    if (fresh.length) {
      store.events.push(...fresh);
      save();
      publish(fresh);
    }
    if (planner) {
      try {
        if (reconcileAnnex(wantedLures(foldChronicle(store.events)), planner)) console.log("[planner] annex updated");
      } catch (err) {
        console.error("[planner] could not update the annex:", err);
      }
    }
  }

  setTimeout(tick, 4_000);
  setInterval(tick, TICK_MS);
  return {
    snapshot: () => ({ events: store.events, since: store.events[0]?.at ?? Date.now() }),
    /** What the planner would build now, with the traffic that asks for it. */
    suggestions: () => suggestions(foldChronicle(store.events), plannerFacts(facts())),
    /** An operator applies a suggestion: it is planned, and the annex is updated right away. */
    apply(lure: string): { ok: true } | { error: string } {
      if (!planner) return { error: "The city planner is off" };
      const current = facts();
      const draft = approve(foldChronicle(store.events), plannerFacts(current), lure);
      if ("error" in draft) return draft;
      commit([{ id: `e${++seq}`, at: current.now, ...draft } as ChronicleEvent]);
      return { ok: true };
    },
    /** An operator closes a lure: it is retired, and the annex drops it right away. */
    close(lure: string): { ok: true } | { error: string } {
      if (!planner) return { error: "The city planner is off" };
      const draft = close(foldChronicle(store.events), lure);
      if ("error" in draft) return draft;
      commit([{ id: `e${++seq}`, at: Date.now(), ...draft } as ChronicleEvent]);
      return { ok: true };
    },
  };
}

type Facts = {
  now: number;
  sessions: ReturnType<typeof buildSessions>;
  services: HoneypotService[];
  intel: IntelSnapshot;
};

/** One chronicle event minus the fields `derive` fills in. Distributive, so each variant keeps its own shape. */
type Draft = ChronicleEvent extends infer T ? (T extends ChronicleEvent ? Omit<T, "id" | "at"> & { at?: number } : never) : never;

/**
 * Compares the world as it is with the chronicle so far and returns the lines that are missing. Pure, so the rules
 * below are the whole story: there is no hidden state between ticks.
 */
export function derive(state: ChronicleState, { now, sessions, services, intel }: Facts, nextId: () => string): ChronicleEvent[] {
  const out: ChronicleEvent[] = [];
  const add = ({ at, ...rest }: Draft) => out.push({ id: nextId(), at: at ?? now, ...rest } as ChronicleEvent);
  /** Backdated events are clamped: nothing can happen to a service before it was exposed. */
  let foundedAt = Math.min(...Object.values(state.services).map((s) => s.exposedAt), now);
  const since = (key: string | null, at: number) =>
    Math.max(at, ((key ? state.services[key]?.exposedAt : undefined) ?? foundedAt) + 1);

  const exposed = services.map((s) => ({
    key: serviceKey(s.protocol, s.description),
    name: s.description || s.protocol,
    protocol: s.protocol,
    address: s.address,
  }));

  // The chronicle starts the first time we see the honeypot's services.
  if (Object.keys(state.services).length === 0) {
    if (exposed.length === 0) return out;
    // Backdate to the oldest session so existing traffic sits after the founding, not before it.
    const oldest = sessions.reduce((min, s) => Math.min(min, s.start), now);
    foundedAt = Math.min(oldest - 1000, now);
    add({ type: "genesis", services: exposed, at: foundedAt });
  } else {
    for (const s of exposed) {
      if (state.services[s.key] && !state.services[s.key].withdrawnAt) continue;
      // A service the planner asked for is a lure; the fold opens the lure when it lands.
      const lure = Object.values(state.lures).find((l) => l.key === s.key && l.status === "planned")?.lure;
      add({ type: "service.exposed", ...s, ...(lure ? { lure } : {}) });
    }
    for (const s of Object.values(state.services)) {
      if (!s.withdrawnAt && !exposed.some((e) => e.key === s.key)) add({ type: "service.withdrawn", key: s.key, name: s.name });
    }
  }

  // Per-service traffic, all time and over the last hour.
  type Stat = { sessions: number; lastEnd: number; firstEnd: number; recent: number; first?: { key: string; title: string } };
  const stats = new Map<string, Stat>();
  for (const s of sessions) {
    const key = serviceKey(s.protocol, s.service);
    // Nothing listens on a lure before it is planned, so earlier traffic on it belongs to a previous opening. (Not
    // before it is exposed: the honeypot serves it a few seconds before the next tick notices.)
    const lure = state.services[key]?.lure;
    const plannedAt = lure ? state.lures[lure]?.plannedAt : undefined;
    if (plannedAt !== undefined && s.end < plannedAt) continue;
    const stat = stats.get(key) ?? { sessions: 0, lastEnd: 0, firstEnd: s.end, recent: 0 };
    stat.sessions++;
    stat.lastEnd = Math.max(stat.lastEnd, s.end);
    stat.firstEnd = Math.min(stat.firstEnd, s.end);
    if (s.end >= now - HOUR_MS) stat.recent++;
    // Sessions come newest first, so the last one seen is the oldest.
    stat.first = { key: s.key, title: describeSession(s) };
    stats.set(key, stat);
  }

  for (const key of new Set([...Object.keys(state.services), ...exposed.map((e) => e.key)])) {
    const service = state.services[key];
    const name = service?.name ?? exposed.find((e) => e.key === key)?.name ?? key;
    if (service?.withdrawnAt) continue;
    const stat = stats.get(key);
    if (!stat) continue;

    if (!service) continue;
    const justDiscovered = !service.discoveredAt;
    if (justDiscovered) {
      add({ type: "service.discovered", key, name, sessionKey: stat.first!.key, summary: stat.first!.title, at: since(key, stat.firstEnd) });
    }

    // Discovery already puts a service at "active", so a surge found on the same tick is reported right away.
    const baseline = justDiscovered ? "active" : service.status;
    const status = nextStatus(baseline, stat.recent, now - stat.lastEnd);
    if (status !== baseline) add({ type: "service.status", key, name, status, rate: stat.recent });
  }

  // New verdicts from the analyst, and campaigns that outgrew their last tier.
  const fingerprintOf = new Map<string, { ips: Set<string>; service: string; firstEnd: number }>();
  for (const s of sessions) {
    const fp = intel.sessions[s.key]?.fingerprint;
    if (!fp) continue;
    const entry = fingerprintOf.get(fp) ?? { ips: new Set<string>(), service: serviceKey(s.protocol, s.service), firstEnd: s.end };
    if (s.ip) entry.ips.add(s.ip);
    entry.firstEnd = Math.min(entry.firstEnd, s.end);
    fingerprintOf.set(fp, entry);
  }

  for (const [fp, analysis] of Object.entries(intel.analyses)) {
    const known = state.threats.find((t) => t.fingerprint === fp);
    const seen = fingerprintOf.get(fp);
    if (!known) {
      // Low-severity noise (scans, plain password guessing) would drown the chronicle, and a service draws dozens of
      // near-identical medium scans: those are worth one line the first time, not every time.
      if (SEVERITY_RANK[analysis.severity] < SEVERITY_RANK.medium) continue;
      const key = seen?.service ?? null;
      const repeat =
        analysis.severity === "medium" &&
        [...state.threats, ...out.flatMap((e) => (e.type === "threat.emerged" ? [e] : []))].some(
          (t) => t.key === key && t.category === analysis.category,
        );
      if (repeat) continue;
      add({
        type: "threat.emerged",
        fingerprint: fp,
        key,
        severity: analysis.severity,
        category: analysis.category,
        verdict: analysis.verdict,
        at: seen ? since(key, seen.firstEnd) : undefined,
      });
      continue;
    }
    const ips = seen?.ips.size ?? 0;
    const tier = SPREAD_TIERS.filter((t) => ips >= t).pop();
    if (tier && tier > known.ips) {
      add({ type: "campaign.spread", fingerprint: fp, verdict: known.verdict, severity: known.severity, ips: tier });
    }
  }

  for (const [count, label] of MILESTONES) {
    if (sessions.length >= count && !state.milestones.some((m) => m.label === label)) {
      // Dated to the session that actually crossed the line; sessions are newest first.
      const crossedAt = sessions[sessions.length - count]?.end;
      add({ type: "milestone", label, sessions: count, at: crossedAt && since(null, crossedAt) });
    }
  }

  return out;
}

function plannerFacts({ now, sessions, intel }: Facts): PlannerFacts {
  const analysisOf = (s: Facts["sessions"][number]) => {
    const fp = intel.sessions[s.key]?.fingerprint;
    return fp ? intel.analyses[fp] : undefined;
  };
  return { now, sessions, analysisOf };
}

/** The planner's decisions, as chronicle events stamped with the tick's time. */
export function planLures(state: ChronicleState, facts: Facts, nextId: () => string, mode: PlannerMode = "auto"): ChronicleEvent[] {
  return plan(state, plannerFacts(facts), mode).map((d) => ({ id: nextId(), at: facts.now, ...d }) as ChronicleEvent);
}

function nextStatus(current: ServiceStatus, recent: number, idleFor: number): ServiceStatus {
  // Hysteresis: a surge only ends once traffic drops well below the threshold that started it.
  if (current === "besieged") return recent >= SURGE_OFF ? "besieged" : idleFor > IDLE_MS ? "quiet" : "active";
  if (recent >= SURGE_ON) return "besieged";
  return idleFor > IDLE_MS ? "quiet" : "active";
}

function describeSession(s: ReturnType<typeof buildSessions>[number]) {
  const first = s.interactions[0]?.input;
  if (first) return first.slice(0, 120);
  if (s.creds.length) return `login as ${s.creds[0].user || "(empty)"}`;
  return `${s.protocol} connection`;
}

export type { Severity };
