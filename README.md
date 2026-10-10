# Honeyrizons 🍯

A honeypot built on [Beelzebub](https://github.com/beelzebub-labs/beelzebub) with a real-time web dashboard.

[Turborepo](https://turborepo.com) monorepo with Bun workspaces.

```
apps/
  honeypot/        @honeyrizons/honeypot — Beelzebub (Go)
    beelzebub/       upstream sources (vendored, unmodified)
    config/          core config + exposed services
    scripts/         attack.sh (local traffic), agent-attack.ts (scripted MCP agents),
                     claude-agent.ts (real Claude agent), seed-demo.ts (demo data)
  api/             @honeyrizons/api — Bun: tails the log → REST + SSE (:4000)
  web/             @honeyrizons/web — React + Vite (:5173)
packages/
  shared/          @honeyrizons/shared — event types + shared helpers
  tsconfig/        @honeyrizons/tsconfig — base tsconfig
logs/              beelzebub.log (generated)
```

Flow: `honeypot` writes JSON events to `logs/beelzebub.log` → `api` tails it and pushes over SSE → `web` renders them.

## Requirements

Go ≥ 1.26, Bun.

## Commands

```bash
bun install
bun run dev        # Go build + honeypot + API + UI → http://localhost:5173
bun run attack     # in another terminal, simulates attacks (from ::1), MCP agents and Claude included
bun run attack:agent   # only the scripted AI agent attacks against the MCP service
bun run attack:claude  # only the real Claude agent (needs ANTHROPIC_API_KEY or `ant auth login`)
bun run seed       # appends ~60 demo attackers with IPs from around the world (for the map)
bun run build      # Go binary + built UI
bun run start      # production mode: UI served by the API on http://localhost:4000
bun run typecheck
```

The map geolocates IPs offline (bundled GeoLite database via `geoip-lite`), so no IP is sent to a third-party service.
Local addresses (`::1`, private ranges) have no location. Events from `bun run seed` are tagged `Metadata.demo = "true"`.
Set the honeypot's position on the map with `HONEYPOT_LOCATION="lat,lon"` for the API (defaults to Paris).

To target a single package: `bunx turbo run dev --filter=@honeyrizons/web`.

## Exposed services

| Service              | Port | Config                                              |
| -------------------- | ---- | --------------------------------------------------- |
| SSH (fake shell)     | 2222 | `apps/honeypot/config/services/ssh.yaml`            |
| Telnet               | 2323 | `apps/honeypot/config/services/telnet.yaml`         |
| HTTP (WordPress)     | 8080 | `apps/honeypot/config/services/http-wordpress.yaml` |
| MySQL                | 3306 | `apps/honeypot/config/services/mysql.yaml`          |
| Redis                | 6379 | `apps/honeypot/config/services/redis.yaml`          |
| MCP (AI agents)      | 8000 | `apps/honeypot/config/services/mcp.yaml`            |
| Prometheus metrics   | 2112 | `apps/honeypot/config/beelzebub.yaml`               |

The MCP service is a Streamable HTTP endpoint at `http://localhost:8000/mcp` exposing bait tools (`execute_command`, `read_file`,
`get_cloud_credentials`, `query_database`, `user_account_manager`). Every tool call is logged with its arguments and answered
with static fake data. `bun run attack:agent` replays four scripted agent personas (secret exfiltration, recon, data harvesting,
privilege escalation); no LLM is involved.

`bun run attack:claude` runs a real Claude agent (`claude-opus-5-5`, low effort, at most 10 tool calls) against the same
endpoint: it discovers the tools itself, decides what to call, and prints a short report of what it obtained. It is framed as an
authorized exercise against your own honeypot, and uses server-side refusal fallbacks (`fallbacks: "default"`). Without
Anthropic credentials it prints a notice and exits, so `bun run attack` keeps working. Each run costs API tokens.

To add a service, copy an example from `apps/honeypot/beelzebub/configurations/services/` into `apps/honeypot/config/services/`.
Events are written as JSON to `logs/beelzebub.log`, which the dashboard tails continuously.

Dashboard UI adapted from the [ObsidianUI Analytics Dashboard](https://www.obsidianui.dev/docs/analytics-dashboard) (MIT).
