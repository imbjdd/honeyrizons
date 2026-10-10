import { useEffect, useMemo, useState } from "react";
import type { HoneypotEvent, HoneypotService } from "@honeyrizons/shared";
import { AnalyticsDashboard } from "@/components/block/analytics-dashboard";
import { buildDashboardData } from "@/components/analytics-dashboard/data";

const MAX_EVENTS = 10000;

function useHoneypot() {
  const [events, setEvents] = useState<HoneypotEvent[]>([]);
  const [services, setServices] = useState<HoneypotService[]>([]);
  const [logPath, setLogPath] = useState<string>();
  const [home, setHome] = useState({ lat: 48.8566, lon: 2.3522 });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let source: EventSource | undefined;
    let cancelled = false;

    fetch("/api/services")
      .then((r) => r.json())
      .then((s: HoneypotService[]) => !cancelled && setServices(s))
      .catch(() => {});
    fetch("/api/health")
      .then((r) => r.json())
      .then((h: { logPath: string; location?: { lat: number; lon: number } }) => {
        if (cancelled) return;
        setLogPath(h.logPath);
        if (h.location) setHome(h.location);
      })
      .catch(() => {});

    fetch(`/api/events?limit=${MAX_EVENTS}`)
      .then((r) => r.json())
      .then((initial: HoneypotEvent[]) => {
        if (cancelled) return;
        setEvents(initial);
        source = new EventSource("/api/stream");
        source.onopen = () => setConnected(true);
        source.onerror = () => setConnected(false);
        source.onmessage = (msg) => {
          const e = JSON.parse(msg.data) as HoneypotEvent;
          setEvents((prev) => {
            const next = prev.length >= MAX_EVENTS ? prev.slice(1) : prev.slice();
            next.push(e);
            return next;
          });
        };
      })
      .catch(() => setConnected(false));

    return () => {
      cancelled = true;
      source?.close();
    };
  }, []);

  return { events, services, logPath, home, connected };
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export default function App() {
  const { events, services, logPath, home, connected } = useHoneypot();
  const tick = useNow(30_000);
  // Recompute against the latest event too, so new activity shows up immediately.
  const now = Math.max(tick, events.length ? Date.parse(events[events.length - 1].DateTime) : 0);
  const data = useMemo(() => buildDashboardData(events, services, now), [events, services, now]);

  return (
    <div style={{ height: "100dvh" }}>
      <AnalyticsDashboard
        data={data}
        now={now}
        status={{ connected, logPath, home, totalEvents: events.length }}
        brand={{ name: "Honeyrizons", logo: <span style={{ fontSize: 18, lineHeight: 1 }}>🍯</span> }}
        defaultAccent="amber"
      />
    </div>
  );
}
