// Tails the beelzebub JSON log and exposes events over HTTP + Server-Sent Events.
import { existsSync, statSync, openSync, readSync, closeSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import geoip from "geoip-lite";
import { sourceIp, type GeoLocation, type HoneypotEvent, type HoneypotService } from "@honeyrizons/shared";
import { ANALYST_MODEL, analystEnabled } from "./analyst";
import { startIntel } from "./intel";

const LOG_PATH = resolve(process.env.LOG_PATH ?? join(import.meta.dir, "../../../logs/beelzebub.log"));
const PORT = Number(process.env.PORT ?? 4000);
const MAX_EVENTS = Number(process.env.MAX_EVENTS ?? 10000);
// Where the honeypot itself sits on the map, as "lat,lon". Defaults to Paris.
const [HOME_LAT, HOME_LON] = (process.env.HONEYPOT_LOCATION ?? "48.8566,2.3522").split(",").map(Number);
const SERVICES_DIR = resolve(process.env.SERVICES_DIR ?? join(import.meta.dir, "../../honeypot/config/services"));
const DIST = resolve(process.env.WEB_DIST ?? join(import.meta.dir, "../../web/dist"));

const events: HoneypotEvent[] = [];
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encoder = new TextEncoder();

const geoCache = new Map<string, GeoLocation | undefined>();

// Offline GeoLite lookup, so attacker IPs are never sent to a third-party service.
function locate(ip: string): GeoLocation | undefined {
  if (!ip) return undefined;
  if (geoCache.has(ip)) return geoCache.get(ip);
  const hit = geoip.lookup(ip);
  const geo = hit ? { country: hit.country, city: hit.city, lat: hit.ll[0], lon: hit.ll[1] } : undefined;
  geoCache.set(ip, geo);
  return geo;
}

let offset = 0;
let partial = "";

function ingest(line: string) {
  if (!line.trim()) return;
  let entry: { msg?: string; event?: HoneypotEvent };
  try {
    entry = JSON.parse(line);
  } catch {
    return;
  }
  if (entry.msg !== "New Event" || !entry.event) return;
  const geo = locate(sourceIp(entry.event));
  if (geo) entry.event.Geo = geo;
  events.push(entry.event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  broadcast(`data: ${JSON.stringify(entry.event)}\n\n`);
}

function broadcast(message: string) {
  const payload = encoder.encode(message);
  for (const c of clients) {
    try {
      c.enqueue(payload);
    } catch {
      clients.delete(c);
    }
  }
}

function poll() {
  if (!existsSync(LOG_PATH)) return;
  const { size } = statSync(LOG_PATH);
  if (size < offset) {
    // Log was truncated or rotated: start over.
    offset = 0;
    partial = "";
  }
  if (size === offset) return;
  const fd = openSync(LOG_PATH, "r");
  const buf = Buffer.alloc(size - offset);
  readSync(fd, buf, 0, buf.length, offset);
  closeSync(fd);
  offset = size;
  const lines = (partial + buf.toString("utf8")).split("\n");
  partial = lines.pop() ?? "";
  lines.forEach(ingest);
}

poll();
setInterval(poll, 500);

// Only the top-level scalar keys we display are needed, so a full YAML parser isn't worth it.
function readServices(): HoneypotService[] {
  if (!existsSync(SERVICES_DIR)) return [];
  return readdirSync(SERVICES_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((file) => {
      const text = readFileSync(join(SERVICES_DIR, file), "utf8");
      const field = (key: string) => text.match(new RegExp(`^${key}:\\s*["']?(.*?)["']?\\s*$`, "m"))?.[1] ?? "";
      return {
        file,
        protocol: field("protocol").toUpperCase(),
        address: field("address"),
        description: field("description"),
      };
    });
}

const intel = startIntel({
  events: () => events,
  publish: (patch) => broadcast(`event: intel\ndata: ${JSON.stringify(patch)}\n\n`),
  storePath: join(dirname(LOG_PATH), "intel.json"),
});

// Keep SSE connections alive through proxies.
setInterval(() => {
  const ping = encoder.encode(": ping\n\n");
  for (const c of clients) {
    try {
      c.enqueue(ping);
    } catch {
      clients.delete(c);
    }
  }
}, 15000);

Bun.serve({
  port: PORT,
  idleTimeout: 0,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/events") {
      const limit = Number(url.searchParams.get("limit") ?? 2000);
      return Response.json(events.slice(-limit));
    }

    if (url.pathname === "/api/stream") {
      let controller: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
          clients.add(c);
          c.enqueue(encoder.encode(": connected\n\n"));
        },
        cancel() {
          clients.delete(controller);
        },
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }

    if (url.pathname === "/api/intel") {
      return Response.json(intel.snapshot());
    }

    if (url.pathname === "/api/services") {
      return Response.json(readServices());
    }

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        logPath: LOG_PATH,
        logExists: existsSync(LOG_PATH),
        events: events.length,
        location: { lat: HOME_LAT, lon: HOME_LON },
        analyst: { enabled: analystEnabled(), model: ANALYST_MODEL },
      });
    }

    // Serve the built frontend in production.
    const file = Bun.file(join(DIST, url.pathname === "/" ? "index.html" : url.pathname));
    if (await file.exists()) return new Response(file);
    const index = Bun.file(join(DIST, "index.html"));
    if (await index.exists()) return new Response(index);
    return new Response("Frontend not built. Run `bun run build`, or `bun run dev` and open http://localhost:5173", { status: 404 });
  },
});

console.log(`[dashboard] API on http://localhost:${PORT} — tailing ${LOG_PATH}`);
