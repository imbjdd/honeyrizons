// Session reconstruction from raw Beelzebub events. Shared so the API (auto-triage)
// and the dashboard group events exactly the same way and agree on session keys.
import { sourceIp, type HoneypotEvent } from "./index";

export type AnalyticsSessionStatus = { kind: "merged" | "review" | "open" | "agent"; label: string };

export type AnalyticsInteraction = { input: string; output: string; time: number };

export type AnalyticsSession = {
  key: string;
  protocol: string;
  service: string;
  ip: string;
  country: string;
  user: string;
  client: string;
  start: number;
  end: number;
  status: AnalyticsSessionStatus;
  creds: { user: string; password: string }[];
  interactions: AnalyticsInteraction[];
  events: HoneypotEvent[];
};

const time = (e: HoneypotEvent) => Date.parse(e.DateTime);

/** A stateless burst (scan, brute force, agent run) ends after this much silence from the same attacker. */
const STATELESS_GAP_MS = 10 * 60_000;

/** Stateless events (HTTP requests, SSH password attempts, MCP tool calls) each get their own ID, so group them per attacker and service. */
function sessionKey(e: HoneypotEvent) {
  return e.Status === "Stateless" ? `${e.Protocol}|${sourceIp(e)}|${e.Description}` : e.ID;
}

export function buildSessions(events: HoneypotEvent[], now: number): AnalyticsSession[] {
  const open = new Map<string, AnalyticsSession>();
  const all: AnalyticsSession[] = [];
  // The log is in append order, which isn't chronological once demo data is mixed in.
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  for (const e of sorted) {
    const group = sessionKey(e);
    const t = time(e);
    let s = open.get(group);
    if (s && e.Status === "Stateless" && t - s.end > STATELESS_GAP_MS) s = undefined;
    if (!s) {
      const key = `${group}|${t}`;
      s = {
        key,
        protocol: e.Protocol,
        service: e.Description,
        ip: sourceIp(e),
        country: e.Geo?.country ?? "",
        user: e.User,
        client: e.UserAgent || e.Client,
        start: t,
        end: t,
        status: { kind: "review", label: "" },
        creds: [],
        interactions: [],
        events: [],
      };
      open.set(group, s);
      all.push(s);
    }
    s.events.push(e);
    s.end = Math.max(s.end, t);
    s.service ||= e.Description;
    s.ip ||= sourceIp(e);
    s.user ||= e.User;
    s.country ||= e.Geo?.country ?? "";
    s.client ||= e.UserAgent || e.Client;
    if (e.Password) s.creds.push({ user: e.User, password: e.Password });
    if (e.Status === "Interaction" || e.Status === "Stateless") {
      const input = e.Protocol === "HTTP" ? `${e.HTTPMethod} ${e.RequestURI}` : e.Protocol === "MCP" ? formatToolCall(e.Command) : escapeControl(e.Command);
      if (input) s.interactions.push({ input, output: e.CommandOutput, time: t });
    }
  }

  for (const s of all) {
    const stateless = s.events.every((e) => e.Status === "Stateless");
    const ended = s.events.some((e) => e.Status === "End");
    if (stateless) {
      s.status =
        s.protocol === "MCP"
          ? { kind: "agent", label: "AI agent" }
          : s.protocol === "HTTP"
            ? { kind: "review", label: "Scan" }
            : s.creds.length > 0
              ? { kind: "review", label: "Brute force" }
              : { kind: "review", label: "Probe" };
    } else if (ended || now - s.end > 10 * 60_000) {
      s.status = { kind: "merged", label: "Closed" };
    } else {
      s.status = { kind: "open", label: "Active" };
    }
  }

  return all.sort((a, b) => b.end - a.end);
}

export function sessionTitle(s: AnalyticsSession) {
  const user = s.user || s.creds.at(-1)?.user;
  const n = s.interactions.length;
  if (s.protocol === "HTTP") return `${n} HTTP request${n > 1 ? "s" : ""} to ${s.service}`;
  if (s.protocol === "MCP") {
    const tools = [...new Set(s.interactions.map((i) => i.input.split("(")[0]))];
    return `${n} tool call${n > 1 ? "s" : ""} · ${tools.slice(0, 2).join(", ")}${tools.length > 2 ? ` +${tools.length - 2}` : ""}`;
  }
  if (s.status.label === "Brute force") return `${s.creds.length} login attempt${s.creds.length > 1 ? "s" : ""} on ${s.service}`;
  if (n === 0) return `${s.protocol} login${user ? ` as ${user}` : ""}, no commands`;
  const first = s.interactions[0].input;
  return `${user ? `${user}@` : ""}${s.protocol.toLowerCase()} · ${first}${n > 1 ? ` +${n - 1}` : ""}`;
}

/** Binary protocol probes send control bytes (e.g. a lone NUL to MySQL); show them as \xNN instead of invisible text. */
function escapeControl(text: string) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

/** Beelzebub logs MCP calls as `tool|map[key:value key2:value2]` (Go's map formatting). */
export function formatToolCall(command: string) {
  const sep = command.indexOf("|");
  if (sep < 0) return command;
  const tool = command.slice(0, sep);
  const args = command
    .slice(sep + 1)
    .replace(/^map\[|\]$/g, "")
    .trim();
  return `${tool}(${args})`;
}

