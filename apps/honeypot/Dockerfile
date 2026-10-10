# Beelzebub honeypot. Build context: apps/honeypot
FROM docker.io/library/golang:1.26-alpine AS build
WORKDIR /src
COPY beelzebub/go.mod beelzebub/go.sum ./
RUN go mod download
COPY beelzebub/ .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /beelzebub .

FROM docker.io/library/alpine:3.22
# Mirror the repo layout so config/beelzebub.yaml's relative logsPath (../../logs) resolves to /app/logs.
RUN adduser -D -H -u 10001 honeypot && mkdir -p /app/logs && chown honeypot /app/logs
WORKDIR /app/apps/honeypot
COPY --from=build /beelzebub /usr/local/bin/beelzebub
COPY config/ config/
COPY scripts/supervise.sh /usr/local/bin/supervise
USER honeypot
# Core services, then the lures the city planner may open (served by the annex).
EXPOSE 2222 2323 8080 3306 6379 8000 2112 11434 2375 8081 5432 8001 1883
ENTRYPOINT ["supervise"]
