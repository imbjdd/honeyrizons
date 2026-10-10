import { lazy, Suspense, useId, useState, type CSSProperties } from "react";
import { ACCENTS, useDashboard, type AnalyticsDashboardAccent } from "./context";
import {
  countryName,
  relativeTime,
  sessionTitle,
  type AnalyticsActivity,
  type AnalyticsAttacker,
  type AnalyticsCountry,
  type AnalyticsKpi,
  type AnalyticsKpiIcon,
  type AnalyticsProtocol,
  type AnalyticsService,
  type AnalyticsSession,
  type RangeId,
} from "./data";
import { ArrowRightIcon, CheckIcon, KeyIcon, PulseIcon, SearchIcon, ServerIcon, TerminalIcon, TrendIcon, UsersIcon } from "./icons";
import { CountryFlag } from "./flag";
import { Digits, formatCount, IpAvatar, ProtocolIcon, Segmented, SessionRow, Sparkline, StatusPill } from "./ui";

/* ───────────── Overview ───────────── */

const KPI_ICONS: Record<AnalyticsKpiIcon, typeof PulseIcon> = {
  events: PulseIcon,
  attackers: UsersIcon,
  sessions: TerminalIcon,
  creds: KeyIcon,
};

const EMPTY_ACTIVITY: AnalyticsActivity = { labels: [], series: {} };

// three.js is heavy, so the globe loads after the rest of the dashboard.
const AttackGlobe = lazy(() => import("./attack-globe"));

export function OverviewPage() {
  const { data, selected, openSession, navigate, status, accent, now } = useDashboard();
  const id = useId();
  const [range, setRange] = useState<RangeId>("day");
  const caption = data.ranges.find((r) => r.id === range)?.caption;
  const recent = data.sessions.slice(0, 5);
  const activity = data.activity[range] ?? EMPTY_ACTIVITY;

  return (
    <div className="page-content">
      <header className="page-head enter" style={{ "--i": 1 } as CSSProperties}>
        <div className="page-head-text">
          <h1 className="page-title">Overview</h1>
          <p className="page-sub">
            <span key={range} className="swap-in">
              {caption}
            </span>
          </p>
        </div>
        <Segmented label="Time range" options={data.ranges} value={range} onChange={setRange} />
      </header>

      <ul className="stats" aria-label="Key metrics">
        {(data.kpis[range] ?? []).map((k, i) => (
          <KpiCard key={k.id} kpi={k} range={range} index={i} />
        ))}
      </ul>

      <section className="card map-card enter" style={{ "--i": 2.8 } as CSSProperties} aria-labelledby={`${id}-map`}>
        <header className="card-head">
          <h2 id={`${id}-map`} className="card-title">
            Attack origins
          </h2>
          <span className="map-note">
            {data.origins[range]?.length ?? 0} locations · {Math.round((data.located[range] ?? 0) * 100)}% of events geolocated
          </span>
        </header>
        <div className="map-layout">
          <Suspense fallback={<div className="globe-wrap globe-loading" style={{ height: 380 }} />}>
            <AttackGlobe origins={data.origins[range] ?? []} home={status.home} accent={ACCENTS[accent].ui} now={now} height={380} />
          </Suspense>
          <CountryList countries={data.countries[range] ?? []} />
        </div>
      </section>

      <div className="overview-grid">
        <section className="card enter" style={{ "--i": 3 } as CSSProperties} aria-labelledby={`${id}-activity`}>
          <header className="card-head">
            <h2 id={`${id}-activity`} className="card-title">
              Activity by protocol
            </h2>
            <ul className="legend" aria-label="Protocols">
              {data.protocols.map((p) => (
                <li key={p.id}>
                  <i style={{ "--c": p.color } as CSSProperties} aria-hidden="true" />
                  {p.id}
                </li>
              ))}
            </ul>
          </header>
          <ActivityChart key={range} data={activity} protocols={data.protocols} />
        </section>

        <section className="card enter" style={{ "--i": 3.5 } as CSSProperties} aria-labelledby={`${id}-attackers`}>
          <header className="card-head">
            <h2 id={`${id}-attackers`} className="card-title">
              Top attackers
            </h2>
          </header>
          <Leaderboard key={range} attackers={data.attackers[range] ?? []} />
        </section>
      </div>

      <section className="block enter" style={{ "--i": 4.5 } as CSSProperties} aria-labelledby={`${id}-sessions`}>
        <div className="block-head">
          <h2 id={`${id}-sessions`} className="block-title">
            Recent sessions
          </h2>
          <button type="button" className="link-more" onClick={() => navigate("sessions")}>
            View all
            <ArrowRightIcon size={14} />
          </button>
        </div>
        {recent.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="pr-list">
            {recent.map((s) => (
              <SessionRow key={s.key} session={s} selected={selected === s.key} onOpen={openSession} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty">
      <p className="empty-title">Waiting for attackers…</p>
      <p className="empty-sub">
        Try <code className="code-chip">ssh root@localhost -p 2222</code> or <code className="code-chip">bun run attack</code>
      </p>
    </div>
  );
}

function KpiCard({ kpi, range, index }: { kpi: AnalyticsKpi; range: string; index: number }) {
  const Icon = KPI_ICONS[kpi.icon];
  // More attacks is "bad" for the defender, but it is what a honeypot wants, so upward trends stay green.
  const good = kpi.delta >= 0;
  return (
    <li className="stat enter" style={{ "--i": 2 + index * 0.4 } as CSSProperties}>
      <span className="stat-label">
        <Icon size={16} strokeWidth={1.7} className="stat-icon" />
        {kpi.label}
      </span>
      <div className="stat-row">
        <Digits value={kpi.value} delay={420 + index * 70} className="stat-value" />
        <span className="delta" data-good={good}>
          <TrendIcon size={13} strokeWidth={2} down={kpi.delta < 0} />
          <Digits value={`${kpi.delta < 0 ? "−" : "+"}${Math.abs(kpi.delta)}%`} delay={500 + index * 70} />
        </span>
      </div>
      <Sparkline key={range} data={kpi.spark} tone={good ? "good" : "bad"} />
    </li>
  );
}

function CountryList({ countries }: { countries: AnalyticsCountry[] }) {
  if (countries.length === 0) {
    return (
      <div className="country-empty">
        <p className="empty-title">No geolocated IPs yet</p>
        <p className="empty-sub">
          Local addresses (<code className="code-chip">::1</code>, 192.168…) have no location. Run{" "}
          <code className="code-chip">bun run seed</code> for demo data.
        </p>
      </div>
    );
  }
  const total = countries.reduce((sum, c) => sum + c.events, 0) || 1;
  const top = countries[0].events;
  return (
    <ol className="countries">
      {countries.slice(0, 7).map((c, i) => (
        <li key={c.country} className="country" style={{ "--row": i } as CSSProperties}>
          <CountryFlag code={c.country} size={28} className="country-flag" />
          <div className="leader-main">
            <div className="leader-line">
              <span className="leader-name">{countryName(c.country)}</span>
              <span className="leader-count">
                <Digits value={c.events} delay={560 + i * 60} /> · {Math.round((c.events / total) * 100)}%
              </span>
            </div>
            <div className="share" aria-hidden="true">
              <span className="share-fill" style={{ "--share": c.events / top } as CSSProperties} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function niceCeil(n: number) {
  const step = n <= 10 ? 2 : n <= 40 ? 10 : n <= 120 ? 20 : n <= 500 ? 100 : 500;
  return Math.max(step, Math.ceil(n / step) * step);
}

function ActivityChart({ data, protocols }: { data: AnalyticsActivity; protocols: AnalyticsProtocol[] }) {
  const totals = data.labels.map((_, i) => protocols.reduce((sum, p) => sum + (data.series[p.id]?.[i] ?? 0), 0));
  const ceil = niceCeil(Math.max(0, ...totals));
  const summary = data.labels.map((label, i) => `${label} ${totals[i]}`).join(", ");

  return (
    <figure className="chart" role="img" aria-label={`Events per period: ${summary}`}>
      <div className="chart-grid" aria-hidden="true">
        {[1, 0.5, 0].map((f) => (
          <span key={f} data-value={Math.round(ceil * f)} />
        ))}
      </div>
      <ol className="chart-cols" aria-hidden="true" style={{ "--cols": Math.max(1, data.labels.length) } as CSSProperties}>
        {data.labels.map((label, i) => (
          <li key={`${label}-${i}`} className="chart-col" style={{ "--col": i } as CSSProperties}>
            <div className="bar-wrap has-tip tip-top" data-tip={`${label} · ${totals[i]} events`} style={{ height: `${(totals[i] / ceil) * 100}%` }}>
              <div className="bar">
                {protocols.map((p) => {
                  const v = data.series[p.id]?.[i] ?? 0;
                  return v ? <span key={p.id} className="bar-seg" style={{ flexGrow: v, "--c": p.color } as CSSProperties} /> : null;
                })}
              </div>
            </div>
            <span className="chart-label">{label}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function Leaderboard({ attackers }: { attackers: AnalyticsAttacker[] }) {
  if (attackers.length === 0) return <p className="empty-sub">No attackers in this time range.</p>;
  const total = attackers.reduce((sum, r) => sum + r.events, 0) || 1;
  const top = attackers[0]?.events || 1;

  return (
    <ol className="leaders">
      {attackers.map((r, i) => (
        <li key={r.ip} className="leader" style={{ "--row": i, "--c": r.color } as CSSProperties}>
          <IpAvatar ip={r.ip} size={32} />
          <div className="leader-main">
            <div className="leader-line">
              <span className="leader-name mono">
                {r.country && <CountryFlag code={r.country} size={14} />}
                {r.ip}
              </span>
              <span className="leader-count">
                <Digits value={r.events} delay={560 + i * 80} /> events
              </span>
            </div>
            <div className="share" aria-hidden="true">
              <span className="share-fill" style={{ "--share": r.events / top } as CSSProperties} />
            </div>
            <div className="leader-meta">
              <span className="badge badge-add">
                <Digits value={`${r.sessions} sess.`} delay={620 + i * 80} />
              </span>
              <span className="badge badge-del">
                <Digits value={`${r.creds} creds`} delay={660 + i * 80} />
              </span>
              <span className="leader-pct">
                <Digits value={Math.round((r.events / total) * 100)} delay={700 + i * 80} />% of traffic
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ───────────── Services ───────────── */

type SortId = "recent" | "name" | "events";

const SORTS = [
  { id: "recent", label: "Recent" },
  { id: "name", label: "Name" },
  { id: "events", label: "Events" },
] as const satisfies readonly { id: SortId; label: string }[];

const compare: Record<SortId, (a: AnalyticsService, b: AnalyticsService) => number> = {
  recent: (a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0),
  name: (a, b) => a.description.localeCompare(b.description),
  events: (a, b) => b.events - a.events,
};

export function ServicesPage() {
  const { data } = useDashboard();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortId>("recent");

  const q = query.trim().toLowerCase();
  const list = data.services
    .filter((s) => !q || [s.description, s.protocol, s.address, s.file].some((v) => v.toLowerCase().includes(q)))
    .sort(compare[sort]);
  const hit = data.services.filter((s) => s.events > 0).length;

  return (
    <div className="page-content">
      <header className="page-head enter" style={{ "--i": 1 } as CSSProperties}>
        <div className="page-head-text">
          <h1 className="page-title">Services</h1>
          <p className="page-sub">
            {data.services.length} exposed services · {hit} already targeted
          </p>
        </div>
      </header>

      <div className="toolbar enter" style={{ "--i": 2 } as CSSProperties}>
        <label className="search">
          <SearchIcon size={15} className="search-icon" />
          <span className="sr-only">Find a service</span>
          <input
            type="search"
            value={query}
            placeholder="Find a service…"
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <Segmented label="Sort services" options={SORTS} value={sort} onChange={setSort} />
      </div>

      {list.length === 0 ? (
        <div className="empty enter" style={{ "--i": 3 } as CSSProperties}>
          <p className="empty-title">{data.services.length === 0 ? "No services configured" : `No services match “${query.trim()}”`}</p>
          <p className="empty-sub">Services are read from apps/honeypot/config/services.</p>
          {query && (
            <button type="button" className="btn press" onClick={() => setQuery("")}>
              Clear search
            </button>
          )}
        </div>
      ) : (
        <ul className="repo-grid" aria-label="Services">
          {list.map((svc, i) => (
            <ServiceCard key={svc.file} service={svc} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ServiceCard({ service, index }: { service: AnalyticsService; index: number }) {
  const { now } = useDashboard();
  const peak = Math.max(1, ...service.activity);

  return (
    <li className="card repo enter" style={{ "--i": 3 + index * 0.35 } as CSSProperties}>
      <div className="repo-head">
        <ProtocolIcon protocol={service.protocol} />
        <h2 className="repo-name">{service.description}</h2>
        <span className="tag">{service.protocol}</span>
      </div>
      <p className="repo-desc">
        Listening on <code className="code-chip">{service.address}</code> · <span className="mono">{service.file}</span>
      </p>

      <div className="mini-bars" role="img" aria-label={`Events per hour over 24h, peak ${peak}`}>
        {service.activity.map((v, i) => (
          <span key={i} style={{ "--h": v / peak, "--bar": i } as CSSProperties} />
        ))}
      </div>

      <div className="repo-foot">
        <span className="repo-stat">
          <PulseIcon size={13} strokeWidth={1.9} />
          <Digits value={service.events} format={formatCount} delay={420 + index * 80} />
        </span>
        <span className="repo-stat">
          <UsersIcon size={13} strokeWidth={1.9} />
          {service.ips} IP{service.ips > 1 ? "s" : ""}
        </span>
        <span className="repo-updated">{service.lastSeen ? `Hit ${relativeTime(service.lastSeen, now)} ago` : "Never hit"}</span>
      </div>
    </li>
  );
}

/* ───────────── Sessions ───────────── */

export function SessionsPage() {
  const { data, selected, openSession } = useDashboard();
  const [filter, setFilter] = useState("all");
  const sessions = data.sessions;
  const ids = ["all", ...data.protocols.map((p) => p.id)];

  const count = (id: string) => (id === "all" ? sessions.length : sessions.filter((s) => s.protocol === id).length);
  const options = ids.map((id) => ({
    id,
    label: (
      <>
        {id === "all" ? "All" : id}
        <span className="seg-count">{count(id)}</span>
      </>
    ),
  }));
  const list = (filter === "all" ? sessions : sessions.filter((s) => s.protocol === filter)).slice(0, 200);
  const active = sessions.filter((s) => s.status.kind === "open").length;

  return (
    <div className="page-content">
      <header className="page-head enter" style={{ "--i": 1 } as CSSProperties}>
        <div className="page-head-text">
          <h1 className="page-title">Sessions</h1>
          <p className="page-sub">
            {sessions.length} sessions · {active} active right now
          </p>
        </div>
      </header>

      <div className="toolbar enter" style={{ "--i": 2 } as CSSProperties}>
        <Segmented label="Filter by protocol" options={options} value={filter} onChange={setFilter} className="seg-wide" />
      </div>

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <ul key={filter} className="review-list" aria-label="Sessions">
          {list.map((s, i) => (
            <SessionReviewRow key={s.key} session={s} index={i} selected={selected === s.key} onOpen={openSession} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SessionReviewRow({
  session,
  index,
  selected,
  onOpen,
}: {
  session: AnalyticsSession;
  index: number;
  selected: boolean;
  onOpen: (key: string) => void;
}) {
  const { now } = useDashboard();
  const cmds = session.interactions.length;
  const creds = session.creds.length;
  const total = cmds + creds || 1;
  const credBlocks = Math.round((creds / total) * 5);

  return (
    <li className="review-row enter" data-selected={selected} style={{ "--i": 2.6 + Math.min(index, 12) * 0.25 } as CSSProperties}>
      <ProtocolIcon protocol={session.protocol} />
      <div className="review-main">
        <p className="pr-title">{sessionTitle(session)}</p>
        <p className="review-meta">
          <span className="review-repo">{session.service}</span>
          <span aria-hidden="true">·</span>
          <span className="review-author">
            <IpAvatar ip={session.ip} size={22} />
            {session.ip || "Unknown IP"}
          </span>
          <span aria-hidden="true">·</span>
          <span>{relativeTime(session.end, now)} ago</span>
        </p>
      </div>
      <div className="diffstat" title={`${creds} credentials · ${cmds} commands/requests`}>
        <span className="diff-del">{creds} creds</span>
        <span className="diff-add">{cmds} cmd</span>
        <span className="diff-blocks" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <i key={i} data-kind={i < credBlocks ? "del" : "add"} />
          ))}
        </span>
      </div>
      <StatusPill status={session.status} />
      <button
        type="button"
        className="btn-details press"
        aria-pressed={selected}
        aria-label={`Details for session from ${session.ip}`}
        onClick={() => onOpen(session.key)}
      >
        Details
      </button>
    </li>
  );
}

/* ───────────── Settings ───────────── */

export function SettingsPage() {
  const { accent, setAccent, status, data } = useDashboard();
  const id = useId();

  return (
    <div className="page-content settings">
      <header className="page-head enter" style={{ "--i": 1 } as CSSProperties}>
        <div className="page-head-text">
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Honeypot status and dashboard appearance.</p>
        </div>
      </header>

      <div className="settings-form">
        <section className="card settings-card enter" style={{ "--i": 2 } as CSSProperties} aria-labelledby={`${id}-status`}>
          <h2 id={`${id}-status`} className="card-title">
            Honeypot
          </h2>
          <ul className="setting-list">
            <li className="setting-row">
              <div>
                <p className="setting-title">Live stream</p>
                <p className="setting-detail">SSE connection to the API that tails the Beelzebub log.</p>
              </div>
              <span className="pill" data-kind={status.connected ? "merged" : "review"}>
                {status.connected ? "Connected" : "Disconnected"}
              </span>
            </li>
            <li className="setting-row">
              <div>
                <p className="setting-title">Log file</p>
                <p className="setting-detail mono">{status.logPath ?? "—"}</p>
              </div>
            </li>
            <li className="setting-row">
              <div>
                <p className="setting-title">Events in memory</p>
                <p className="setting-detail">The API keeps the latest 10,000 events.</p>
              </div>
              <span className="mono">{formatCount(status.totalEvents)}</span>
            </li>
            <li className="setting-row">
              <div>
                <p className="setting-title">Exposed services</p>
                <p className="setting-detail">{data.services.map((s) => `${s.protocol} ${s.address}`).join(" · ") || "—"}</p>
              </div>
              <ServerIcon size={16} />
            </li>
          </ul>
        </section>

        <section className="card settings-card enter" style={{ "--i": 2.5 } as CSSProperties} aria-labelledby={`${id}-look`}>
          <h2 id={`${id}-look`} className="card-title">
            Appearance
          </h2>
          <div className="setting-row">
            <div>
              <p id={`${id}-accent`} className="setting-title">
                Accent color
              </p>
              <p className="setting-detail">Tints buttons, selections and highlights. Applies right away.</p>
            </div>
            <div className="swatches" role="radiogroup" aria-labelledby={`${id}-accent`}>
              {(Object.keys(ACCENTS) as AnalyticsDashboardAccent[]).map((accentId) => (
                <button
                  key={accentId}
                  type="button"
                  role="radio"
                  aria-checked={accent === accentId}
                  aria-label={ACCENTS[accentId].label}
                  className="swatch press has-tip tip-top"
                  data-tip={ACCENTS[accentId].label}
                  style={{ "--swatch": ACCENTS[accentId].ui } as CSSProperties}
                  onClick={() => setAccent(accentId)}
                >
                  <CheckIcon size={13} strokeWidth={2.6} />
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
