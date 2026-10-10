// Compliance report: one assembled, deterministic structure that the CSV, Excel and PDF
// exports all render from, so the three formats never disagree. Pure and shared, so the
// numbers match what the dashboard shows. No attribution, every figure traceable to a session.
import { agentEvidence, correlateAgents, type AgentEvidence } from "./agents";
import type { AnalyticsSession } from "./sessions";
import type { IntelSnapshot, SessionAnalysis, Severity } from "./index";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export type ComplianceMeta = {
  /** ISO timestamp the report was produced. */
  generatedAt: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  services: number;
  analyst: { enabled: boolean; model: string };
  /** Frameworks the findings are mapped or related to; honest about scope. */
  references: string[];
};

export type ThreatRegisterRow = {
  /** Stable reference within this report, e.g. HRZ-20261010-001. */
  ref: string;
  firstSeen: string;
  lastSeen: string;
  protocol: string;
  service: string;
  sourceIps: string[];
  countries: string[];
  sessions: number;
  attacker: string;
  category: string;
  severity: Severity;
  verdict: string;
  summary: string;
  techniques: string[];
  iocs: string[];
  /** 0–100, from behavioral AI-agent detection; null when not an agent. */
  aiAgentConfidence: number | null;
  operator: string | null;
  recommendation: string;
  source: string;
};

export type OperatorRow = {
  id: string;
  sessions: number;
  ips: number;
  networks: number;
  countries: string[];
  goal: string;
  sophistication: string;
  sophisticationScore: number;
  firstSeen: string;
  lastSeen: string;
  traits: string[];
};

export type ComplianceReport = {
  meta: ComplianceMeta;
  summary: {
    events: number;
    sessions: number;
    analyzed: number;
    attackers: number;
    bySeverity: Record<Severity, number>;
    aiAgents: number;
    operators: number;
    canaryTrips: number;
  };
  register: ThreatRegisterRow[];
  operators: OperatorRow[];
  mitre: { id: string; name: string; count: number }[];
  notes: string[];
};

const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const label = (s: string) => s.replace(/-/g, " ").replace(/\bai\b/gi, "AI").replace(/^./, (c) => c.toUpperCase());

type Options = {
  periodLabel: string;
  periodStart: number;
  now: number;
  services: number;
  totalEvents: number;
};

export function buildComplianceReport(sessions: AnalyticsSession[], intel: IntelSnapshot, opts: Options): ComplianceReport {
  const inPeriod = sessions.filter((s) => s.end >= opts.periodStart);

  // Agent detection and operator correlation, over the same window the report covers.
  const agents = inPeriod
    .filter((s) => s.interactions.length)
    .map((session) => ({ session, evidence: agentEvidence(session) }))
    .filter((a) => a.evidence.confidence >= 0.5);
  const operators = correlateAgents(agents);
  const evidenceByKey = new Map<string, AgentEvidence>(agents.map((a) => [a.session.key, a.evidence]));
  const operatorByKey = new Map<string, string>();
  for (const op of operators) for (const s of op.sessions) operatorByKey.set(s.key, op.id);

  // Group sessions into campaigns by analyst fingerprint; one register row per analyzed campaign.
  const campaigns = new Map<string, { analysis: SessionAnalysis; sessions: AnalyticsSession[] }>();
  for (const s of inPeriod) {
    const entry = intel.sessions[s.key];
    const analysis = entry ? intel.analyses[entry.fingerprint] : undefined;
    if (!entry || !analysis) continue;
    const c = campaigns.get(entry.fingerprint) ?? { analysis, sessions: [] };
    c.sessions.push(s);
    campaigns.set(entry.fingerprint, c);
  }

  const date = iso(opts.now).slice(0, 10).replace(/-/g, "");
  const rows: ThreatRegisterRow[] = [...campaigns.values()]
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.analysis.severity) - SEVERITY_ORDER.indexOf(b.analysis.severity) ||
        Math.max(...b.sessions.map((s) => s.end)) - Math.max(...a.sessions.map((s) => s.end)),
    )
    .map(({ analysis, sessions: cs }, i) => {
      const confidence = Math.max(0, ...cs.map((s) => evidenceByKey.get(s.key)?.confidence ?? 0));
      return {
        ref: `HRZ-${date}-${String(i + 1).padStart(3, "0")}`,
        firstSeen: iso(Math.min(...cs.map((s) => s.start))),
        lastSeen: iso(Math.max(...cs.map((s) => s.end))),
        protocol: cs[0].protocol,
        service: cs[0].service,
        sourceIps: [...new Set(cs.map((s) => s.ip).filter(Boolean))],
        countries: [...new Set(cs.map((s) => s.country).filter(Boolean))],
        sessions: cs.length,
        attacker: label(analysis.attacker),
        category: label(analysis.category),
        severity: analysis.severity,
        verdict: analysis.verdict,
        summary: analysis.summary,
        techniques: analysis.techniques.map((t) => `${t.id} ${t.name}`),
        iocs: analysis.iocs.map((i2) => `${i2.type}:${i2.value}`),
        aiAgentConfidence: confidence >= 0.5 ? Math.round(confidence * 100) : null,
        operator: cs.map((s) => operatorByKey.get(s.key)).find(Boolean) ?? null,
        recommendation: analysis.recommendation,
        source: analysis.model === "rules" ? "Local rules" : analysis.model,
      };
    });

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>;
  for (const r of rows) bySeverity[r.severity] += r.sessions;

  const mitre = new Map<string, { id: string; name: string; count: number }>();
  for (const { analysis, sessions: cs } of campaigns.values())
    for (const t of analysis.techniques) {
      const e = mitre.get(t.id) ?? { id: t.id, name: t.name, count: 0 };
      e.count += cs.length;
      mitre.set(t.id, e);
    }

  const operatorRows: OperatorRow[] = operators.map((op) => ({
    id: op.id,
    sessions: op.sessions.length,
    ips: op.ips.length,
    networks: op.networks,
    countries: op.countries,
    goal: label(op.profile.goal),
    sophistication: op.profile.level,
    sophisticationScore: op.profile.score,
    firstSeen: iso(op.first),
    lastSeen: iso(op.last),
    traits: op.traits,
  }));

  const canaryTrips = agents.filter((a) => a.evidence.signals.some((s) => s.id === "canary")).length;
  const attackers = new Set(inPeriod.map((s) => s.ip).filter(Boolean)).size;

  return {
    meta: {
      generatedAt: iso(opts.now),
      periodLabel: opts.periodLabel,
      periodStart: iso(opts.periodStart),
      periodEnd: iso(opts.now),
      services: opts.services,
      analyst: { enabled: intel.stats.enabled, model: intel.stats.model },
      references: ["MITRE ATT&CK", "ISO/IEC 27001:2022 A.5.7 (Threat intelligence)", "NIST SP 800-61r2 (Incident handling)"],
    },
    summary: {
      events: opts.totalEvents,
      sessions: inPeriod.length,
      analyzed: rows.reduce((n, r) => n + r.sessions, 0),
      attackers,
      bySeverity,
      aiAgents: agents.length,
      operators: operators.filter((op) => op.sessions.length > 1).length,
      canaryTrips,
    },
    register: rows,
    operators: operatorRows,
    mitre: [...mitre.values()].sort((a, b) => b.count - a.count),
    notes: [
      "Scope: automated monitoring evidence from a deception honeypot. This is a detection record, not a control-effectiveness assessment or an audit opinion.",
      "Attribution: operators are grouped by observed behavior (tooling, wording, infrastructure, model latency), never by identity. Source IPs may be rented or proxied and do not establish geographic origin.",
      `Analyst: ${intel.stats.enabled ? `verdicts produced by OpenAI ${intel.stats.model} and by local rules` : "verdicts produced by local rules only (LLM analyst disabled)"}; severity and AI-agent confidence are heuristic scores.`,
      "Reproducibility: every row traces to logged sessions over the stated period; re-running the report over the same period yields the same figures.",
    ],
  };
}

/** RFC 4180 CSV of the threat register, the primary machine-readable export. */
export function reportToCsv(report: ComplianceReport): string {
  const headers = [
    "Ref",
    "First seen (UTC)",
    "Last seen (UTC)",
    "Protocol",
    "Service",
    "Source IPs",
    "Countries",
    "Sessions",
    "Attacker type",
    "Category",
    "Severity",
    "AI agent confidence %",
    "Operator",
    "Verdict",
    "Summary",
    "MITRE ATT&CK",
    "Indicators",
    "Recommendation",
    "Analysis source",
  ];
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = report.register.map((r) =>
    [
      r.ref,
      r.firstSeen,
      r.lastSeen,
      r.protocol,
      r.service,
      r.sourceIps.join(" "),
      r.countries.join(" "),
      r.sessions,
      r.attacker,
      r.category,
      r.severity,
      r.aiAgentConfidence,
      r.operator,
      r.verdict,
      r.summary,
      r.techniques.join("; "),
      r.iocs.join("; "),
      r.recommendation,
      r.source,
    ]
      .map(cell)
      .join(","),
  );
  return [headers.map(cell).join(","), ...rows].join("\r\n");
}
