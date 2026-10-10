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
  MCP: "#8e4ec6",
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
