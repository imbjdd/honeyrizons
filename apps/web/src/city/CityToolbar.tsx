import type { ReactNode } from "react";
import { Compass, Home, Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

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

/** Camera and sound. Zoom and rotation are on the mouse (scroll, right drag) and keyboard (+, −). */
export function CityToolbar(props: {
  room: boolean;
  home: () => void;
  tour: () => void;
  touring: boolean;
  tourDisabled: boolean;
  paused: boolean;
  togglePause: () => void;
  sound: boolean;
  toggleSound: () => void;
  immersive: boolean;
  toggleImmersive: () => void;
}) {
  return (
    <div className="city-toolbar">
      <div className="city-tools" role="toolbar" aria-label="City controls">
        {props.room ? (
          <Tool label={props.paused ? "Resume" : "Pause"} active={props.paused} onClick={props.togglePause}>
            {props.paused ? <Play size={14} /> : <Pause size={14} />}
          </Tool>
        ) : (
          <>
            <Tool label="Honey square (H)" onClick={props.home}>
              <Home size={14} />
            </Tool>
            <Tool label="City tour" active={props.touring} disabled={props.tourDisabled} onClick={props.tour}>
              <Compass size={15} />
            </Tool>
          </>
        )}
        <Tool label={props.sound ? "Mute" : "Sound"} active={props.sound} onClick={props.toggleSound}>
          {props.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </Tool>
        <Tool label={props.immersive ? "Show dashboard (Esc)" : "Full screen"} onClick={props.toggleImmersive}>
          {props.immersive ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </Tool>
      </div>
    </div>
  );
}
