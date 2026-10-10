import { useEffect, type ReactNode, type RefObject } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  MousePointer2,
} from "lucide-react";
import type { CityHandle } from "./model";
import type { WalkAction } from "./RoomController";

export default function RoomHud({
  city,
  nearby,
  blocked,
}: {
  city: RefObject<CityHandle | null>;
  nearby: string | null;
  blocked: boolean;
}) {
  useEffect(
    () => () => {
      ["forward", "backward", "left", "right"].forEach((action) =>
        city.current?.move(action as WalkAction, false),
      );
    },
    [city],
  );
  function control(action: WalkAction, label: string, icon: ReactNode) {
    return (
      <button
        className={`walk-${action}`}
        aria-label={label}
        disabled={blocked}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          city.current?.move(action, true);
        }}
        onPointerUp={() => city.current?.move(action, false)}
        onPointerCancel={() => city.current?.move(action, false)}
        onLostPointerCapture={() => city.current?.move(action, false)}
        onBlur={() => city.current?.move(action, false)}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            city.current?.move(action, true);
          }
        }}
        onKeyUp={() => city.current?.move(action, false)}
      >
        {icon}
      </button>
    );
  }
  return (
    <div className={`room-game-hud${blocked ? " is-blocked" : ""}`}>
      <div
        className={`room-crosshair${nearby ? " has-target" : ""}`}
        aria-hidden="true"
      >
        <i />
      </div>
      <div className="walk-hint glass">
        <span>
          <kbd>W A S D</kbd> walk
        </span>
        <span>Drag to look</span>
        <span>
          <kbd>E</kbd> interact
        </span>
        <button
          onClick={() => city.current?.lockLook()}
          disabled={blocked}
          title="Free mouse look. Escape releases the mouse."
        >
          <MousePointer2 size={14} /> Free look
        </button>
      </div>
      <div className="walk-pad" aria-label="Walking controls">
        {control("forward", "Walk forward", <ArrowUp size={22} />)}
        {control("left", "Walk left", <ArrowLeft size={22} />)}
        {control("backward", "Walk backward", <ArrowDown size={22} />)}
        {control("right", "Walk right", <ArrowRight size={22} />)}
      </div>
      {nearby && !blocked && (
        <button
          className="nearby-action glass"
          onClick={() => city.current?.interact()}
        >
          <kbd>E</kbd>
          <span>{nearby}</span>
        </button>
      )}
      <span className="touch-look-hint">Drag the room to look around</span>
    </div>
  );
}
