import { describe, expect, test } from "bun:test";
import { derive } from "../apps/api/src/chronicle";
import {
  foldChronicle,
  serviceKey,
  type AnalyticsSession,
  type ChronicleEvent,
  type HoneypotService,
  type IntelSnapshot,
  type SessionAnalysis,
  type Severity,
} from "../packages/shared/src/index";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

const SERVICES: HoneypotService[] = [
  { file: "ssh.yaml", protocol: "SSH", address: ":2222", description: "SSH interactive" },
  { file: "mcp.yaml", protocol: "MCP", address: ":8000", description: "MCP DevOps Assistant" },
];
const SSH = serviceKey("SSH", "SSH interactive");
const MCP = serviceKey("MCP", "MCP DevOps Assistant");

function session(over: Partial<AnalyticsSession> & { key: string }): AnalyticsSession {
  return {
    protocol: "SSH",
    service: "SSH interactive",
    ip: "203.0.113.1",
    country: "US",
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

function analysis(over: Partial<SessionAnalysis> = {}): SessionAnalysis {
  return {
    verdict: "AI agent exfiltrated .env",
    category: "data-exfiltration",
    severity: "critical",
    attacker: "ai-agent",
    summary: "",
    techniques: [],
    iocs: [],
    recommendation: "",
    model: "gpt-5.4-nano",
    ...over,
  };
}

const EMPTY_INTEL: IntelSnapshot = {
  sessions: {},
  analyses: {},
  brief: null,
  stats: { enabled: false, model: "", analyzed: 0, triaged: 0, queued: 0, budgetUsed: 0, budgetPerHour: 0 },
};

/** Runs derive against a ledger and returns both the new events and the resulting state. */
function step(
  ledger: ChronicleEvent[],
  facts: { now?: number; sessions?: AnalyticsSession[]; services?: HoneypotService[]; intel?: IntelSnapshot } = {},
) {
  let n = ledger.length;
  const fresh = derive(
    foldChronicle(ledger),
    { now: facts.now ?? NOW, sessions: facts.sessions ?? [], services: facts.services ?? SERVICES, intel: facts.intel ?? EMPTY_INTEL },
    () => `e${++n}`,
  );
  const next = [...ledger, ...fresh];
  return { fresh, next, state: foldChronicle(next) };
}

describe("chronicle derivation", () => {
  test("founds the city once, then only records what changes", () => {
    const first = step([]);
    expect(first.fresh.map((e) => e.type)).toEqual(["genesis"]);
    expect(Object.keys(first.state.services).sort()).toEqual([MCP, SSH].sort());
    expect(first.state.services[SSH].status).toBe("untouched");

    // Nothing happened since: the chronicle stays silent.
    expect(step(first.next).fresh).toEqual([]);
  });

  test("records a service being exposed or withdrawn", () => {
    const base = step([]).next;
    const added: HoneypotService = { file: "redis.yaml", protocol: "TCP", address: ":6379", description: "Redis 7.0.12" };
    const grown = step(base, { services: [...SERVICES, added] });
    expect(grown.fresh.map((e) => e.type)).toEqual(["service.exposed"]);

    const shrunk = step(grown.next, { services: [SERVICES[0]] });
    expect(shrunk.fresh.map((e) => e.type)).toEqual(["service.withdrawn", "service.withdrawn"]);
    expect(shrunk.state.services[MCP].withdrawnAt).toBe(NOW);
  });

  test("notes the first time attackers find a service, once", () => {
    const sessions = [session({ key: "s1", interactions: [{ input: "uname -a", output: "Linux", time: NOW }] })];
    // The honeypot has been running, so the founding is backdated before the traffic it already saw.
    const base = step([], { sessions }).next;
    const found = step(base, { sessions });
    const discovered = found.fresh.filter((e) => e.type === "service.discovered");
    expect(discovered).toHaveLength(1);
    expect(discovered[0]).toMatchObject({ key: SSH, summary: "uname -a" });
    // Dated to the session that found it, not to the tick that noticed.
    expect(found.state.services[SSH].discoveredAt).toBe(NOW - 30_000);

    // A second visit is not a second discovery.
    const again = step(found.next, { sessions: [...sessions, session({ key: "s2" })] });
    expect(again.fresh.filter((e) => e.type === "service.discovered")).toEqual([]);
  });

  test("flags a surge and waits for it to really subside", () => {
    let ledger = step([]).next;
    const burst = Array.from({ length: 12 }, (_, i) => session({ key: `b${i}`, end: NOW - i * 1000 }));
    ledger = step(ledger, { sessions: burst }).next;
    expect(foldChronicle(ledger).services[SSH].status).toBe("besieged");

    // Still above the lower bound: the surge is not over.
    const easing = step(ledger, { sessions: burst.slice(0, 7) });
    expect(easing.fresh.filter((e) => e.type === "service.status")).toEqual([]);

    const over = step(ledger, { sessions: burst.slice(0, 3) });
    expect(over.state.services[SSH].status).toBe("active");
  });

  test("goes quiet when nobody has come for a while", () => {
    let ledger = step([]).next;
    const visit = [session({ key: "s1" })];
    ledger = step(ledger, { sessions: visit }).next;
    const later = NOW + HOUR;
    const quiet = step(ledger, { sessions: visit, now: later });
    expect(quiet.fresh.filter((e) => e.type === "service.status")).toMatchObject([{ status: "quiet" }]);
  });

  test("keeps low-severity noise out and records real threats once", () => {
    const base = step([]).next;
    const sessions = [session({ key: "s1", protocol: "MCP", service: "MCP DevOps Assistant" })];
    const intel: IntelSnapshot = {
      ...EMPTY_INTEL,
      sessions: { s1: { fingerprint: "fp1", state: "analyzed", campaign: { sessions: 1, ips: 1 } } },
      analyses: { fp1: analysis(), noise: analysis({ severity: "low", verdict: "Port scan" }) },
    };
    const found = step(base, { sessions, intel });
    const threats = found.fresh.filter((e) => e.type === "threat.emerged");
    expect(threats).toHaveLength(1);
    expect(threats[0]).toMatchObject({ fingerprint: "fp1", key: MCP, severity: "critical" });
    expect(found.state.services[MCP].topSeverity).toBe("critical");

    expect(step(found.next, { sessions, intel }).fresh.filter((e) => e.type === "threat.emerged")).toEqual([]);
  });

  test("follows a campaign as it reaches more addresses", () => {
    const intelFor = (n: number): IntelSnapshot => ({
      ...EMPTY_INTEL,
      sessions: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [`s${i}`, { fingerprint: "fp1", state: "analyzed" as const, campaign: { sessions: n, ips: n } }]),
      ),
      analyses: { fp1: analysis({ severity: "high" }) },
    });
    const spread = (n: number) => Array.from({ length: n }, (_, i) => session({ key: `s${i}`, ip: `203.0.113.${i + 1}` }));

    let ledger = step([], { sessions: spread(6), intel: intelFor(6) }).next;
    expect(ledger.filter((e) => e.type === "campaign.spread")).toEqual([]);

    const wide = step(ledger, { sessions: spread(6), intel: intelFor(6) });
    expect(wide.fresh.filter((e) => e.type === "campaign.spread")).toMatchObject([{ ips: 5 }]);
    ledger = wide.next;

    const wider = step(ledger, { sessions: spread(30), intel: intelFor(30) });
    expect(wider.fresh.filter((e) => e.type === "campaign.spread")).toMatchObject([{ ips: 25 }]);
    // The tier does not fire twice.
    expect(step(wider.next, { sessions: spread(30), intel: intelFor(30) }).fresh).toEqual([]);
  });

  test("marks milestones as the honeypot fills up", () => {
    const base = step([]).next;
    const many = Array.from({ length: 120 }, (_, i) => session({ key: `s${i}` }));
    const hit = step(base, { sessions: many });
    expect(hit.fresh.filter((e) => e.type === "milestone")).toMatchObject([{ sessions: 100 }]);
    expect(step(hit.next, { sessions: many }).fresh.filter((e) => e.type === "milestone")).toEqual([]);
  });
});

describe("replaying the chronicle", () => {
  test("gives the city as it stood at any instant", () => {
    const ledger: ChronicleEvent[] = [
      { id: "e1", at: 1000, type: "genesis", services: [{ key: SSH, name: "SSH interactive", protocol: "SSH", address: ":2222" }] },
      { id: "e2", at: 2000, type: "service.discovered", key: SSH, name: "SSH interactive", sessionKey: "s1", summary: "uname -a" },
      { id: "e3", at: 3000, type: "service.status", key: SSH, name: "SSH interactive", status: "besieged", rate: 14 },
      { id: "e4", at: 4000, type: "service.status", key: SSH, name: "SSH interactive", status: "quiet", rate: 1 },
    ];

    expect(foldChronicle(ledger, 1500).services[SSH].status).toBe("untouched");
    expect(foldChronicle(ledger, 2500).services[SSH].status).toBe("active");
    expect(foldChronicle(ledger, 3500).services[SSH].status).toBe("besieged");
    expect(foldChronicle(ledger, 3500).services[SSH].rate).toBe(14);
    expect(foldChronicle(ledger).services[SSH].status).toBe("quiet");
    // Before the founding there is no city at all.
    expect(Object.keys(foldChronicle(ledger, 500).services)).toEqual([]);
  });

  test("is independent of the order events arrive in", () => {
    const events: ChronicleEvent[] = [
      { id: "e3", at: 3000, type: "service.status", key: SSH, name: "SSH", status: "besieged", rate: 14 },
      { id: "e1", at: 1000, type: "genesis", services: [{ key: SSH, name: "SSH", protocol: "SSH", address: ":2222" }] },
      { id: "e2", at: 2000, type: "service.discovered", key: SSH, name: "SSH", sessionKey: "s1", summary: "x" },
    ];
    expect(foldChronicle(events).services[SSH].status).toBe("besieged");
  });

  test("tracks the worst verdict a service has drawn", () => {
    const threat = (id: string, at: number, severity: Severity): ChronicleEvent => ({
      id,
      at,
      type: "threat.emerged",
      fingerprint: id,
      key: SSH,
      severity,
      category: "brute-force",
      verdict: "v",
    });
    const ledger: ChronicleEvent[] = [
      { id: "e1", at: 1000, type: "genesis", services: [{ key: SSH, name: "SSH", protocol: "SSH", address: ":2222" }] },
      threat("e2", 2000, "high"),
      threat("e3", 3000, "medium"),
    ];
    expect(foldChronicle(ledger).services[SSH].topSeverity).toBe("high");
    expect(foldChronicle(ledger, 2500).services[SSH].topSeverity).toBe("high");
    expect(foldChronicle(ledger, 1500).services[SSH].topSeverity).toBeNull();
  });
});
