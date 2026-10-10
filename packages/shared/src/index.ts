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
};

export function sourceIp(e: HoneypotEvent): string {
  if (e.SourceIp) return e.SourceIp;
  const addr = e.RemoteAddr;
  if (!addr) return "";
  const i = addr.lastIndexOf(":");
  return (i > 0 ? addr.slice(0, i) : addr).replace(/^\[|\]$/g, "");
}

export function summary(e: HoneypotEvent): string {
  if (e.Protocol === "HTTP") return `${e.HTTPMethod} ${e.RequestURI}`;
  if (e.Command) return e.Command;
  if (e.Password) return `login ${e.User}:${e.Password}`;
  if (e.User) return `session ${e.User}`;
  return e.Msg;
}

export function hasCredentials(e: HoneypotEvent): boolean {
  return Boolean(e.Password);
}

export function topN<T>(items: T[], key: (t: T) => string, n = 8): [string, number][] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export const PROTOCOL_COLORS: Record<string, string> = {
  HTTP: "#4f9cf9",
  SSH: "#f5a524",
  TELNET: "#e5484d",
  TCP: "#30a46c",
  MCP: "#8e4ec6",
};

export function protocolColor(p: string): string {
  return PROTOCOL_COLORS[p] ?? "#8b8d98";
}
