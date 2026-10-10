# Honeyrizons 🍯

Honeypot basé sur [Beelzebub](https://github.com/beelzebub-labs/beelzebub) + un dashboard web temps réel.

Monorepo [Turborepo](https://turborepo.com) + workspaces Bun.

```
apps/
  honeypot/        @honeyrizons/honeypot — Beelzebub (Go)
    beelzebub/       sources upstream (vendored, non modifiées)
    config/          config core + services exposés
    scripts/         attack.sh (faux trafic)
  api/             @honeyrizons/api — Bun : tail du log → REST + SSE (:4000)
  web/             @honeyrizons/web — React + Vite (:5173)
packages/
  shared/          @honeyrizons/shared — types d'event + helpers partagés
  tsconfig/        @honeyrizons/tsconfig — tsconfig de base
logs/              beelzebub.log (généré)
```

Flux : `honeypot` écrit les events JSON dans `logs/beelzebub.log` → `api` le lit en continu et pousse en SSE → `web` affiche.

## Prérequis

Go ≥ 1.26, Bun.

## Commandes

```bash
bun install
bun run dev        # build Go + honeypot + API + UI → http://localhost:5173
bun run attack     # dans un autre terminal, simule des attaques
bun run build      # binaire Go + UI buildée
bun run start      # mode prod : UI servie par l'API sur http://localhost:4000
bun run typecheck
```

Pour cibler un seul package : `bunx turbo run dev --filter=@honeyrizons/web`.

## Services exposés

| Service              | Port | Config                              |
| -------------------- | ---- | ----------------------------------- |
| SSH (shell fake)     | 2222 | `apps/honeypot/config/services/ssh.yaml`        |
| Telnet               | 2323 | `apps/honeypot/config/services/telnet.yaml`     |
| HTTP (WordPress)     | 8080 | `apps/honeypot/config/services/http-wordpress.yaml` |
| MySQL                | 3306 | `apps/honeypot/config/services/mysql.yaml`      |
| Redis                | 6379 | `apps/honeypot/config/services/redis.yaml`      |
| Prometheus metrics   | 2112 | `apps/honeypot/config/beelzebub.yaml`           |

Pour ajouter un service, copier un exemple depuis `apps/honeypot/beelzebub/configurations/services/` dans `apps/honeypot/config/services/`.
Les events sont écrits en JSON dans `logs/beelzebub.log`, que le dashboard lit en continu.
