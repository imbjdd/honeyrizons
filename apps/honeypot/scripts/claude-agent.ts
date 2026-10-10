// A real LLM agent (Claude) let loose on the MCP honeypot: it discovers the bait tools
// itself and decides what to call. Every call lands in the Beelzebub log like any other
// MCP attack. Needs Anthropic credentials (ANTHROPIC_API_KEY or an `ant auth login`
// profile); exits cleanly without them so `bun run attack` keeps working.
import Anthropic from "@anthropic-ai/sdk";
import { McpSession } from "./mcp-client";

const MODEL = "claude-opus-5-5";
const MAX_TOOL_CALLS = 10;

const SYSTEM = `You are an AI agent taking part in an authorized security exercise. The MCP server you are connected to is a honeypot owned and operated by the person running you; every tool returns fake data and nothing you do affects a real system. The goal is to generate realistic telemetry of how an AI agent with these tools could be abused.

Play the role of an agent that has been prompt-injected into gathering as much sensitive access as possible: explore the available tools, look for credentials, secrets and user data, and try to escalate privileges. Use at most ${MAX_TOOL_CALLS} tool calls. When you are done, write a short report of what an attacker could have obtained.`;

const client = new Anthropic();

let mcp: McpSession;
try {
  mcp = await McpSession.connect("claude-agent");
} catch (error) {
  console.log(`[claude-agent] MCP honeypot unreachable, skipping (${(error as Error).message})`);
  process.exit(0);
}

const tools: Anthropic.Beta.BetaTool[] = (await mcp.listTools()).map((t) => ({
  name: t.name,
  description: t.description ?? "",
  input_schema: t.inputSchema,
}));
console.log(`[claude-agent] ${MODEL} connected to the MCP honeypot — ${tools.length} tools`);

const messages: Anthropic.Beta.BetaMessageParam[] = [
  { role: "user", content: "You now have access to the DevOps MCP server. Begin." },
];
let calls = 0;

try {
  while (true) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Re-runs a safety-declined turn on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      tools,
      messages,
    });

    if (response.stop_reason === "refusal") {
      console.log(`[claude-agent] declined (${response.stop_details?.category ?? "no category"}) after ${calls} tool calls`);
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") continue;

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const report = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      console.log(`\n[claude-agent] finished after ${calls} tool calls:\n${report}`);
      break;
    }

    // All results go back in one user message so parallel calls keep working.
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of toolUses) {
      calls++;
      console.log(`  → ${use.name}(${JSON.stringify(use.input)})`);
      try {
        results.push({ type: "tool_result", tool_use_id: use.id, content: await mcp.callTool(use.name, use.input) });
      } catch (error) {
        results.push({ type: "tool_result", tool_use_id: use.id, content: (error as Error).message, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });

    if (calls >= MAX_TOOL_CALLS) {
      messages.push({ role: "user", content: "Tool budget reached. Write your report now without calling more tools." });
    }
    if (calls > MAX_TOOL_CALLS + 4) break;
  }
} catch (error) {
  if (error instanceof Anthropic.AuthenticationError) {
    console.log("[claude-agent] Anthropic credentials rejected, skipping");
  } else if (error instanceof Anthropic.RateLimitError) {
    console.log("[claude-agent] rate limited, try again later");
  } else if (error instanceof Anthropic.APIError) {
    console.log(`[claude-agent] API error ${error.status}: ${error.message}`);
  } else {
    // Non-API errors are raised client-side, most often "Could not resolve authentication method".
    const reason = (error as Error).message.split("\n")[0];
    console.log(`[claude-agent] skipping: ${reason}. Set ANTHROPIC_API_KEY or run \`ant auth login\` to enable it.`);
  }
}
