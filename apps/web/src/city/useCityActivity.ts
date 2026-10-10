// Turns the dashboard's honeypot data into the city: which services stand (the chronicle's fold, so lures come and go),
// what state they are in, and who is in the streets.
import { useMemo } from "react";
import {
  foldChronicle,
  lureById,
  serviceKey,
  type ChronicleLure,
  type ChronicleService,
  type LureBlueprint,
  type SessionAnalysis,
  type Severity,
} from "@honeyrizons/shared";
import { useDashboard } from "@/components/analytics-dashboard/context";
import { sessionTitle, type AnalyticsService, type AnalyticsSession } from "@/components/analytics-dashboard/data";
import type { AttackerSpec } from "./attackers";
import type { BuildingId } from "./explore";
import { buildingForAddress } from "./model";

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/** Enough people to make the streets feel busy without hiding the city. */
const MAX_ATTACKERS = 32;
/** Sessions this recent walk in immediately with a pulse at the door. */
const FRESH_MS = 3 * 60_000;
const DAY_MS = 24 * 3_600_000;

export type ServiceSite = {
  building: BuildingId;
  service: AnalyticsService;
  /** How the chronicle describes this service now. */
  state: ChronicleService;
  /** Sessions against this service in the 24h before the viewed instant. */
  sessions: number;
  /** End of the latest of those sessions. */
  lastHit: number | null;
  /** Most severe analyst verdict among those sessions. */
  topThreat: SessionAnalysis | null;
};

/** A lure the city planner has opened at some point, as it stood at the viewed instant. */
export type LureSite = {
  building: BuildingId;
  blueprint: LureBlueprint;
  state: ChronicleLure;
  /** Sessions it caught since it last opened, up to the viewed instant. */
  caught: number;
};

export function useCityActivity() {
  const { data, intel, chronicle, now } = useDashboard();

  return useMemo(() => {
    // The whole chronicle: the dashboard clock ticks slower than events arrive, so anything in it has happened.
    const city = foldChronicle(chronicle);
    const byService = new Map<string, BuildingId>();
    const sites = new Map<BuildingId, ServiceSite>();
    // Walk the services the chronicle says stood then, not the ones configured now: lures come and go.
    for (const state of Object.values(city.services)) {
      const building = buildingForAddress(state.address);
      if (!building || state.withdrawnAt) continue;
      const service =
        data.services.find((s) => serviceKey(s.protocol, s.description) === state.key) ??
        // Closed since: its traffic is still in the sessions, but it is no longer in the live config.
        { file: "", protocol: state.protocol, address: state.address, description: state.name, events: 0, ips: 0, lastSeen: null, activity: [] };
      byService.set(state.key, building);
      sites.set(building, { building, service, state, sessions: 0, lastHit: null, topThreat: null });
    }
    const buildingOf = (s: AnalyticsSession) => byService.get(serviceKey(s.protocol, s.service));
    const analysisOf = (s: AnalyticsSession) => {
      const fingerprint = intel.sessions[s.key]?.fingerprint;
      return fingerprint ? intel.analyses[fingerprint] : undefined;
    };

    const since = now - DAY_MS;
    const candidates: { session: AnalyticsSession; building: BuildingId; severity: Severity }[] = [];
    let newest: { session: AnalyticsSession; building: BuildingId } | undefined;
    // Sessions are newest first.
    for (const session of data.sessions) {
      const building = buildingOf(session);
      if (!building) continue;
      newest ??= { session, building };
      if (session.end < since) continue;
      const site = sites.get(building)!;
      // A lure's traffic from before it was last planned belongs to a previous opening.
      const lure = site.state.lure ? city.lures[site.state.lure] : undefined;
      if (lure && session.end < lure.plannedAt) continue;
      const analysis = analysisOf(session);
      site.sessions++;
      site.lastHit ??= session.end;
      if (analysis && (!site.topThreat || SEVERITY_RANK[analysis.severity] > SEVERITY_RANK[site.topThreat.severity])) {
        site.topThreat = analysis;
      }
      candidates.push({ session, building, severity: analysis?.severity ?? "low" });
    }

    // Keep the most recent and the most severe: a quiet brute force shouldn't crowd out an AI agent stealing secrets.
    const attackers: AttackerSpec[] = candidates
      .map((c, recency) => ({ ...c, score: SEVERITY_RANK[c.severity] * 12 - recency }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ATTACKERS)
      .map(({ session, building, severity }) => ({
        id: session.key,
        building,
        severity,
        agent: session.protocol === "MCP",
        label: `${severity === "low" ? "" : `${severity.toUpperCase()} · `}${sessionTitle(session)}`,
        // Nobody "arrives" in a replay; the fanfare is for traffic landing right now.
        fresh: now - session.end < FRESH_MS,
      }));

    const latest =
      newest
        ? {
            building: newest.building,
            severity: analysisOf(newest.session)?.severity ?? "low",
            key: `${newest.session.key}|${newest.session.events.length}`,
          }
        : null;

    const lures: LureSite[] = [];
    for (const state of Object.values(city.lures)) {
      const blueprint = lureById(state.lure);
      const building = blueprint && buildingForAddress(blueprint.address);
      if (!blueprint || !building) continue;
      // From the decision, not the opening: the honeypot serves a lure a few seconds before the chronicle notices.
      const since = state.openedAt === undefined ? Infinity : state.plannedAt;
      const caughtSessions = data.sessions.filter(
        (s) => serviceKey(s.protocol, s.service) === state.key && s.end >= since && s.end <= (state.retiredAt ?? Infinity),
      );
      lures.push({ building, blueprint, state, caught: caughtSessions.length });
    }
    lures.sort((a, b) => b.state.plannedAt - a.state.plannedAt);
    // Planned but not served yet: the planner has broken ground, the honeypot has not opened the doors.
    const construction = lures.filter((l) => l.state.status === "planned").map((l) => l.building);

    return { sites: [...sites.values()], attackers, latest, lures, construction };
  }, [data.services, data.sessions, intel, chronicle, now]);
}
