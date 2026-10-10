// Turns the dashboard's honeypot data into the city, as it stood at a given instant.
//
// Everything here is a function of `viewedAt`: which services existed, what state they were in, and who was in the
// streets. That is what lets the timeline scrub through the city's history instead of only showing the present.
import { useMemo } from "react";
import { foldChronicle, serviceKey, type ChronicleService, type SessionAnalysis, type Severity } from "@honeyrizons/shared";
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
const FEED_SIZE = 4;
const DAY_MS = 24 * 3_600_000;

export type ServiceSite = {
  building: BuildingId;
  service: AnalyticsService;
  /** How the chronicle described this service at the viewed instant. */
  state: ChronicleService;
  /** Sessions against this service in the 24h before the viewed instant. */
  sessions: number;
  /** Most severe analyst verdict among those sessions. */
  topThreat: SessionAnalysis | null;
};

export type FeedItem = { session: AnalyticsSession; building: BuildingId };

/** @param viewedAt the instant the city is showing; the present when the timeline is live. */
export function useCityActivity(viewedAt: number, live: boolean) {
  const { data, intel, chronicle } = useDashboard();

  return useMemo(() => {
    // The chronicle decides which services stood at that moment, and in what state.
    const standing = foldChronicle(chronicle, viewedAt).services;
    const byService = new Map<string, BuildingId>();
    const sites = new Map<BuildingId, ServiceSite>();
    for (const service of data.services) {
      const building = buildingForAddress(service.address);
      const key = serviceKey(service.protocol, service.description);
      const state = standing[key];
      if (!building || !state || state.withdrawnAt) continue;
      byService.set(key, building);
      sites.set(building, { building, service, state, sessions: 0, topThreat: null });
    }
    const buildingOf = (s: AnalyticsSession) => byService.get(serviceKey(s.protocol, s.service));
    const analysisOf = (s: AnalyticsSession) => {
      const fingerprint = intel.sessions[s.key]?.fingerprint;
      return fingerprint ? intel.analyses[fingerprint] : undefined;
    };

    const since = viewedAt - DAY_MS;
    const candidates: { session: AnalyticsSession; building: BuildingId; severity: Severity }[] = [];
    const feed: FeedItem[] = [];
    // Sessions are newest first.
    for (const session of data.sessions) {
      if (session.end > viewedAt) continue;
      const building = buildingOf(session);
      if (!building) continue;
      if (feed.length < FEED_SIZE) feed.push({ session, building });
      if (session.end < since) continue;
      const analysis = analysisOf(session);
      const site = sites.get(building)!;
      site.sessions++;
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
        fresh: live && viewedAt - session.end < FRESH_MS,
      }));

    const newest = feed[0];
    const latest =
      live && newest
        ? {
            building: newest.building,
            severity: analysisOf(newest.session)?.severity ?? "low",
            key: `${newest.session.key}|${newest.session.events.length}`,
          }
        : null;

    return { sites: [...sites.values()], attackers, feed, latest, buildingOf };
  }, [data.services, data.sessions, intel, chronicle, viewedAt, live]);
}
