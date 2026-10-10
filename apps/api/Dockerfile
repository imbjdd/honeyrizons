# Dashboard: Bun API + built React UI. Build context: repo root
FROM docker.io/oven/bun:1.3.14 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/honeypot/package.json apps/honeypot/
COPY packages/shared/package.json packages/shared/
COPY packages/tsconfig/package.json packages/tsconfig/

FROM deps AS build
RUN bun install --frozen-lockfile
COPY packages packages
COPY apps/web apps/web
RUN cd apps/web && bun run build

FROM deps
ENV NODE_ENV=production
RUN bun install --frozen-lockfile --production
COPY packages packages
COPY apps/api apps/api
# /api/services reads the honeypot service definitions.
COPY apps/honeypot/config/services apps/honeypot/config/services
COPY --from=build /app/apps/web/dist apps/web/dist
USER bun
EXPOSE 4000
CMD ["bun", "apps/api/src/index.ts"]
