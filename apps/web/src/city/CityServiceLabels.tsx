import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { SEVERITY_GLOW } from "./attackers";
import type { BuildingId } from "./explore";
import type { CityHandle } from "./model";
import type { ServiceSite } from "./useCityActivity";

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
  selected,
  select,
}: {
  city: RefObject<CityHandle | null>;
  sites: ServiceSite[];
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
            className={cn("city-label", selected === site.building && "is-selected", threat === "critical" && "is-critical")}
            style={{ "--glow": threat ? SEVERITY_GLOW[threat] : "rgba(255,255,255,0.35)" } as CSSProperties}
            onClick={() => select(site.building)}
            aria-pressed={selected === site.building}
          >
            <i aria-hidden="true" />
            <span>{serviceName(site)}</span>
            <b>{site.sessions}</b>
          </button>
        );
      })}
    </div>
  );
}
