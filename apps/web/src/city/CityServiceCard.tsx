import { useDashboard } from "@/components/analytics-dashboard/context";
import { relativeTime } from "@/components/analytics-dashboard/data";
import { SeverityPill } from "@/components/analytics-dashboard/ai";
import { CloseIcon } from "@/components/analytics-dashboard/icons";
import { formatCount, ProtocolIcon } from "@/components/analytics-dashboard/ui";
import { getBuilding } from "./explore";
import type { ServiceSite } from "./useCityActivity";

/** The selected building's service: what it exposes, who hit it, and the worst thing the analyst saw there. */
export function CityServiceCard({ site, close, enter }: { site: ServiceSite; close: () => void; enter: () => void }) {
  const { now } = useDashboard();
  const building = getBuilding(site.building);
  const { service } = site;

  return (
    <section className="city-panel city-service swap-in" aria-label={`${service.description} service`}>
      <header className="city-service-head">
        <ProtocolIcon protocol={service.protocol} size={15} />
        <div>
          <h2>{service.description}</h2>
          <p>
            {building.name} · {service.address}
          </p>
        </div>
        <button type="button" className="icon-btn press" aria-label="Close" onClick={close}>
          <CloseIcon size={14} />
        </button>
      </header>

      <dl className="city-service-stats">
        <div>
          <dt>Sessions 24h</dt>
          <dd>{formatCount(site.sessions)}</dd>
        </div>
        <div>
          <dt>Attackers</dt>
          <dd>{formatCount(service.ips)}</dd>
        </div>
        <div>
          <dt>Last hit</dt>
          <dd>{service.lastSeen ? relativeTime(service.lastSeen, now) : "never"}</dd>
        </div>
      </dl>

      {site.topThreat && (
        <div className="city-service-threat">
          <SeverityPill severity={site.topThreat.severity} />
          <p>{site.topThreat.verdict}</p>
        </div>
      )}

      <button type="button" className="link-more city-service-enter" onClick={enter}>
        Step inside {building.name}
      </button>
    </section>
  );
}
