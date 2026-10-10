import { useEffect, useRef, useState } from "react";
import { createDemoEvent, initialDemoEvents, type Theme } from "./model";

export function useDemoCity(paused: boolean) {
  const [events, setEvents] = useState(initialDemoEvents);
  const [total, setTotal] = useState(12_847);
  const index = useRef(24);
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      const event = createDemoEvent(index.current++);
      setEvents((previous) => [event, ...previous].slice(0, 100));
      setTotal((previous) => previous + 1);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [paused]);
  return { events, total };
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReduced(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  return reduced;
}

export type ThemeMode = Theme | "clock" | "cycle";
/** Six minutes per city day. Elapsed time, rather than timer count, drives the clock. */
export function useCityTheme(stopped: boolean) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem("honeyrizons.theme");
      return saved === "day" || saved === "night" || saved === "clock"
        ? saved
        : "cycle";
    } catch {
      return "cycle";
    }
  });
  const [phase, setPhase] = useState(10 / 24);
  const [clockPhase, setClockPhase] = useState(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60) / 24;
  });
  useEffect(() => {
    if (stopped || mode !== "cycle") return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      // Freeze while the page is hidden, just like walking and traffic.
      if (!document.hidden)
        setPhase(
          (previous) => (previous + Math.min((now - last) / 1000, 2) / 360) % 1,
        );
      last = now;
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode, stopped]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setClockPhase((now.getHours() + now.getMinutes() / 60) / 24);
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);
  const dayPhase =
    mode === "cycle"
      ? phase
      : mode === "clock"
        ? clockPhase
        : mode === "day"
          ? 0.5
          : 0;
  const theme: Theme =
    dayPhase >= 7 / 24 && dayPhase < 19 / 24 ? "day" : "night";
  const minutes = Math.floor(dayPhase * 1440);
  const cityTime = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  function selectMode(next: ThemeMode) {
    setMode(next);
    try {
      localStorage.setItem("honeyrizons.theme", next);
    } catch {
      /* Storage is optional. */
    }
  }
  return { theme, mode, dayPhase, cityTime, selectMode };
}

export function useCitySound() {
  const [enabled, setEnabled] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const nodes = useRef<AudioScheduledSourceNode[]>([]);
  useEffect(
    () => () => {
      nodes.current.forEach((node) => node.stop());
      void context.current?.close();
    },
    [],
  );

  async function toggle() {
    if (!context.current) {
      const audio = new AudioContext();
      context.current = audio;
      const master = audio.createGain();
      master.gain.value = 0;
      master.connect(audio.destination);
      gain.current = master;
      // Quiet wind/traffic noise, filtered to avoid a harsh white-noise hiss.
      const buffer = audio.createBuffer(
        1,
        audio.sampleRate * 3,
        audio.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * 0.02) / 1.02;
        data[i] = previous * 3.5;
      }
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 400;
      source.connect(filter);
      filter.connect(master);
      source.start();
      nodes.current.push(source);
      for (const frequency of [130.81, 196]) {
        const oscillator = audio.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        const layer = audio.createGain();
        layer.gain.value = 0.025;
        oscillator.connect(layer);
        layer.connect(master);
        oscillator.start();
        nodes.current.push(oscillator);
      }
    }
    await context.current.resume();
    const next = !enabled;
    gain.current!.gain.setTargetAtTime(
      next ? 0.24 : 0,
      context.current.currentTime,
      0.3,
    );
    setEnabled(next);
  }
  return { enabled, toggle };
}
