// The city's chronicle: an append-only log of everything that happened to the honeypot's attack surface.
//
// The city is not a snapshot that we mutate; it is a fold over this log. `foldChronicle(events, until)` gives the
// city exactly as it stood at any instant, which is what makes the timeline replayable rather than approximated.
// The API derives and appends events; the web replays them.
import type { Severity } from "./index";

/** A service is identified the same way everywhere: by protocol and the name Beelzebub reports. */
export const serviceKey = (protocol: string, description: string) => `${protocol}|${description}`;

export type ServiceStatus =
  /** Exposed, never touched by anyone. */
  | "untouched"
  /** Seen traffic, currently idle. */
  | "quiet"
  /** Receiving traffic right now. */
  | "active"
  /** Under a burst well above its usual rate. */
  | "besieged";

export type ChronicleEvent = { id: string; at: number } & (
  | { type: "genesis"; services: { key: string; name: string; protocol: string; address: string }[] }
  /** `lure` is set when the city planner opened this service. */
  | { type: "service.exposed"; key: string; name: string; protocol: string; address: string; lure?: string }
  | { type: "service.discovered"; key: string; name: string; sessionKey: string; summary: string }
  | { type: "service.status"; key: string; name: string; status: ServiceStatus; rate: number }
  | { type: "service.withdrawn"; key: string; name: string }
  | { type: "threat.emerged"; fingerprint: string; key: string | null; severity: Severity; category: string; verdict: string }
  | { type: "campaign.spread"; fingerprint: string; verdict: string; severity: Severity; ips: number }
  | { type: "milestone"; label: string; sessions: number }
  /** The city planner decided to open a lure; it is under construction until the honeypot actually serves it. */
  | ({ type: "lure.planned"; lure: string; key: string; name: string } & LureCase)
  /** `manual` when an operator closed it rather than the planner. */
  | { type: "lure.retired"; lure: string; key: string; name: string; reason: string; manual?: boolean }
);

/** Why the planner opened a lure: the traffic that asked for it. */
export type LureCase = {
  reason: string;
  /** Demand score at the time of the decision (see apps/api/planner.ts). */
  score: number;
  ips: number;
  sessions: number;
  /** Labels of the signals that fired, strongest first. */
  signals: string[];
  /** A few of the attacker inputs that fired them, clipped. */
  samples: string[];
};

export type ChronicleEventType = ChronicleEvent["type"];

export type ChronicleService = {
  key: string;
  name: string;
  protocol: string;
  address: string;
  status: ServiceStatus;
  exposedAt: number;
  discoveredAt?: number;
  withdrawnAt?: number;
  /** Sessions per hour at the last status change. */
  rate: number;
  /** Worst analyst verdict seen on this service so far. */
  topSeverity: Severity | null;
  /** The lure this service is, when the city planner opened it. */
  lure?: string;
};

export type ChronicleThreat = {
  fingerprint: string;
  key: string | null;
  severity: Severity;
  category: string;
  verdict: string;
  at: number;
  /** Distinct source addresses, as of the last spread event. */
  ips: number;
};

export type LureStatus =
  /** Decided, not yet served by the honeypot. */
  | "planned"
  /** Served: attackers can reach it. */
  | "open"
  | "retired";

export type ChronicleLure = LureCase & {
  lure: string;
  key: string;
  name: string;
  status: LureStatus;
  plannedAt: number;
  openedAt?: number;
  retiredAt?: number;
  retiredBecause?: string;
  /** Closed by an operator: a choice, not a sign the lure failed, so it can be suggested again right away. */
  closedManually?: boolean;
  /** How many times the planner has opened this lure so far. */
  generation: number;
};

export type ChronicleState = {
  services: Record<string, ChronicleService>;
  /** By lure id; a retired lure stays here until it is planned again. */
  lures: Record<string, ChronicleLure>;
  threats: ChronicleThreat[];
  milestones: Extract<ChronicleEvent, { type: "milestone" }>[];
};

export const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/** Replays the chronicle up to `until` (inclusive). Events are applied in time order. */
export function foldChronicle(events: ChronicleEvent[], until = Infinity): ChronicleState {
  const state: ChronicleState = { services: {}, lures: {}, threats: [], milestones: [] };
  const expose = (at: number, s: { key: string; name: string; protocol: string; address: string; lure?: string }) => {
    const { key, name, protocol, address, lure } = s;
    state.services[key] = { key, name, protocol, address, lure, status: "untouched", exposedAt: at, rate: 0, topSeverity: null };
    const planned = lure ? state.lures[lure] : undefined;
    if (planned && planned.status === "planned") {
      planned.status = "open";
      planned.openedAt = at;
    }
  };

  for (const e of [...events].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))) {
    if (e.at > until) break;
    switch (e.type) {
      case "genesis":
        for (const s of e.services) expose(e.at, s);
        break;
      case "service.exposed":
        // A lure that was retired and opened again is the same address coming back: a fresh service.
        if (!state.services[e.key] || state.services[e.key].withdrawnAt) expose(e.at, e);
        break;
      case "service.discovered": {
        const s = state.services[e.key];
        if (s) {
          s.discoveredAt ??= e.at;
          if (s.status === "untouched") s.status = "active";
        }
        break;
      }
      case "service.status": {
        const s = state.services[e.key];
        if (s) {
          s.status = e.status;
          s.rate = e.rate;
        }
        break;
      }
      case "service.withdrawn": {
        const s = state.services[e.key];
        if (s) s.withdrawnAt = e.at;
        break;
      }
      case "threat.emerged": {
        state.threats.push({ ...e, ips: 1 });
        const s = e.key ? state.services[e.key] : undefined;
        if (s && (!s.topSeverity || SEVERITY_RANK[e.severity] > SEVERITY_RANK[s.topSeverity])) s.topSeverity = e.severity;
        break;
      }
      case "campaign.spread": {
        const threat = state.threats.find((t) => t.fingerprint === e.fingerprint);
        if (threat) threat.ips = e.ips;
        break;
      }
      case "milestone":
        state.milestones.push(e);
        break;
      case "lure.planned": {
        const { id: _id, at, type: _type, ...rest } = e;
        state.lures[e.lure] = { ...rest, status: "planned", plannedAt: at, generation: (state.lures[e.lure]?.generation ?? 0) + 1 };
        break;
      }
      case "lure.retired": {
        const l = state.lures[e.lure];
        if (l && l.status !== "retired") {
          l.status = "retired";
          l.retiredAt = e.at;
          l.retiredBecause = e.reason;
          l.closedManually = e.manual;
        }
        break;
      }
    }
  }
  return state;
}

/** Services standing at that point. */
export const liveServices = (state: ChronicleState) => Object.values(state.services).filter((s) => !s.withdrawnAt);

/** One line per event, for the timeline and the city log. */
export function describeEvent(e: ChronicleEvent): { title: string; detail?: string; severity?: Severity } {
  switch (e.type) {
    case "genesis":
      return { title: "City founded", detail: `${e.services.length} services exposed` };
    case "service.exposed":
      return { title: e.lure ? `${e.name} opened as a lure` : `${e.name} exposed`, detail: `${e.protocol} ${e.address}` };
    case "service.discovered":
      return { title: `${e.name} discovered by attackers`, detail: e.summary };
    case "service.status":
      return {
        title:
          e.status === "besieged"
            ? `${e.name} under a surge`
            : e.status === "quiet"
              ? `${e.name} went quiet`
              : `${e.name} active again`,
        detail: e.status === "quiet" ? undefined : `${Math.round(e.rate)} sessions/h`,
      };
    case "service.withdrawn":
      return { title: `${e.name} withdrawn` };
    case "threat.emerged":
      return { title: e.verdict, detail: e.category.replace(/-/g, " "), severity: e.severity };
    case "campaign.spread":
      return { title: `Campaign spread to ${e.ips} addresses`, detail: e.verdict, severity: e.severity };
    case "milestone":
      return { title: e.label, detail: `${e.sessions.toLocaleString("en-US")} sessions` };
    case "lure.planned":
      return { title: `Planner builds ${e.name}`, detail: e.reason };
    case "lure.retired":
      return { title: `${e.name} closed`, detail: e.reason };
  }
}

export type ChronicleSnapshot = { events: ChronicleEvent[]; since: number };
