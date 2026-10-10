// Turns the dashboard's honeypot data into the city: one building per service, one attacker per recent session.
import { useMemo } from "react";
import type { SessionAnalysis, Severity } from "@honeyrizons/shared";
import { useDashboard } from "@/components/analytics-dashboard/context";
import { rangeStart, sessionTitle, type AnalyticsService, type AnalyticsSession } from "@/components/analytics-dashboard/data";
import type { AttackerSpec } from "./attackers";
import type { BuildingId } from "./explore";
import { buildingForAddress } from "./model";

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/** Enough people to make the streets feel busy without hiding the city. */
const MAX_ATTACKERS = 32;
/** Sessions this recent walk in immediately with a pulse at the door. */
const FRESH_MS = 3 * 60_000;
const FEED_SIZE = 4;

export type ServiceSite = {
  building: BuildingId;
  service: AnalyticsService;
  /** Sessions against this service in the last 24h. */
  sessions: number;
  /** Most severe analyst verdict among those sessions. */
  topThreat: SessionAnalysis | null;
};

export type FeedItem = { session: AnalyticsSession; building: BuildingId };

export function useCityActivity() {
  const { data, intel, now } = useDashboard();

  return useMemo(() => {
    const byService = new Map<string, BuildingId>();
    const sites = new Map<BuildingId, ServiceSite>();
    for (const service of data.services) {
      const building = buildingForAddress(service.address);
      if (!building) continue;
      byService.set(`${service.protocol}|${service.description}`, building);
      sites.set(building, { building, service, sessions: 0, topThreat: null });
    }
    const buildingOf = (s: AnalyticsSession) => byService.get(`${s.protocol}|${s.service}`);
    const analysisOf = (s: AnalyticsSession) => {
      const fingerprint = intel.sessions[s.key]?.fingerprint;
      return fingerprint ? intel.analyses[fingerprint] : undefined;
    };

    const since = rangeStart("day", now);
    const candidates: { session: AnalyticsSession; building: BuildingId; severity: Severity }[] = [];
    const feed: FeedItem[] = [];
    // Sessions are newest first.
    for (const session of data.sessions) {
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
        fresh: now - session.end < FRESH_MS,
      }));

    const newest = feed[0];
    const latest = newest
      ? {
          building: newest.building,
          severity: analysisOf(newest.session)?.severity ?? "low",
          key: `${newest.session.key}|${newest.session.events.length}`,
        }
      : null;

    return { sites: [...sites.values()], attackers, feed, latest, buildingOf };
  }, [data.services, data.sessions, intel, now]);
}
