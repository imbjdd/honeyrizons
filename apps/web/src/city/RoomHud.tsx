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
        className={`city-walk-${action}`}
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
    <div className={`city-walk${blocked ? " is-blocked" : ""}`}>
      <div
        className={`city-crosshair${nearby ? " has-target" : ""}`}
        aria-hidden="true"
      >
        <i />
      </div>
      <div className="city-panel city-walk-hint">
        <span>
          <kbd>W A S D</kbd> walk
        </span>
        <span>Drag to look</span>
        <span>
          <kbd>E</kbd> interact
        </span>
        <button
          type="button"
          className="btn press"
          onClick={() => city.current?.lockLook()}
          disabled={blocked}
          title="Free mouse look. Escape releases the mouse."
        >
          <MousePointer2 size={14} /> Free look
        </button>
      </div>
      <div className="city-walk-pad" aria-label="Walking controls">
        {control("forward", "Walk forward", <ArrowUp size={22} />)}
        {control("left", "Walk left", <ArrowLeft size={22} />)}
        {control("backward", "Walk backward", <ArrowDown size={22} />)}
        {control("right", "Walk right", <ArrowRight size={22} />)}
      </div>
      {nearby && !blocked && (
        <button
          type="button"
          className="city-panel city-nearby"
          onClick={() => city.current?.interact()}
        >
          <kbd>E</kbd>
          <span>{nearby}</span>
        </button>
      )}
      <span className="city-touch-hint">Drag the room to look around</span>
    </div>
  );
}
