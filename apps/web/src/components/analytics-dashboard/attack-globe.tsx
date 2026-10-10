import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Position } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import countriesTopo from "world-atlas/countries-110m.json";
import { protocolColor } from "@honeyrizons/shared";
import { countryName, type AnalyticsOrigin } from "./data";
import { flagUrl } from "./flag";

type Ring = Position[];

// world-atlas has a few collapsed rings (e.g. one North Korea part is a single repeated point) that make h3 throw.
const isRealPolygon = (polygon: Ring[]) => new Set(polygon[0].map((p) => p.join(","))).size >= 3;

const COUNTRIES = (
  feature(countriesTopo as unknown as Topology, (countriesTopo as unknown as Topology<{ countries: GeometryCollection }>).objects.countries) as FeatureCollection
).features.flatMap((f): Feature[] => {
  const g = f.geometry;
  if (g.type === "Polygon") return isRealPolygon(g.coordinates) ? [f] : [];
  if (g.type === "MultiPolygon") return [{ ...f, geometry: { ...g, coordinates: g.coordinates.filter(isRealPolygon) } }];
  return [f];
});

/** Origins seen in the last few minutes get a pulsing ring. */
const RECENT_MS = 10 * 60_000;

type Props = {
  origins: AnalyticsOrigin[];
  home: { lat: number; lon: number };
  accent: string;
  now: number;
  height: number;
};

type Spot = { lat: number; lng: number; color: string; radius: number; label: string; home?: boolean };

const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(a * 255)
    .toString(16)
    .padStart(2, "0")}`;

function tooltip(o: AnalyticsOrigin) {
  const flag = flagUrl(o.country);
  const place = `${o.city ? `${o.city}, ` : ""}${countryName(o.country)}`;
  return `${flag ? `<img src="${flag}" alt="" class="globe-tip-flag" />` : ""}<span><strong>${place}</strong><br/>${o.events} events · ${o.ips} IP${o.ips > 1 ? "s" : ""}</span>`;
}

export default function AttackGlobe({ origins, home, accent, now, height }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const material = useMemo(
    () => new MeshPhongMaterial({ color: "#0f1012", emissive: "#121316", emissiveIntensity: 0.6, shininess: 4 }),
    [],
  );

  const max = Math.max(1, ...origins.map((o) => o.events));

  const points = useMemo<Spot[]>(
    () => [
      ...origins.map((o) => ({
        lat: o.lat,
        lng: o.lon,
        color: protocolColor(o.protocol),
        radius: 0.25 + Math.sqrt(o.events / max) * 0.6,
        label: tooltip(o),
      })),
      { lat: home.lat, lng: home.lon, color: accent, radius: 0.55, label: "<strong>Honeypot</strong>", home: true },
    ],
    [origins, home, accent, max],
  );

  const arcs = useMemo(
    () =>
      origins.map((o) => ({
        startLat: o.lat,
        startLng: o.lon,
        endLat: home.lat,
        endLng: home.lon,
        color: [alpha(protocolColor(o.protocol), 0.9), alpha(accent, 0.5)],
        stroke: 0.25 + (o.events / max) * 0.5,
      })),
    [origins, home, accent, max],
  );

  const rings = useMemo(
    () => [
      ...origins.filter((o) => now - o.lastSeen < RECENT_MS).map((o) => ({ lat: o.lat, lng: o.lon, color: protocolColor(o.protocol) })),
      { lat: home.lat, lng: home.lon, color: accent },
    ],
    [origins, home, accent, now],
  );

  // Slow auto-rotation; wheel zoom stays off so the page keeps scrolling over the globe.
  function onReady() {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.enableZoom = false;
    g.pointOfView({ lat: home.lat - 10, lng: home.lon + 25, altitude: 1.65 }, 0);
  }

  useEffect(() => {
    globeRef.current?.pointOfView({ lat: home.lat - 10, lng: home.lon + 25 }, 1200);
  }, [home.lat, home.lon]);

  return (
    <div ref={wrapRef} className="globe-wrap" style={{ height }}>
      {width > 0 && (
        <Globe
          ref={globeRef}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={material}
          showAtmosphere
          atmosphereColor={accent}
          atmosphereAltitude={0.16}
          onGlobeReady={onReady}
          hexPolygonsData={COUNTRIES}
          hexPolygonResolution={3}
          hexPolygonMargin={0.45}
          hexPolygonUseDots
          hexPolygonColor={() => "rgba(255,255,255,0.22)"}
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointRadius="radius"
          pointAltitude={(d) => ((d as Spot).home ? 0.03 : 0.012)}
          pointLabel={(d) => `<div class="globe-tip">${(d as Spot).label}</div>`}
          pointsTransitionDuration={600}
          arcsData={arcs}
          arcColor="color"
          arcStroke="stroke"
          arcAltitudeAutoScale={0.45}
          arcDashLength={0.35}
          arcDashGap={0.9}
          arcDashInitialGap={() => Math.random()}
          arcDashAnimateTime={2600}
          arcsTransitionDuration={600}
          ringsData={rings}
          ringColor={(d: object) => (t: number) => alpha((d as { color: string }).color, Math.max(0, 1 - t))}
          ringMaxRadius={4}
          ringPropagationSpeed={2.2}
          ringRepeatPeriod={1400}
        />
      )}
    </div>
  );
}
