import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/components/analytics-dashboard/context";
import { SEVERITY_GLOW } from "./attackers";
import CityCanvas from "./CityCanvas";
import { CityPlanner } from "./CityPlanner";
import { CityServiceCard } from "./CityServiceCard";
import { CityServiceLabels } from "./CityServiceLabels";
import { CityToolbar } from "./CityToolbar";
import ExploreOverlay from "./ExploreOverlay";
import type { BuildingId, HoverTarget, Inspection, RoomLocation } from "./explore";
import { useCitySound, useReducedMotion } from "./hooks";
import type { CityHandle, CityOptions } from "./model";
import { useCityActivity, type LureSite } from "./useCityActivity";
import type { ChronicleEvent } from "@honeyrizons/shared";
import "./city.css";

/** The honeypot as a living city: each service is a building, each recent attack a person walking to its door. */
export default function CityPage() {
  const { openSession, selected, chronicle } = useDashboard();
  const city = useRef<CityHandle | null>(null);
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const sound = useCitySound();
  const { sites, attackers, latest, lures, construction } = useCityActivity();

  const [ready, setReady] = useState(false);
  // Opening shot: the city takes over the window while the camera dives in and turns a quarter.
  const [intro, setIntro] = useState(!reducedMotion);
  const [immersive, setImmersive] = useState(false);
  const [error, setError] = useState("");
  const [room, setRoom] = useState<RoomLocation | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [following, setFollowing] = useState<string | null>(null);
  const [nearby, setNearby] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [service, setService] = useState<BuildingId | null>(null);
  const [touring, setTouring] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | undefined>(undefined);

  const announce = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 3500);
  }, []);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const onRoomChange = useCallback((value: RoomLocation | null) => {
    setRoom(value);
    setTouring(false);
  }, []);
  const onReady = useCallback(() => setReady(true), []);
  const onIntroEnd = useCallback(() => setIntro(false), []);

  // Grows into full screen after the first paint, so the dashboard visibly makes room.
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => setImmersive(true));
    return () => cancelAnimationFrame(frame);
  }, [ready]);
  const onInteraction = useCallback(() => setTouring(false), []);
  const onAttacker = useCallback((id: string) => openSession(id), [openSession]);

  const options = useMemo<CityOptions>(
    () => ({
      paused,
      reducedMotion,
      inputBlocked: !!inspection,
      onNearby: setNearby,
      onReady,
      onIntroEnd,
      onError: setError,
      onInteraction,
      onInspect: setInspection,
      onRoomChange,
      onFollowChange: setFollowing,
      onHover: setHover,
      onAttacker,
    }),
    [paused, reducedMotion, inspection, onReady, onIntroEnd, onInteraction, onRoomChange, onAttacker],
  );

  // People in the streets follow the honeypot's recent sessions.
  useEffect(() => {
    if (ready) city.current?.setAttackers(attackers);
  }, [attackers, ready]);

  // A new event rings the door of the service it hit, in its severity color.
  useEffect(() => {
    if (ready && latest) city.current?.pulse(latest.building, SEVERITY_GLOW[latest.severity]);
  }, [latest?.key, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lures the planner decided on but the honeypot does not serve yet stand in scaffolding.
  useEffect(() => {
    if (ready) city.current?.setConstruction(construction);
  }, [construction.join(), ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const plannerNews = useCallback(
    (building: BuildingId, text: string) => {
      city.current?.pulse(building, LURE_GLOW);
      announce(text);
    },
    [announce],
  );
  usePlannerNews(chronicle, ready, lures, plannerNews);

  // The session open in the details panel is circled in the street.
  useEffect(() => {
    if (ready) city.current?.highlightAttacker(selected);
  }, [selected, ready]);

  const visit = useCallback((building: BuildingId) => {
    setService(building);
    setTouring(false);
    city.current?.focus(building);
  }, []);

  useCityKeyboard({ city, inspection, following, room, immersive, setPaused, setTouring, setImmersive });

  const selectedSite = sites.find((s) => s.building === service);
  const selectedLure = lures.find((l) => l.building === service && l.state.status !== "retired");

  return (
    <div className="page-content city-page" data-immersive={immersive}>
      <section
        className={cn("city-stage enter", room && "in-room", intro && "is-intro")}
        style={{ "--i": 1 } as CSSProperties}
        aria-label="Honeyrizons city"
      >
        <div className="city-world">
          <CityCanvas options={options} handle={city} />
        </div>

        {!ready && !error && <p className="city-status shimmer">Building the city…</p>}
        {error && (
          <div className="city-status city-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn press" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        )}

        {ready && (
          <>
            <CityToolbar
              room={!!room}
              home={() => {
                city.current?.home();
                setService(null);
                setTouring(false);
              }}
              tour={() => {
                setTouring(!touring);
                city.current?.tour(!touring);
              }}
              touring={touring}
              tourDisabled={reducedMotion}
              paused={paused}
              togglePause={() => setPaused((v) => !v)}
              sound={sound.enabled}
              toggleSound={() => void sound.toggle().catch(() => announce("Sound is unavailable in this browser."))}
              immersive={immersive}
              toggleImmersive={() => setImmersive((v) => !v)}
            />
            {!room && (
              <CityServiceLabels
                city={city}
                sites={sites}
                construction={lures.filter((l) => l.state.status === "planned")}
                selected={service}
                select={visit}
              />
            )}
            {!room && (selectedSite || selectedLure) && (
              <CityServiceCard site={selectedSite} lure={selectedLure} close={() => setService(null)} />
            )}
            {!room && !inspection && <CityPlanner lures={lures} focus={visit} announce={announce} />}
            <ExploreOverlay
              nearby={nearby}
              room={room}
              inspection={inspection}
              following={following}
              hover={hover}
              city={city}
              close={() => city.current?.inspect(null)}
              announce={announce}
              muted={!sound.enabled || paused || reducedMotion}
            />
          </>
        )}

        {notice && (
          <p className="city-toast swap-in" role="status">
            {notice}
          </p>
        )}
      </section>
    </div>
  );
}

/** Planner events older than this are history, not news. */
const NEWS_MS = 60_000;

/** Gold, like the planner's markers on the timeline. */
const LURE_GLOW = "#ffcf4a";

/** Rings the door and says so when the planner breaks ground, opens a lure or closes one, live. */
function usePlannerNews(
  chronicle: ChronicleEvent[],
  active: boolean,
  lures: LureSite[],
  notify: (building: BuildingId, text: string) => void,
) {
  const seen = useRef<number | null>(null);
  useEffect(() => {
    const newest = chronicle.at(-1)?.at ?? 0;
    // Whatever was already in the chronicle when the city opened is history, not news.
    if (seen.current === null || !active) {
      seen.current = newest;
      return;
    }
    // The chronicle can land after the page opens, so "new to this page" is not enough: it must also be recent.
    const fresh = chronicle.filter((e) => e.at > seen.current! && e.at > Date.now() - NEWS_MS);
    seen.current = Math.max(seen.current, newest);
    for (const e of fresh) {
      const lure = e.type === "lure.planned" || e.type === "lure.retired" ? e.lure : e.type === "service.exposed" ? e.lure : undefined;
      const building = lure ? lures.find((l) => l.blueprint.id === lure)?.building : undefined;
      if (!building) continue;
      if (e.type === "lure.planned") notify(building, `City planner: building ${e.name}. ${e.reason}.`);
      if (e.type === "service.exposed") notify(building, `${e.name} is open. The lure is live.`);
      if (e.type === "lure.retired") notify(building, e.manual ? `${e.name} closed.` : `${e.name} closed: ${e.reason.toLowerCase()}.`);
    }
  }, [chronicle, active, lures, notify]);
}

/** Keyboard shortcuts while the city page is open. Escape unwinds the most recent layer first. */
function useCityKeyboard(state: {
  city: React.RefObject<CityHandle | null>;
  inspection: Inspection | null;
  following: string | null;
  room: RoomLocation | null;
  immersive: boolean;
  setPaused: (update: (value: boolean) => boolean) => void;
  setTouring: (value: boolean) => void;
  setImmersive: (value: boolean) => void;
}) {
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const s = latest.current;
      // The dashboard handles Escape for its own panels first and marks it handled.
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;

      if (event.key === "Escape") {
        if (document.pointerLockElement) return;
        if (s.inspection) s.city.current?.inspect(null);
        else if (s.following) s.city.current?.follow(null);
        else if (s.room) s.city.current?.exit();
        else if (s.immersive) {
          s.setTouring(false);
          s.city.current?.tour(false);
          s.setImmersive(false);
        } else {
          s.setTouring(false);
          s.city.current?.tour(false);
          return;
        }
        event.preventDefault();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "Space" && (target === document.body || target instanceof HTMLCanvasElement)) {
        event.preventDefault();
        s.setPaused((value) => !value);
      }
      const key = event.key.toLowerCase();
      if (key === "h") {
        s.city.current?.home();
        s.setTouring(false);
      }
      if (key === "+" || key === "=") s.city.current?.zoom(1);
      if (key === "-") s.city.current?.zoom(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
