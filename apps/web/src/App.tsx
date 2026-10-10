import { useEffect, useMemo, useState } from "react";
import type { HoneypotEvent, HoneypotService, IntelPatch, IntelSnapshot } from "@honeyrizons/shared";
import { AnalyticsDashboard } from "@/components/block/analytics-dashboard";
import { buildDashboardData } from "@/components/analytics-dashboard/data";
import { usePageRoute } from "./route";

const MAX_EVENTS = 10000;

const EMPTY_INTEL: IntelSnapshot = {
  sessions: {},
  analyses: {},
  brief: null,
  stats: { enabled: false, model: "", analyzed: 0, triaged: 0, queued: 0, budgetUsed: 0, budgetPerHour: 0 },
};

function applyPatch(base: IntelSnapshot, patch: IntelPatch): IntelSnapshot {
  return {
    sessions: patch.sessions ? { ...base.sessions, ...patch.sessions } : base.sessions,
    analyses: patch.analyses ? { ...base.analyses, ...patch.analyses } : base.analyses,
    brief: patch.brief !== undefined ? patch.brief : base.brief,
    stats: patch.stats ?? base.stats,
  };
}

function useHoneypot() {
  const [events, setEvents] = useState<HoneypotEvent[]>([]);
  const [services, setServices] = useState<HoneypotService[]>([]);
  const [logPath, setLogPath] = useState<string>();
  const [home, setHome] = useState({ lat: 48.8566, lon: 2.3522 });
  const [intel, setIntel] = useState<IntelSnapshot>(EMPTY_INTEL);
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
        fetch("/api/intel")
          .then((r) => r.json())
          .then((snapshot: IntelSnapshot) => {
            if (cancelled) return;
            // Patches that arrived over SSE while the snapshot was loading are newer, so they win.
            setIntel((early) => ({
              sessions: { ...snapshot.sessions, ...early.sessions },
              analyses: { ...snapshot.analyses, ...early.analyses },
              brief: early.brief ?? snapshot.brief,
              stats: early.stats.model ? early.stats : snapshot.stats,
            }));
          })
          .catch(() => {});
        source = new EventSource("/api/stream");
        source.addEventListener("intel", (msg) => {
          const patch = JSON.parse((msg as MessageEvent<string>).data) as IntelPatch;
          setIntel((prev) => applyPatch(prev, patch));
        });
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

  return { events, services, logPath, home, intel, connected };
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
  const { events, services, logPath, home, intel, connected } = useHoneypot();
  const [page, setPage] = usePageRoute();
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
        intel={intel}
        page={page}
        onPageChange={setPage}
        brand={{ name: "Honeyrizons", logo: <span style={{ fontSize: 18, lineHeight: 1 }}>🍯</span> }}
        defaultAccent="amber"
      />
    </div>
  );
}
