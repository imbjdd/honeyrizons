import { useDashboard } from "@/components/analytics-dashboard/context";
import { relativeTime } from "@/components/analytics-dashboard/data";
import { SeverityPill } from "@/components/analytics-dashboard/ai";
import { CloseIcon } from "@/components/analytics-dashboard/icons";
import { ProtocolIcon } from "@/components/analytics-dashboard/ui";
import { getBuilding } from "./explore";
import type { LureSite, ServiceSite } from "./useCityActivity";

/** The selected building: its service, what hit it, and for a lure, why the planner opened it. */
export function CityServiceCard({ site, lure, close }: { site?: ServiceSite; lure?: LureSite; close: () => void }) {
  const { now } = useDashboard();
  const building = getBuilding((site ?? lure)!.building);
  const protocol = site?.service.protocol ?? lure!.blueprint.protocol;
  const title = site?.service.description ?? lure!.blueprint.description;
  const plan = lure && lure.state.status !== "retired" ? lure.state : undefined;

  return (
    <section className="city-panel city-service swap-in" aria-label={`${title} service`}>
      <header className="city-service-head">
        <ProtocolIcon protocol={protocol} size={15} />
        <div>
          <h2>{title}</h2>
          <p>{building.name}</p>
        </div>
        <button type="button" className="icon-btn press" aria-label="Close" onClick={close}>
          <CloseIcon size={14} />
        </button>
      </header>

      {site && (
        <p className="city-service-line">
          {site.lastHit
            ? `${site.sessions} session${site.sessions === 1 ? "" : "s"} today · last ${relativeTime(site.lastHit, now)} ago`
            : "No sessions today"}
        </p>
      )}

      {site?.topThreat && (
        <div className="city-service-threat">
          <SeverityPill severity={site.topThreat.severity} />
          <p>{site.topThreat.verdict}</p>
        </div>
      )}

      {plan && (
        <p className="city-service-lure">
          <b>{plan.status === "planned" ? "Under construction" : "Lure"}</b> · {plan.reason}
        </p>
      )}
    </section>
  );
}
