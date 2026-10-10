import { useDashboard } from "@/components/analytics-dashboard/context";
import { relativeTime, sessionTitle, type AnalyticsSession } from "@/components/analytics-dashboard/data";
import { ThreatBadge } from "@/components/analytics-dashboard/ai";
import { ProtocolIcon } from "@/components/analytics-dashboard/ui";
import type { BuildingId } from "./explore";
import type { FeedItem } from "./useCityActivity";

/** Latest sessions; opening one shows it in the dashboard's details panel and flies to its building. */
export function CityFeed({
  items,
  focus,
  buildingOf,
}: {
  items: FeedItem[];
  focus: (building: BuildingId) => void;
  buildingOf: (s: AnalyticsSession) => BuildingId | undefined;
}) {
  const { openSession, now, status, selected } = useDashboard();
  if (items.length === 0) return null;

  return (
    <section className="city-panel city-feed" aria-label="Latest sessions">
      <p className="ai-label city-feed-title">
        <span className="live-dot" data-live={status.connected} aria-hidden="true" />
        Live
      </p>
      <ol>
        {items.map(({ session }) => (
          <li key={session.key}>
            <button
              type="button"
              className="city-feed-row"
              aria-pressed={selected === session.key}
              onClick={() => {
                openSession(session.key);
                const building = buildingOf(session);
                if (building) focus(building);
              }}
            >
              <ProtocolIcon protocol={session.protocol} size={13} />
              <span className="city-feed-title-text">{sessionTitle(session)}</span>
              <ThreatBadge session={session} />
              <time>{relativeTime(session.end, now)}</time>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
