import { useEffect, useMemo, useState } from "react";
import { type HoneypotEvent, hasCredentials, protocolColor, sourceIp, summary, topN } from "@honeyrizons/shared";

const MAX_EVENTS = 10000;

function useEvents() {
  const [events, setEvents] = useState<HoneypotEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let source: EventSource | undefined;
    let cancelled = false;

    fetch("/api/events?limit=" + MAX_EVENTS)
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

  return { events, connected };
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString();
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="card kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}

function ActivityChart({ events }: { events: HoneypotEvent[] }) {
  const buckets = useMemo(() => {
    const minutes = 60;
    const now = Date.now();
    const start = now - minutes * 60_000;
    const counts = new Array(minutes).fill(0);
    for (const e of events) {
      const t = Date.parse(e.DateTime);
      if (t < start) continue;
      const i = Math.min(minutes - 1, Math.floor((t - start) / 60_000));
      counts[i]++;
    }
    return counts;
  }, [events]);
  const max = Math.max(1, ...buckets);

  return (
    <div className="card">
      <div className="card-title">
        Activité <span className="muted">— 60 dernières minutes</span>
      </div>
      <div className="chart">
        {buckets.map((c, i) => (
          <div key={i} className="bar" title={`${c} events (il y a ${60 - i} min)`}>
            <div style={{ height: `${(c / max) * 100}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TopList({ title, rows, mono }: { title: string; rows: [string, number][]; mono?: boolean }) {
  const max = rows[0]?.[1] ?? 1;
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {rows.length === 0 && <div className="empty">Rien pour l'instant</div>}
      <ul className="toplist">
        {rows.map(([k, v]) => (
          <li key={k}>
            <div className="toplist-fill" style={{ width: `${(v / max) * 100}%` }} />
            <span className={mono ? "mono truncate" : "truncate"} title={k}>
              {k}
            </span>
            <span className="count">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProtocolBreakdown({ events }: { events: HoneypotEvent[] }) {
  const rows = topN(events, (e) => e.Protocol, 10);
  const total = events.length || 1;
  return (
    <div className="card">
      <div className="card-title">Protocoles</div>
      <div className="stack">
        {rows.map(([p, c]) => (
          <div key={p} style={{ width: `${(c / total) * 100}%`, background: protocolColor(p) }} title={`${p}: ${c}`} />
        ))}
      </div>
      <div className="legend">
        {rows.map(([p, c]) => (
          <span key={p}>
            <i style={{ background: protocolColor(p) }} />
            {p} <b>{c}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function EventDetail({ event, onClose }: { event: HoneypotEvent; onClose: () => void }) {
  const fields = Object.entries(event).filter(
    ([, v]) => v !== "" && v !== null && !(typeof v === "object" && Object.keys(v).length === 0),
  );
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <span className="pill" style={{ background: protocolColor(event.Protocol) }}>
            {event.Protocol}
          </span>
          <h2>{event.Msg}</h2>
          <button onClick={onClose}>✕</button>
        </header>
        <dl>
          {fields.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className="mono">{typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}

export default function App() {
  const { events, connected } = useEvents();
  const [protocol, setProtocol] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<HoneypotEvent | null>(null);

  const protocols = useMemo(() => [...new Set(events.map((e) => e.Protocol))].sort(), [events]);

  const stats = useMemo(() => {
    const ips = new Set(events.map(sourceIp).filter(Boolean));
    const sessions = new Set(events.filter((e) => e.ID).map((e) => e.ID));
    const creds = events.filter(hasCredentials);
    return { ips: ips.size, sessions: sessions.size, creds: creds.length };
  }, [events]);

  const feed = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => protocol === "ALL" || e.Protocol === protocol)
      .filter((e) => !q || JSON.stringify(e).toLowerCase().includes(q))
      .slice(-300)
      .reverse();
  }, [events, protocol, query]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🍯</span>
          <div>
            <h1>Honeyrizons</h1>
            <span className="muted">Beelzebub honeypot dashboard</span>
          </div>
        </div>
        <div className={connected ? "status live" : "status"}>
          <i />
          {connected ? "Live" : "Déconnecté"}
        </div>
      </header>

      <section className="kpis">
        <Kpi label="Events" value={events.length} />
        <Kpi label="IPs uniques" value={stats.ips} />
        <Kpi label="Sessions" value={stats.sessions} />
        <Kpi label="Credentials capturés" value={stats.creds} accent="#f5a524" />
      </section>

      <section className="row">
        <ActivityChart events={events} />
        <ProtocolBreakdown events={events} />
      </section>

      <section className="grid3">
        <TopList title="Top IPs" rows={topN(events, sourceIp)} mono />
        <TopList
          title="Top credentials"
          rows={topN(events.filter(hasCredentials), (e) => `${e.User}:${e.Password}`)}
          mono
        />
        <TopList
          title="Top commandes / URIs"
          rows={topN(
            events.filter((e) => e.Status !== "Start" && e.Status !== "End"),
            summary,
          )}
          mono
        />
      </section>

      <section className="card feed">
        <div className="feed-head">
          <div className="card-title">Flux d'events</div>
          <div className="filters">
            {["ALL", ...protocols].map((p) => (
              <button
                key={p}
                className={p === protocol ? "chip active" : "chip"}
                style={p !== "ALL" && p === protocol ? { background: protocolColor(p) } : undefined}
                onClick={() => setProtocol(p)}
              >
                {p}
              </button>
            ))}
            <input placeholder="Rechercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Heure</th>
                <th>Proto</th>
                <th>Service</th>
                <th>Source</th>
                <th>Status</th>
                <th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {feed.map((e, i) => (
                <tr key={`${e.ID}-${e.DateTime}-${i}`} onClick={() => setSelected(e)}>
                  <td className="mono muted">{formatTime(e.DateTime)}</td>
                  <td>
                    <span className="pill" style={{ background: protocolColor(e.Protocol) }}>
                      {e.Protocol}
                    </span>
                  </td>
                  <td className="truncate">{e.Description}</td>
                  <td className="mono">{sourceIp(e)}</td>
                  <td className="muted">{e.Status}</td>
                  <td className="mono truncate detail">{summary(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {feed.length === 0 && (
            <div className="empty big">
              En attente d'attaquants… Essaie <code>ssh root@localhost -p 2222</code> ou{" "}
              <code>curl localhost:8080/wp-login.php</code>
            </div>
          )}
        </div>
      </section>

      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
