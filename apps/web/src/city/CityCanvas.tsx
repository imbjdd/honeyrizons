import { useEffect, useRef, type RefObject } from "react";
import type { CityHandle, CityOptions } from "./model";
import type { CityScene } from "./CityScene";

export default function CityCanvas({
  options,
  handle,
}: {
  options: CityOptions;
  handle: RefObject<CityHandle | null>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(options);
  const scene = useRef<CityScene | null>(null);
  latest.current = options;

  useEffect(() => {
    let cancelled = false;
    // Load Three.js separately from the interface. Signs and speech bubbles are drawn on canvases,
    // which never trigger a web font download by themselves, so request those faces explicitly.
    const fonts = Promise.all([document.fonts.load('600 16px "JetBrains Mono"'), document.fonts.load('500 16px "Inter"')]);
    Promise.all([import("./CityScene"), fonts])
      .then(([{ CityScene }]) => {
        if (cancelled || !canvas.current) return;
        try {
          scene.current = new CityScene(canvas.current, latest.current);
          handle.current = scene.current;
        } catch {
          latest.current.onError(
            "This browser could not open the 3D city. Enable WebGL or try another browser.",
          );
        }
      })
      .catch(() => {
        if (!cancelled)
          latest.current.onError(
            "The city could not load. Reload the page to try again.",
          );
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
      handle.current = null;
    };
  }, [handle]);

  useEffect(() => {
    scene.current?.update(options);
  }, [options]);

  return (
    <canvas
      ref={canvas}
      className="city-canvas"
      aria-label="Explore Honeyrizons. Outside, drag to pan and click shops or residents. Inside, use WASD or ZQSD to walk, arrow keys to look, drag to look around, and E to interact. Escape leaves the room."
      tabIndex={0}
      role="application"
    />
  );
}
