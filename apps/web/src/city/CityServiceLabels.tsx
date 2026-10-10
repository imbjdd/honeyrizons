import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { SEVERITY_GLOW } from "./attackers";
import type { BuildingId } from "./explore";
import type { CityHandle } from "./model";
import type { LureSite, ServiceSite } from "./useCityActivity";

/** Matches the scaffolding in construction.ts. */
const BUILDING_GLOW = "#ff9f1c";

/** Short service names for the floating labels. */
export function serviceName(site: ServiceSite) {
  const { protocol, description } = site.service;
  if (protocol === "TCP") return description.split(" ")[0];
  if (protocol === "HTTP") return description.split(" ")[0];
  return protocol;
}

/** A label above each service building; it follows the camera every frame without re-rendering React. */
export function CityServiceLabels({
  city,
  sites,
  construction,
  selected,
  select,
}: {
  city: RefObject<CityHandle | null>;
  sites: ServiceSite[];
  /** Lures the planner is building: labelled on their scaffolding until they open. */
  construction: LureSite[];
  selected: BuildingId | null;
  select: (building: BuildingId) => void;
}) {
  const refs = useRef(new Map<BuildingId, HTMLButtonElement>());

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      for (const [building, el] of refs.current) {
        const point = city.current?.project(building);
        const visibility = point ? "visible" : "hidden";
        if (el.style.visibility !== visibility) el.style.visibility = visibility;
        if (point) {
          // Whole pixels keep the text crisp and skip style writes while the camera is still.
          // Tall towers project above the stage; keep their label just inside the top edge.
          const transform = `translate(-50%, -100%) translate(${Math.round(point.x)}px, ${Math.round(Math.max(point.y, 70))}px)`;
          if (el.style.transform !== transform) el.style.transform = transform;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [city]);

  return (
    <div className="city-labels" aria-label="Services">
      {sites.map((site) => {
        const threat = site.topThreat?.severity;
        return (
          <button
            key={site.building}
            type="button"
            ref={(el) => {
              if (el) refs.current.set(site.building, el);
              else refs.current.delete(site.building);
            }}
            className={cn("city-label", selected === site.building && "is-selected")}
            data-status={site.state.status}
            data-lure={site.state.lure ? "" : undefined}
            title={site.state.lure ? "Opened by the city planner" : undefined}
            style={{ "--glow": threat ? SEVERITY_GLOW[threat] : "rgba(255,255,255,0.35)" } as CSSProperties}
            onClick={() => select(site.building)}
            aria-pressed={selected === site.building}
          >
            <i aria-hidden="true" />
            <span>{serviceName(site)}</span>
            {site.state.status === "besieged" ? <em>surge</em> : <b>{site.sessions}</b>}
          </button>
        );
      })}
      {construction.map((lure) => (
        <button
          key={lure.building}
          type="button"
          ref={(el) => {
            if (el) refs.current.set(lure.building, el);
            else refs.current.delete(lure.building);
          }}
          className={cn("city-label", selected === lure.building && "is-selected")}
          data-status="building"
          style={{ "--glow": BUILDING_GLOW } as CSSProperties}
          title={lure.state.reason}
          onClick={() => select(lure.building)}
          aria-pressed={selected === lure.building}
        >
          <i aria-hidden="true" />
          <span>{lure.blueprint.name}</span>
          <em>building</em>
        </button>
      ))}
    </div>
  );
}
