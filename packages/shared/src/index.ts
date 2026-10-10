export type HoneypotEvent = {
  DateTime: string;
  RemoteAddr: string;
  Protocol: string;
  Command: string;
  CommandOutput: string;
  Status: string;
  Msg: string;
  ID: string;
  User: string;
  Password: string;
  Client: string;
  Headers: string;
  HeadersMap: Record<string, string[]> | null;
  UserAgent: string;
  HostHTTPRequest: string;
  Body: string;
  HTTPMethod: string;
  RequestURI: string;
  Description: string;
  SourceIp: string;
  SourcePort: string;
  Handler: string;
  Metadata?: Record<string, string>;
  /** Added by the API from the source IP; absent for private or unknown addresses. */
  Geo?: GeoLocation;
};

export type GeoLocation = {
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
  city: string;
  lat: number;
  lon: number;
};

export function sourceIp(e: HoneypotEvent): string {
  if (e.SourceIp) return e.SourceIp;
  const addr = e.RemoteAddr;
  if (!addr) return "";
  const i = addr.lastIndexOf(":");
  return (i > 0 ? addr.slice(0, i) : addr).replace(/^\[|\]$/g, "");
}

export const PROTOCOL_COLORS: Record<string, string> = {
  HTTP: "#4f9cf9",
  SSH: "#f5a524",
  TELNET: "#e5484d",
  TCP: "#30a46c",
  MCP: "#2fd0b5",
};

export function protocolColor(p: string): string {
  return PROTOCOL_COLORS[p] ?? "#8b8d98";
}

export type HoneypotService = {
  file: string;
  protocol: string;
  address: string;
  description: string;
};

/** Compact view of one attack session, sent to the analyst agent. No source IP: one analysis covers every session with the same behavior. */
export type SessionDigest = {
  protocol: string;
  service: string;
  client: string;
  /** ISO timestamps. */
  start: string;
  end: string;
  status: string;
  creds: { user: string; password: string }[];
  interactions: { input: string; output: string }[];
};

export const ATTACK_CATEGORIES = [
  "reconnaissance",
  "web-scan",
  "brute-force",
  "malware-dropper",
  "cryptomining",
  "botnet",
  "data-exfiltration",
  "privilege-escalation",
  "persistence",
  "ai-agent-abuse",
  "benign",
  "other",
] as const;

export type AttackCategory = (typeof ATTACK_CATEGORIES)[number];

export type Severity = "low" | "medium" | "high" | "critical";

export type SessionAnalysis = {
  verdict: string;
  category: AttackCategory;
  severity: Severity;
  attacker: "automated-scanner" | "botnet" | "human-operator" | "ai-agent" | "unknown";
  summary: string;
  techniques: { id: string; name: string; evidence: string }[];
  iocs: { type: "ip" | "url" | "domain" | "file-path" | "credential" | "ssh-key" | "command" | "other"; value: string }[];
  recommendation: string;
  /** "rules" for sessions triaged locally without an LLM call. */
  model: string;
};

/** Aggregated numbers for one time range, sent to the analyst agent for the threat brief. */
export type BriefInput = {
  range: string;
  totals: { events: number; attackers: number; sessions: number; credentials: number };
  protocols: Record<string, number>;
  topCountries: { country: string; events: number }[];
  topCredentials: { value: string; count: number }[];
  topCommands: { value: string; count: number }[];
  notableSessions: string[];
};

export type ThreatBrief = {
  headline: string;
  risk: Severity;
  findings: string[];
  recommendations: string[];
  model: string;
  /** ISO timestamp. */
  generatedAt: string;
};

/**
 * live: session still in progress · queued: waiting for the analyst (or its hourly budget)
 * analyzed: LLM analysis available · triaged: classified by local rules · failed: analyst error
 */
export type IntelState = "live" | "queued" | "analyzed" | "triaged" | "failed";

export type SessionIntel = {
  /** Sessions with the same behavior share a fingerprint, and therefore one analysis. */
  fingerprint: string;
  state: IntelState;
  campaign: { sessions: number; ips: number };
};

export type IntelStats = {
  enabled: boolean;
  model: string;
  analyzed: number;
  triaged: number;
  queued: number;
  budgetUsed: number;
  budgetPerHour: number;
};

export type IntelSnapshot = {
  sessions: Record<string, SessionIntel>;
  analyses: Record<string, SessionAnalysis>;
  brief: ThreatBrief | null;
  stats: IntelStats;
};

/** Pushed over SSE (event: "intel") whenever triage results change. */
export type IntelPatch = Partial<Omit<IntelSnapshot, "sessions">> & { sessions?: Record<string, SessionIntel> };

export * from "./sessions";
export * from "./chronicle";
export * from "./agents";
