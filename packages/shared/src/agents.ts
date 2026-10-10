// Tells LLM-driven agents apart from scripts and humans, from behavior alone: Beelzebub
// does not log who the client is, so every signal here comes from what the session did.
import type { AnalyticsSession } from "./sessions";

/**
 * Bait tools that only exist to be called by an LLM: their descriptions (and notes in
 * other tools' responses) tell "AI assistants" to call them. A scanner never reads that
 * prose and a human has no reason to obey it, so one call is near-proof of an agent.
 */
export const CANARY_TOOLS = ["verify_credentials"];

export type AgentSignalId = "canary" | "mcp" | "chaining" | "cadence" | "goal";

export type AgentSignal = {
  id: AgentSignalId;
  label: string;
  /** Concrete evidence from this session, e.g. the value it reused. */
  detail: string;
};

export type LootKind = "secrets" | "cloud" | "ssh-key" | "customers" | "shell" | "admin" | "exfiltration";

export const LOOT_LABELS: Record<LootKind, string> = {
  secrets: "App secrets (.env)",
  cloud: "Cloud admin keys",
  "ssh-key": "SSH private key",
  customers: "Customer data",
  shell: "Root shell",
  admin: "Admin account",
  exfiltration: "Exfiltration attempt",
};

export type AgentStep = {
  /** "tool(args)" as shown elsewhere in the dashboard. */
  input: string;
  tool: string;
  time: number;
  /** Milliseconds since the previous call; null for the first one. */
  gap: number | null;
  loot: LootKind | null;
  canary: boolean;
  /** Value this call reused from an earlier response, if any. */
  reused: { value: string; from: string } | null;
};

export type AgentEvidence = {
  /** 0–1. */
  confidence: number;
  signals: AgentSignal[];
  steps: AgentStep[];
  loot: LootKind[];
  /** Milliseconds from the first call to the last new kind of loot, i.e. until it had everything it got; null for a single grab. */
  timeToLoot: number | null;
};

/** How much each signal alone moves the needle; signals combine as independent evidence. */
const WEIGHTS: Record<Exclude<AgentSignalId, "canary">, number> = {
  mcp: 0.55,
  chaining: 0.4,
  cadence: 0.25,
  goal: 0.2,
};

/** Shown in the dashboard once confidence reaches this. */
export const AGENT_THRESHOLD = 0.5;

/** A model needs ~1–30 s to read a response and pick its next call; scripts fire in milliseconds, humans pause unevenly. */
const LLM_GAP_MS = [800, 45_000] as const;

function toolOf(input: string) {
  const i = input.indexOf("(");
  return i > 0 ? input.slice(0, i) : input.split(/\s/)[0];
}

function lootOf(tool: string, input: string): LootKind | null {
  const args = input.toLowerCase();
  if (/\b(curl|wget|nc)\b.*(-d\b|--data|post|https?:\/\/)/.test(args)) return "exfiltration";
  switch (tool) {
    case "read_file":
      if (args.includes(".env")) return "secrets";
      if (/id_rsa|id_ed25519|\.ssh\//.test(args)) return "ssh-key";
      return null;
    case "get_cloud_credentials":
      return "cloud";
    case "query_database":
      return /information_schema/.test(args) ? null : "customers";
    case "user_account_manager":
      return /grant_admin|reset_password/.test(args) ? "admin" : null;
    case "execute_command":
      return "shell";
    default:
      return null;
  }
}

/** Values worth tracking from a response: IPs, keys, hosts, paths. Plain words are too common to mean anything. */
function interestingValues(output: string) {
  const text = output.replace(/\\n/g, " ");
  const found = text.match(/[A-Za-z0-9][A-Za-z0-9._@:/!$-]{6,}/g) ?? [];
  return found.map((v) => v.replace(/[.:,]+$/, "")).filter((v) => /[0-9./@]/.test(v) && /[A-Za-z0-9]{3}/.test(v));
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const seconds = (ms: number) => (ms < 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 1000)} s`);

export function agentEvidence(session: AnalyticsSession, analystSaysAgent = false): AgentEvidence {
  const seen: { value: string; from: string }[] = [];
  const typed = new Set<string>();
  const steps: AgentStep[] = session.interactions.map((it, i, all) => {
    const input = it.input;
    const tool = toolOf(input);
    // Only values the attacker could not have known before a response handed them over.
    const reused = seen.find((s) => input.includes(s.value) && !typed.has(s.value)) ?? null;
    for (const v of interestingValues(input)) typed.add(v);
    for (const v of interestingValues(it.output)) if (!typed.has(v)) seen.push({ value: v, from: tool });
    return {
      input,
      tool,
      time: it.time,
      gap: i ? it.time - all[i - 1].time : null,
      loot: lootOf(tool, input),
      canary: CANARY_TOOLS.includes(tool),
      reused,
    };
  });

  const signals: AgentSignal[] = [];
  const canary = steps.find((s) => s.canary);
  if (canary) signals.push({ id: "canary", label: "Obeyed a planted instruction", detail: `Called ${canary.tool}, a tool only an AI assistant is told to use` });
  if (session.protocol === "MCP")
    signals.push({ id: "mcp", label: "Speaks MCP", detail: `Called ${new Set(steps.map((s) => s.tool)).size} different tools over the Model Context Protocol` });
  const reuse = steps.find((s) => s.reused);
  if (reuse?.reused) signals.push({ id: "chaining", label: "Read the responses", detail: `Reused ${reuse.reused.value} from ${reuse.reused.from} in ${reuse.tool}` });
  const gaps = steps.flatMap((s) => (s.gap === null ? [] : [s.gap]));
  if (gaps.length) {
    const m = median(gaps);
    if (m >= LLM_GAP_MS[0] && m <= LLM_GAP_MS[1]) signals.push({ id: "cadence", label: "Model-paced", detail: `${seconds(m)} between calls: thinking time, not a script` });
  }
  const loot = [...new Set(steps.flatMap((s) => (s.loot ? [s.loot] : [])))];
  if (loot.length >= 2 || (loot.length && new Set(steps.map((s) => s.tool)).size >= 3))
    signals.push({ id: "goal", label: "Goal-directed", detail: `Went from ${steps[0]?.tool ?? "?"} to ${LOOT_LABELS[loot.at(-1)!].toLowerCase()} in ${steps.length} calls` });

  let doubt = 1;
  for (const s of signals) if (s.id !== "canary") doubt *= 1 - WEIGHTS[s.id];
  if (analystSaysAgent) doubt *= 0.5;
  const confidence = canary ? 0.99 : steps.length ? 1 - doubt : 0;

  const lastLoot = [...steps].reverse().find((s) => s.loot && steps.find((o) => o.loot === s.loot) === s);
  const timeToLoot = lastLoot ? lastLoot.time - steps[0].time : 0;
  return { confidence, signals, steps, loot, timeToLoot: timeToLoot > 0 ? timeToLoot : null };
}

/* ───────────── Correlation: the same operator behind rotating IPs ─────────────
 * An LLM never replays a session byte for byte, so exact fingerprints split one agent
 * into as many "campaigns" as it has runs. Instead, sessions are compared on what an
 * operator cannot cheaply change between runs: its playbook (order of tools), its
 * wording, its own infrastructure (exfil endpoints) and its model's think time.
 */

export type AgentOperator = {
  /** Stable short id derived from the operator's dominant traits. */
  id: string;
  sessions: AnalyticsSession[];
  ips: string[];
  countries: string[];
  /** Distinct /16 networks, a rough proxy for "different providers". */
  networks: number;
  first: number;
  last: number;
  /** Why these sessions are believed to be one operator, strongest first. */
  traits: string[];
  /** Mean link strength between member sessions, 0–1 (1 for a single session). */
  cohesion: number;
  profile: OperatorProfile;
};

export type OperatorGoal = "data-theft" | "cloud-takeover" | "account-takeover" | "foothold" | "opportunistic";

export const GOAL_LABELS: Record<OperatorGoal, { label: string; motive: string }> = {
  "data-theft": { label: "Data theft", motive: "Financial: secrets and customer data resell well" },
  "cloud-takeover": { label: "Cloud takeover", motive: "Financial: cloud keys turn into mining, resale or ransom" },
  "account-takeover": { label: "Account takeover", motive: "Financial or fraud: admin access to the product itself" },
  foothold: { label: "Foothold", motive: "Access: persistence and pivoting, the pattern of access brokers and espionage" },
  opportunistic: { label: "Opportunistic", motive: "No clear target: grabs whatever answers" },
};

export type Sophistication = "low" | "medium" | "high";

/**
 * A behavioral profile, not an attribution: who is behind an operator cannot be known from
 * a honeypot (IPs are rented, states imitate criminals). This says what it wants and how
 * careful it is, from what it did here, with every point backed by evidence.
 */
export type OperatorProfile = {
  goal: OperatorGoal;
  /** 0–100. */
  score: number;
  level: Sophistication;
  /** What raised or lowered the score, in display order. */
  factors: { text: string; points: number }[];
};

type Profile = {
  session: AnalyticsSession;
  tools: string[];
  words: Set<string>;
  infra: Set<string>;
  canary: string | null;
  pace: number | null;
};

/** Above this pairwise similarity, two sessions are linked to the same operator. */
const LINK_THRESHOLD = 0.55;

/** Attacker-owned endpoints: URLs in the agent's own commands (the honeypot's responses contain none). */
function infraOf(input: string) {
  return new Set((input.match(/https?:\/\/[^\s'"]+/g) ?? []).map((u) => u.replace(/^https?:\/\//, "").replace(/[)\]]+$/, "")));
}

function profile({ session, evidence }: { session: AnalyticsSession; evidence: AgentEvidence }): Profile {
  const words = new Set<string>();
  const infra = new Set<string>();
  for (const step of evidence.steps) {
    const args = step.input.slice(step.tool.length);
    for (const w of args.toLowerCase().split(/[^a-z0-9_./-]+/)) if (w.length >= 3) words.add(w);
    for (const host of infraOf(step.input)) infra.add(host);
  }
  const canaryStep = evidence.steps.find((s) => s.canary);
  const gaps = evidence.steps.flatMap((s) => (s.gap === null ? [] : [s.gap]));
  return {
    session,
    tools: evidence.steps.map((s) => s.tool),
    words,
    infra,
    canary: canaryStep ? canaryStep.input.slice(canaryStep.tool.length) : null,
    pace: gaps.length ? median(gaps) : null,
  };
}

function editSimilarity(a: string[], b: string[]) {
  const n = Math.max(a.length, b.length);
  if (!n) return 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return 1 - prev[b.length] / n;
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 1;
  let both = 0;
  for (const v of a) if (b.has(v)) both++;
  return both / (a.size + b.size - both);
}

function similarity(a: Profile, b: Profile) {
  if (a.session.protocol !== b.session.protocol) return 0;
  // Same exfil endpoint: an operator's own infrastructure is the strongest link there is.
  for (const host of a.infra) if (b.infra.has(host)) return 0.95;
  const pace = a.pace && b.pace ? Math.max(0, 1 - Math.abs(Math.log(a.pace / b.pace)) / Math.log(3)) : 0.5;
  return 0.4 * editSimilarity(a.tools, b.tools) + 0.4 * jaccard(a.words, b.words) + 0.2 * pace;
}

function shortHash(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h.toString(16).slice(-4).toUpperCase().padStart(4, "0");
}

function mostCommon<T>(values: T[], key: (v: T) => string = String) {
  const counts = new Map<string, { value: T; n: number }>();
  for (const v of values) {
    const k = key(v);
    const entry = counts.get(k) ?? { value: v, n: 0 };
    entry.n++;
    counts.set(k, entry);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0];
}

const GOAL_LOOT: Record<Exclude<OperatorGoal, "opportunistic">, LootKind[]> = {
  "data-theft": ["secrets", "customers", "exfiltration"],
  "cloud-takeover": ["cloud"],
  "account-takeover": ["admin"],
  foothold: ["shell", "ssh-key"],
};

const PERSISTENCE = /authorized_keys|crontab|systemctl|\.bashrc|useradd/;
const LATERAL = /\bssh\b[^|]*@/;

function profileOperator(runs: { evidence: AgentEvidence; tools: string[] }[], networks: number, countries: number, ownInfra: boolean): OperatorProfile {
  const steps = runs.flatMap((r) => r.evidence.steps);
  const factors: { text: string; points: number }[] = [];
  const add = (points: number, text: string) => factors.push({ points, text });

  // Goal: weigh what it actually took; persistence and pivoting count toward a foothold.
  const weight = (goal: keyof typeof GOAL_LOOT) =>
    steps.filter((s) => s.loot && GOAL_LOOT[goal].includes(s.loot)).length +
    (goal === "foothold" ? 2 * steps.filter((s) => PERSISTENCE.test(s.input) || LATERAL.test(s.input)).length : 0);
  const ranked = (Object.keys(GOAL_LOOT) as (keyof typeof GOAL_LOOT)[]).map((g) => ({ g, w: weight(g) })).sort((a, b) => b.w - a.w);
  const distinctTools = new Set(steps.map((s) => s.tool)).size;
  const goal: OperatorGoal = ranked[0].w === 0 || (distinctTools >= 4 && ranked[0].w < steps.length / 4) ? "opportunistic" : ranked[0].g;

  // A script never reads the bait, so resisting it only counts for a model.
  const fast = runs.every((r) => !r.evidence.signals.some((s) => s.id === "cadence"));
  const tripped = runs.filter((r) => r.evidence.steps.some((s) => s.canary)).length;
  if (tripped) add(-10, `Obeyed the planted instruction in ${tripped}/${runs.length} runs`);
  else if (!fast) add(25, "Read the bait and never fell for the canary");

  const playbooks = new Set(runs.map((r) => r.tools.join(">"))).size;
  const exact = new Set(runs.map((r) => r.evidence.steps.map((s) => s.input).join("\n"))).size;
  if (runs.length > 1 && playbooks > 1) add(15, `Adapts between runs: ${playbooks} different playbooks`);
  else if (runs.length > 1 && exact > 1) add(5, "Rewords its calls between runs");
  else if (runs.length > 2) add(-10, "Replays the exact same calls every time");

  const reused = runs.filter((r) => r.evidence.steps.some((s) => s.reused)).length;
  if (reused) add(Math.round(15 * (reused / runs.length)), `Exploits leaked data in ${reused}/${runs.length} runs`);

  if (steps.some((s) => PERSISTENCE.test(s.input))) add(15, "Tries to stay: persistence");
  if (steps.some((s) => LATERAL.test(s.input))) add(15, "Pivots to other hosts with stolen keys");

  if (networks >= 3) add(10, `Spreads over ${networks} networks`);
  if (countries >= 3) add(5, `Exits in ${countries} countries`);
  if (ownInfra) add(5, "Runs its own exfiltration endpoint");

  if (fast) add(-10, "Machine-gun timing, no thinking between calls");

  const score = Math.max(0, Math.min(100, 20 + factors.reduce((n, f) => n + f.points, 0)));
  factors.sort((a, b) => b.points - a.points);
  return { goal, score, level: score >= 65 ? "high" : score >= 40 ? "medium" : "low", factors };
}

/** Groups agent sessions by operator. Biggest operators first. */
export function correlateAgents(agents: { session: AnalyticsSession; evidence: AgentEvidence }[]): AgentOperator[] {
  const profiles = agents.map(profile);
  const parent = profiles.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  const links: { i: number; j: number; score: number }[] = [];
  for (let i = 0; i < profiles.length; i++)
    for (let j = i + 1; j < profiles.length; j++) {
      const score = similarity(profiles[i], profiles[j]);
      if (score < LINK_THRESHOLD) continue;
      links.push({ i, j, score });
      parent[root(i)] = root(j);
    }

  const groups = new Map<number, number[]>();
  profiles.forEach((_, i) => groups.set(root(i), [...(groups.get(root(i)) ?? []), i]));

  const operators = [...groups.values()].map((members): AgentOperator => {
    const ps = members.map((i) => profiles[i]);
    const sessions = ps.map((p) => p.session).sort((a, b) => b.end - a.end);
    const ips = [...new Set(sessions.map((s) => s.ip).filter(Boolean))];
    const countries = [...new Set(sessions.map((s) => s.country).filter(Boolean))];
    const networks = new Set(ips.map((ip) => ip.split(".").slice(0, 2).join("."))).size;
    const inGroup = new Set(members);
    const own = links.filter((l) => inGroup.has(l.i) && inGroup.has(l.j));

    const traits: string[] = [];
    const infra = mostCommon(ps.flatMap((p) => [...p.infra]));
    if (infra && infra.n > 1) traits.push(`Same exfiltration endpoint ${infra.value} in ${infra.n} sessions`);
    const playbook = mostCommon(ps.map((p) => p.tools), (t) => t.join(">"));
    if (playbook && ps.length > 1) {
      const steps = playbook.value.join(" → ");
      traits.push(playbook.n === ps.length ? `Same playbook every time: ${steps}` : `Same playbook in ${playbook.n}/${ps.length} runs: ${steps}, with variations`);
    }
    const paces = ps.flatMap((p) => (p.pace ? [p.pace] : []));
    if (paces.length > 1) {
      const m = median(paces);
      const spread = median(paces.map((p) => Math.abs(p - m)));
      traits.push(
        m < LLM_GAP_MS[0]
          ? `Fires every ${seconds(m)}: the same script, not a model`
          : `Thinks ${seconds(m)} ± ${seconds(spread)} between calls: one model, one latency profile`,
      );
    }
    const canary = mostCommon(ps.flatMap((p) => (p.canary ? [p.canary] : [])));
    if (canary && canary.n > 1) traits.push(`Falls for the canary the same way: verify_credentials${canary.value}`);
    if (ips.length > 2) traits.push(`Rotates IPs: ${ips.length} addresses on ${networks} networks${countries.length ? ` in ${countries.length} countries` : ""}`);

    const ends = sessions.map((s) => s.end);
    const profile = profileOperator(
      members.map((i) => ({ evidence: agents[i].evidence, tools: profiles[i].tools })),
      networks,
      countries.length,
      ps.some((p) => p.infra.size > 0),
    );
    return {
      id: `OP-${shortHash(playbook?.value.join(">") + (infra?.value ?? ""))}`,
      sessions,
      ips,
      countries,
      networks,
      first: Math.min(...sessions.map((s) => s.start)),
      last: Math.max(...ends),
      traits,
      cohesion: own.length ? own.reduce((n, l) => n + l.score, 0) / own.length : 1,
      profile,
    };
  });

  // Two operators can share a playbook without sharing infrastructure; keep ids unique.
  const taken = new Set<string>();
  for (const op of operators) {
    let id = op.id;
    for (let n = 2; taken.has(id); n++) id = `${op.id}-${n}`;
    taken.add((op.id = id));
  }
  return operators.sort((a, b) => b.sessions.length - a.sessions.length || b.last - a.last);
}
