// Tails the beelzebub JSON log and exposes events over HTTP + Server-Sent Events.
import { existsSync, statSync, openSync, readSync, closeSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import geoip from "geoip-lite";
import {
  buildSessions,
  foldChronicle,
  sourceIp,
  type GeoLocation,
  type HoneypotEvent,
  type HoneypotService,
  type PlannerSnapshot,
} from "@honeyrizons/shared";
import { ANALYST_MODEL, analystEnabled } from "./analyst";
import { startIntel } from "./intel";
import { startChronicle } from "./chronicle";
import { demandSince, measureDemand, PLANNER, type PlannerMode } from "./planner";

const LOG_PATH = resolve(process.env.LOG_PATH ?? join(import.meta.dir, "../../../logs/beelzebub.log"));
// Analyst verdicts + threat brief. The log volume is read-only in docker-compose, so this lives elsewhere there.
const INTEL_PATH = resolve(process.env.INTEL_PATH ?? join(dirname(LOG_PATH), "intel.json"));
const CHRONICLE_PATH = resolve(process.env.CHRONICLE_PATH ?? join(dirname(INTEL_PATH), "chronicle.json"));
const PORT = Number(process.env.PORT ?? 4000);
const MAX_EVENTS = Number(process.env.MAX_EVENTS ?? 10000);
// Where the honeypot itself sits on the map, as "lat,lon". Defaults to Paris.
const [HOME_LAT, HOME_LON] = (process.env.HONEYPOT_LOCATION ?? "48.8566,2.3522").split(",").map(Number);
const SERVICES_DIR = resolve(process.env.SERVICES_DIR ?? join(import.meta.dir, "../../honeypot/config/services"));
// City planner: lure configs it can open, the annex directory the honeypot serves them from, and the honeypot's list
// of the lures it actually loaded. CITY_PLANNER: auto (default) builds lures itself, propose waits for an operator to
// apply its suggestions from the city, off keeps the attack surface fixed.
const LURES_DIR = resolve(process.env.LURES_DIR ?? join(import.meta.dir, "../../honeypot/config/lures"));
const ANNEX_DIR = resolve(process.env.ANNEX_DIR ?? join(import.meta.dir, "../../honeypot/config/annex"));
const ANNEX_LOG_PATH = resolve(process.env.ANNEX_LOG_PATH ?? join(dirname(LOG_PATH), "annex.log"));
const ANNEX_MANIFEST = resolve(process.env.ANNEX_MANIFEST ?? join(dirname(LOG_PATH), "annex.txt"));
const PLANNER_MODE: PlannerMode = ({ off: "off", propose: "propose" } as const)[process.env.CITY_PLANNER ?? ""] ?? "auto";
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

/** Follows one log file. The core honeypot and the annex (the planner's lures) each write their own. */
function tail(path: string) {
  let offset = 0;
  let partial = "";
  return () => {
    if (!existsSync(path)) return;
    const { size } = statSync(path);
    if (size < offset) {
      // Log was truncated or rotated: start over.
      offset = 0;
      partial = "";
    }
    if (size === offset) return;
    const fd = openSync(path, "r");
    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    closeSync(fd);
    offset = size;
    const lines = (partial + buf.toString("utf8")).split("\n");
    partial = lines.pop() ?? "";
    lines.forEach(ingest);
  };
}

const polls = [tail(LOG_PATH), tail(ANNEX_LOG_PATH)];
const poll = () => polls.forEach((p) => p());
poll();
setInterval(poll, 500);

// Only the top-level scalar keys we display are needed, so a full YAML parser isn't worth it.
function readServiceDir(dir: string, only?: (file: string) => boolean): HoneypotService[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f) && (!only || only(f)))
    .map((file) => {
      const text = readFileSync(join(dir, file), "utf8");
      const field = (key: string) => text.match(new RegExp(`^${key}:\\s*["']?(.*?)["']?\\s*$`, "m"))?.[1] ?? "";
      return {
        file,
        protocol: field("protocol").toUpperCase(),
        address: field("address"),
        description: field("description"),
      };
    });
}

/** Lures the honeypot reports serving. A config the planner wrote but the annex has not loaded is not exposed yet. */
function servedLures(): Set<string> {
  if (!existsSync(ANNEX_MANIFEST)) return new Set();
  return new Set(readFileSync(ANNEX_MANIFEST, "utf8").split("\n").map((l) => l.trim()).filter(Boolean));
}

function readServices(): HoneypotService[] {
  const served = servedLures();
  return [...readServiceDir(SERVICES_DIR), ...readServiceDir(ANNEX_DIR, (f) => served.has(f))];
}

const intel = startIntel({
  events: () => events,
  publish: (patch) => broadcast(`event: intel\ndata: ${JSON.stringify(patch)}\n\n`),
  storePath: INTEL_PATH,
});

const chronicle = startChronicle({
  events: () => events,
  services: readServices,
  intel: intel.snapshot,
  publish: (fresh) => broadcast(`event: chronicle\ndata: ${JSON.stringify(fresh)}\n\n`),
  storePath: CHRONICLE_PATH,
  planner: PLANNER_MODE === "off" ? undefined : { mode: PLANNER_MODE, blueprints: LURES_DIR, annex: ANNEX_DIR },
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

    if (url.pathname === "/api/chronicle") {
      return Response.json(chronicle.snapshot());
    }

    // What the city planner sees right now: how close each lure is to being built.
    if (url.pathname === "/api/planner") {
      const snapshot = intel.snapshot();
      const now = Date.now();
      const state = foldChronicle(chronicle.snapshot().events);
      const demand = measureDemand(
        buildSessions(events, now),
        (s) => {
          const fp = snapshot.sessions[s.key]?.fingerprint;
          return fp ? snapshot.analyses[fp] : undefined;
        },
        (id) => demandSince(state, id, now),
      );
      const suggested = new Set(chronicle.suggestions().map((d) => d.lure.id));
      return Response.json({
        mode: PLANNER_MODE,
        planAt: PLANNER.planAt,
        capacity: PLANNER.capacity,
        demand: demand.map(({ lure, ...why }) => ({ lure: lure.id, ...why, suggested: suggested.has(lure.id) })),
      } satisfies PlannerSnapshot);
    }

    // An operator applying a suggestion or closing a lure, in propose mode only. Apply only accepts a lure the planner
    // itself would build right now, so the endpoint can open nothing that the automatic planner would not.
    const action = url.pathname.match(/^\/api\/planner\/(apply|close)$/)?.[1];
    if (action && req.method === "POST") {
      if (PLANNER_MODE !== "propose") return Response.json({ error: "The planner runs on its own" }, { status: 409 });
      const body = (await req.json().catch(() => null)) as { lure?: unknown } | null;
      if (typeof body?.lure !== "string") return Response.json({ error: "Expected { lure }" }, { status: 400 });
      const result = action === "apply" ? chronicle.apply(body.lure) : chronicle.close(body.lure);
      return Response.json(result, { status: "error" in result ? 409 : 200 });
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
        planner: { mode: PLANNER_MODE, serving: [...servedLures()] },
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
