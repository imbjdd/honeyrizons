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
    // Load Three.js separately from the interface and wait for fonts used in signs.
    Promise.all([import("./CityScene"), document.fonts.ready])
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
      aria-label="Interactive voxel city. Drag to pan, scroll to zoom, or use the camera and district controls."
      role="img"
    />
  );
}
