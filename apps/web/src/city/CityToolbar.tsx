import type { ReactNode } from "react";
import { Camera, Compass, DoorOpen, HelpCircle, Home, Minus, Pause, Play, Plus, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildings, type BuildingId } from "./explore";

export type CityPopover = "buildings" | "help" | null;

type Camera = { zoom: (d: number) => void; rotate: (d: number) => void; home: () => void; tour: () => void };

function Tool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn("icon-btn press has-tip tip-below tip-end city-tool", active && "is-active")}
      data-tip={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const SHORTCUTS = [
  ["Drag", "Move around"],
  ["Right drag", "Rotate"],
  ["Scroll", "Zoom"],
  ["Click", "Open an attacker's session, meet a resident or enter a building"],
  ["H", "Back to Honey square"],
  ["Space", "Pause the city"],
  ["W A S D", "Walk inside a building"],
  ["E", "Interact"],
  ["Esc", "Step back"],
] as const;

export function CityToolbar(props: {
  room: boolean;
  camera: Camera;
  touring: boolean;
  tourDisabled: boolean;
  paused: boolean;
  togglePause: () => void;
  sound: boolean;
  toggleSound: () => void;
  startPhoto: () => void;
  popover: CityPopover;
  setPopover: (value: CityPopover) => void;
  enterBuilding: (id: BuildingId) => void;
}) {
  const { room, camera, popover, setPopover } = props;
  const toggle = (next: Exclude<CityPopover, null>) => setPopover(popover === next ? null : next);

  return (
    <div className="city-toolbar">
      <div className="city-tools" role="toolbar" aria-label="City controls">
        {!room && (
          <>
            <Tool label="Zoom in (+)" onClick={() => camera.zoom(1)}>
              <Plus size={15} />
            </Tool>
            <Tool label="Zoom out (−)" onClick={() => camera.zoom(-1)}>
              <Minus size={15} />
            </Tool>
            <Tool label="Turn left" onClick={() => camera.rotate(-1)}>
              <RotateCcw size={14} />
            </Tool>
            <Tool label="Turn right" onClick={() => camera.rotate(1)}>
              <RotateCw size={14} />
            </Tool>
            <Tool label="Honey square (H)" onClick={camera.home}>
              <Home size={14} />
            </Tool>
            <i className="city-tools-sep" aria-hidden="true" />
          </>
        )}
        {room ? (
          <Tool label={props.paused ? "Resume" : "Pause"} active={props.paused} onClick={props.togglePause}>
            {props.paused ? <Play size={14} /> : <Pause size={14} />}
          </Tool>
        ) : (
          <Tool label="City tour" active={props.touring} disabled={props.tourDisabled} onClick={camera.tour}>
            <Compass size={15} />
          </Tool>
        )}
        <Tool label="Photo mode" onClick={props.startPhoto}>
          <Camera size={15} />
        </Tool>
        <Tool label={props.sound ? "Mute" : "Sound"} active={props.sound} onClick={props.toggleSound}>
          {props.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </Tool>
        <i className="city-tools-sep" aria-hidden="true" />
        {!room && (
          <Tool label="Buildings" active={popover === "buildings"} onClick={() => toggle("buildings")}>
            <DoorOpen size={15} />
          </Tool>
        )}
        <Tool label="Controls" active={popover === "help"} onClick={() => toggle("help")}>
          <HelpCircle size={15} />
        </Tool>
      </div>

      {popover === "buildings" && !room && (
        <section className="city-popover swap-in" aria-label="Buildings">
          <p className="ai-label">Step inside · {buildings.length} buildings</p>
          <ul className="city-building-list">
            {buildings.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => props.enterBuilding(b.id)}>
                  <i style={{ background: b.color }} aria-hidden="true" />
                  <span>{b.name}</span>
                  <small>{b.floors.length > 1 ? `${b.floors.length} floors` : b.floors[0].name}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {popover === "help" && (
        <section className="city-popover swap-in" aria-label="Controls">
          <p className="ai-label">Controls</p>
          <dl className="city-shortcuts">
            {SHORTCUTS.map(([key, action]) => (
              <div key={key}>
                <dt>
                  <kbd>{key}</kbd>
                </dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
