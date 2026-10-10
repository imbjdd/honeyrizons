import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/components/analytics-dashboard/context";
import { Segmented } from "@/components/analytics-dashboard/ui";
import { SEVERITY_GLOW } from "./attackers";
import CityCanvas from "./CityCanvas";
import { CityFeed } from "./CityFeed";
import { CityServiceCard } from "./CityServiceCard";
import { CityServiceLabels } from "./CityServiceLabels";
import { CityToolbar, type CityPopover } from "./CityToolbar";
import ExploreOverlay from "./ExploreOverlay";
import type { BuildingId, HoverTarget, Inspection, RoomLocation } from "./explore";
import { useCitySound, useReducedMotion } from "./hooks";
import type { CityHandle, CityOptions } from "./model";
import { useCityActivity } from "./useCityActivity";
import "./city.css";

const PHOTO_FILTERS = [
  { id: "normal", label: "Original" },
  { id: "noir", label: "Noir" },
  { id: "warm", label: "Golden" },
] as const;

type PhotoFilter = (typeof PHOTO_FILTERS)[number]["id"];

/** The honeypot as a living city: each service is a building, each recent attack a person walking to its door. */
export default function CityPage() {
  const { openSession, selected } = useDashboard();
  const city = useRef<CityHandle | null>(null);
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const sound = useCitySound();
  const { sites, attackers, feed, latest, buildingOf } = useCityActivity();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [room, setRoom] = useState<RoomLocation | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [following, setFollowing] = useState<string | null>(null);
  const [nearby, setNearby] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [service, setService] = useState<BuildingId | null>(null);
  const [touring, setTouring] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("normal");
  const [popover, setPopover] = useState<CityPopover>(null);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | undefined>(undefined);

  const announce = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 3500);
  }, []);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const onInspect = useCallback((value: Inspection | null) => {
    setInspection(value);
    if (value) setPopover(null);
  }, []);
  const onRoomChange = useCallback((value: RoomLocation | null) => {
    setRoom(value);
    setPopover(null);
    setTouring(false);
  }, []);
  const onReady = useCallback(() => setReady(true), []);
  const onInteraction = useCallback(() => setTouring(false), []);
  const onPhotoSaved = useCallback(() => announce("Your city photo is downloading."), [announce]);
  const onAttacker = useCallback((id: string) => openSession(id), [openSession]);

  const options = useMemo<CityOptions>(
    () => ({
      paused,
      reducedMotion,
      inputBlocked: !!inspection || !!popover,
      onNearby: setNearby,
      onReady,
      onError: setError,
      onInteraction,
      onPhotoSaved,
      onInspect,
      onRoomChange,
      onFollowChange: setFollowing,
      onHover: setHover,
      onAttacker,
    }),
    [paused, reducedMotion, inspection, popover, onReady, onInteraction, onPhotoSaved, onInspect, onRoomChange, onAttacker],
  );

  // People in the streets follow the honeypot's recent sessions.
  useEffect(() => {
    if (ready) city.current?.setAttackers(attackers);
  }, [attackers, ready]);

  // A new event rings the door of the service it hit, in its severity color.
  useEffect(() => {
    if (ready && latest) city.current?.pulse(latest.building, SEVERITY_GLOW[latest.severity]);
  }, [latest?.key, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // The session open in the details panel is circled in the street.
  useEffect(() => {
    if (ready) city.current?.highlightAttacker(selected);
  }, [selected, ready]);

  const visit = useCallback((building: BuildingId) => {
    setService(building);
    setTouring(false);
    city.current?.focus(building);
  }, []);

  useCityKeyboard({ city, inspection, following, room, popover, photo, setPhoto, setPopover, setPaused, setTouring });

  const camera = {
    zoom: (direction: number) => city.current?.zoom(direction),
    rotate: (direction: number) => {
      city.current?.rotate(direction);
      setTouring(false);
    },
    home: () => {
      city.current?.home();
      setService(null);
      setTouring(false);
    },
    tour: () => {
      const next = !touring;
      setTouring(next);
      city.current?.tour(next);
      setPopover(null);
    },
  };

  const selectedSite = sites.find((s) => s.building === service);

  return (
    <div className="page-content city-page">
      <section
        className={cn("city-stage enter", photo && "is-photo", room && "in-room")}
        style={{ "--i": 1 } as CSSProperties}
        aria-label="Honeyrizons city"
      >
        <div className={`city-world filter-${photoFilter}`}>
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

        {ready && !photo && (
          <>
            <CityToolbar
              room={!!room}
              camera={camera}
              touring={touring}
              tourDisabled={reducedMotion}
              paused={paused}
              togglePause={() => setPaused((v) => !v)}
              sound={sound.enabled}
              toggleSound={() => void sound.toggle().catch(() => announce("Sound is unavailable in this browser."))}
              startPhoto={() => {
                setPhoto(true);
                setPopover(null);
              }}
              popover={popover}
              setPopover={setPopover}
              enterBuilding={(id) => city.current?.enter(id)}
            />
            {!room && <CityServiceLabels city={city} sites={sites} selected={service} select={visit} />}
            {!room && selectedSite && <CityServiceCard site={selectedSite} close={() => setService(null)} enter={() => city.current?.enter(selectedSite.building)} />}
            {!room && <CityFeed items={feed} focus={visit} buildingOf={buildingOf} />}
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

        {photo && (
          <div className="city-photo-bar" role="toolbar" aria-label="Photo mode">
            <Segmented label="Photo filter" options={PHOTO_FILTERS} value={photoFilter} onChange={setPhotoFilter} />
            <button type="button" className="btn btn-primary press" onClick={() => city.current?.capture()}>
              Save photo
            </button>
            <button type="button" className="btn press" onClick={() => setPhoto(false)}>
              Done
            </button>
          </div>
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

/** Keyboard shortcuts while the city page is open. Escape unwinds the most recent layer first. */
function useCityKeyboard(state: {
  city: React.RefObject<CityHandle | null>;
  inspection: Inspection | null;
  following: string | null;
  room: RoomLocation | null;
  popover: CityPopover;
  photo: boolean;
  setPhoto: (value: boolean) => void;
  setPopover: (value: CityPopover) => void;
  setPaused: (update: (value: boolean) => boolean) => void;
  setTouring: (value: boolean) => void;
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
        if (s.photo) s.setPhoto(false);
        else if (s.popover) s.setPopover(null);
        else if (s.inspection) s.city.current?.inspect(null);
        else if (s.following) s.city.current?.follow(null);
        else if (s.room) s.city.current?.exit();
        else {
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
