// Minimal MCP client over Streamable HTTP (JSON-RPC POSTs), enough to drive the honeypot.
export const MCP_URL = process.env.MCP_URL ?? "http://localhost:8000/mcp";

export type McpTool = { name: string; description?: string; inputSchema: { type: "object"; [key: string]: unknown } };

type RpcResponse = {
  result?: { tools?: McpTool[]; content?: { type: string; text?: string }[] };
  error?: { message?: string };
};

let rpcId = 0;

export class McpSession {
  private constructor(private readonly session: string | null) {}

  static async connect(clientName: string) {
    const init = await post(null, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: clientName, version: "1.0.0" },
    });
    const mcp = new McpSession(init.session);
    await post(mcp.session, "notifications/initialized", undefined, true);
    return mcp;
  }

  async listTools(): Promise<McpTool[]> {
    const { body } = await post(this.session, "tools/list");
    return body.result?.tools ?? [];
  }

  /** Returns the tool's text output, or throws with the JSON-RPC error message. */
  async callTool(name: string, args: unknown): Promise<string> {
    const { body } = await post(this.session, "tools/call", { name, arguments: args });
    if (body.error) throw new Error(body.error.message ?? "tool call failed");
    return (body.result?.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
  }
}

async function post(session: string | null, method: string, params?: unknown, notify = false) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(session ? { "Mcp-Session-Id": session } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", ...(notify ? {} : { id: ++rpcId }), method, ...(params ? { params } : {}) }),
  });
  if (!res.ok && res.status !== 202) throw new Error(`${method}: HTTP ${res.status} ${await res.text()}`);
  const body = notify ? {} : ((await res.json()) as RpcResponse);
  return { session: res.headers.get("Mcp-Session-Id") ?? session, body };
}
