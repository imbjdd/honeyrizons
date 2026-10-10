# Honeyrizons 🍯

A honeypot built on [Beelzebub](https://github.com/beelzebub-labs/beelzebub) with a real-time web dashboard.

[Turborepo](https://turborepo.com) monorepo with Bun workspaces.

## Frontend ville 3D

La page d'accueil est une ville voxel Three.js inspirée de [ZStreet](https://zstreet.cash/), avec cinq quartiers, des personnages 2D cliquables, neuf boutiques et 17 étages à explorer. Les intérieurs se visitent à la première personne, avec déplacement, escaliers et conversations. Les couleurs, la circulation, le mode jour/nuit et l'export photo utilisent des données de démonstration locales.

```bash
bun install
bun run dev:web    # frontend seul, sans API ni honeypot, sur :5173
bun run build:web
```

Le dashboard existant reste accessible sur `/dashboard`. Les captures, la vidéo, les instructions et les points d'intégration futurs sont dans [docs/city](docs/city/README.md).

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

## Analyst agent

Every session is triaged automatically; nobody has to click anything.

- **Local rules (free)**: sessions with nothing to read (password guessing with no commands, bare connections) get an
  instant verdict without any LLM call.
- **Analyst agent**: sessions where the attacker actually did something (shell commands, MCP tool calls, HTTP requests) are
  sent, once they have been quiet for 90 seconds, to a small OpenAI model (`gpt-5.4-nano` by default). It returns a category,
  severity, attacker type, MITRE ATT&CK techniques, indicators and one recommended action.
- **Campaigns**: sessions with the same behavior share a fingerprint (normalized commands, not IPs or timestamps), so a botnet
  replaying one script from hundreds of IPs costs a single analysis, and the dashboard shows "same behavior from N IPs".
- **Threat brief**: every 30 minutes, when there is something new, the analyst writes a brief of the last 24 hours from
  aggregated stats and its own verdicts.

Where it shows up: severity badges in every session list, a "High & critical" filter on the Sessions page, the verdict at the
top of each session's details, and an Analyst card on the Overview with the brief and a "Needs attention" list.

Cost control: an hourly cap on LLM calls (`OPENAI_MAX_ANALYSES_PER_HOUR`, default 40; the richest sessions go first, the
rest wait), trimmed inputs, capped outputs, low reasoning effort, and results persisted to `logs/intel.json` so nothing is
paid for twice, even across restarts. The attacker's IP and country are never sent to OpenAI, and attacker-controlled text is
passed as delimited, untrusted data.

Setup: `cp apps/api/.env.example apps/api/.env` and set `OPENAI_API_KEY`. The `.env` file is git-ignored. Without a key,
sessions are still classified by the local rules.

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
