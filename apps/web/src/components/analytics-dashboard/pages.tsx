import { useId, useState, type CSSProperties } from "react";
import { ACCENTS, useDashboard, type AnalyticsDashboardAccent } from "./context";
import {
  relativeTime,
  sessionTitle,
  type AnalyticsActivity,
  type AnalyticsAttacker,
  type AnalyticsKpi,
  type AnalyticsKpiIcon,
  type AnalyticsProtocol,
  type AnalyticsService,
  type AnalyticsSession,
  type RangeId,
} from "./data";
import { ArrowRightIcon, CheckIcon, KeyIcon, PulseIcon, SearchIcon, ServerIcon, TerminalIcon, TrendIcon, UsersIcon } from "./icons";
import { Digits, formatCount, IpAvatar, ProtocolIcon, Segmented, SessionRow, Sparkline, StatusPill } from "./ui";

/* ───────────── Overview ───────────── */

const KPI_ICONS: Record<AnalyticsKpiIcon, typeof PulseIcon> = {
  events: PulseIcon,
  attackers: UsersIcon,
  sessions: TerminalIcon,
  creds: KeyIcon,
};

const EMPTY_ACTIVITY: AnalyticsActivity = { labels: [], series: {} };

export function OverviewPage() {
  const { data, selected, openSession, navigate } = useDashboard();
  const id = useId();
  const [range, setRange] = useState<RangeId>("day");
  const caption = data.ranges.find((r) => r.id === range)?.caption;
  const recent = data.sessions.slice(0, 5);
  const activity = data.activity[range] ?? EMPTY_ACTIVITY;

  return (
    <div className="page-content">
      <header className="page-head enter" style={{ "--i": 1 } as CSSProperties}>
        <div className="page-head-text">
          <h1 className="page-title">Vue d'ensemble</h1>
          <p className="page-sub">
            <span key={range} className="swap-in">
              {caption}
            </span>
          </p>
        </div>
        <Segmented label="Période" options={data.ranges} value={range} onChange={setRange} />
      </header>

      <ul className="stats" aria-label="Indicateurs clés">
        {(data.kpis[range] ?? []).map((k, i) => (
          <KpiCard key={k.id} kpi={k} range={range} index={i} />
        ))}
      </ul>

      <div className="overview-grid">
        <section className="card enter" style={{ "--i": 3 } as CSSProperties} aria-labelledby={`${id}-activity`}>
          <header className="card-head">
            <h2 id={`${id}-activity`} className="card-title">
              Activité par protocole
            </h2>
            <ul className="legend" aria-label="Protocoles">
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
              Top attaquants
            </h2>
          </header>
          <Leaderboard key={range} attackers={data.attackers[range] ?? []} />
        </section>
      </div>

      <section className="block enter" style={{ "--i": 4.5 } as CSSProperties} aria-labelledby={`${id}-sessions`}>
        <div className="block-head">
          <h2 id={`${id}-sessions`} className="block-title">
            Sessions récentes
          </h2>
          <button type="button" className="link-more" onClick={() => navigate("sessions")}>
            Tout voir
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
      <p className="empty-title">En attente d'attaquants…</p>
      <p className="empty-sub">
        Essaie <code className="code-chip">ssh root@localhost -p 2222</code> ou <code className="code-chip">bun run attack</code>
      </p>
    </div>
  );
}

function KpiCard({ kpi, range, index }: { kpi: AnalyticsKpi; range: string; index: number }) {
  const Icon = KPI_ICONS[kpi.icon];
  // More attacks is "bad" for the defender, but it is what a honeypot wants — keep the upward trend green.
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

function niceCeil(n: number) {
  const step = n <= 10 ? 2 : n <= 40 ? 10 : n <= 120 ? 20 : n <= 500 ? 100 : 500;
  return Math.max(step, Math.ceil(n / step) * step);
}

function ActivityChart({ data, protocols }: { data: AnalyticsActivity; protocols: AnalyticsProtocol[] }) {
  const totals = data.labels.map((_, i) => protocols.reduce((sum, p) => sum + (data.series[p.id]?.[i] ?? 0), 0));
  const ceil = niceCeil(Math.max(0, ...totals));
  const summary = data.labels.map((label, i) => `${label} ${totals[i]}`).join(", ");

  return (
    <figure className="chart" role="img" aria-label={`Events par période : ${summary}`}>
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
  if (attackers.length === 0) return <p className="empty-sub">Aucun attaquant sur la période.</p>;
  const total = attackers.reduce((sum, r) => sum + r.events, 0) || 1;
  const top = attackers[0]?.events || 1;

  return (
    <ol className="leaders">
      {attackers.map((r, i) => (
        <li key={r.ip} className="leader" style={{ "--row": i, "--c": r.color } as CSSProperties}>
          <IpAvatar ip={r.ip} size={32} />
          <div className="leader-main">
            <div className="leader-line">
              <span className="leader-name mono">{r.ip}</span>
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
                <Digits value={Math.round((r.events / total) * 100)} delay={700 + i * 80} />% du trafic
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
  { id: "recent", label: "Récent" },
  { id: "name", label: "Nom" },
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
            {data.services.length} services exposés · {hit} déjà ciblés
          </p>
        </div>
      </header>

      <div className="toolbar enter" style={{ "--i": 2 } as CSSProperties}>
        <label className="search">
          <SearchIcon size={15} className="search-icon" />
          <span className="sr-only">Chercher un service</span>
          <input
            type="search"
            value={query}
            placeholder="Chercher un service…"
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <Segmented label="Trier les services" options={SORTS} value={sort} onChange={setSort} />
      </div>

      {list.length === 0 ? (
        <div className="empty enter" style={{ "--i": 3 } as CSSProperties}>
          <p className="empty-title">{data.services.length === 0 ? "Aucun service configuré" : `Aucun service ne correspond à « ${query.trim()} »`}</p>
          <p className="empty-sub">Les services sont lus depuis apps/honeypot/config/services.</p>
          {query && (
            <button type="button" className="btn press" onClick={() => setQuery("")}>
              Effacer
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
        Écoute sur <code className="code-chip">{service.address}</code> · <span className="mono">{service.file}</span>
      </p>

      <div className="mini-bars" role="img" aria-label={`Events par heure sur 24h, pic ${peak}`}>
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
        <span className="repo-updated">{service.lastSeen ? `Ciblé il y a ${relativeTime(service.lastSeen, now)}` : "Jamais ciblé"}</span>
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
        {id === "all" ? "Toutes" : id}
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
            {sessions.length} sessions · {active} active{active > 1 ? "s" : ""} en ce moment
          </p>
        </div>
      </header>

      <div className="toolbar enter" style={{ "--i": 2 } as CSSProperties}>
        <Segmented label="Filtrer par protocole" options={options} value={filter} onChange={setFilter} className="seg-wide" />
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
            {session.ip || "IP inconnue"}
          </span>
          <span aria-hidden="true">·</span>
          <span>il y a {relativeTime(session.end, now)}</span>
        </p>
      </div>
      <div className="diffstat" title={`${creds} credentials · ${cmds} commandes/requêtes`}>
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
        aria-label={`Détails de la session ${session.ip}`}
        onClick={() => onOpen(session.key)}
      >
        Détails
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
          <h1 className="page-title">Réglages</h1>
          <p className="page-sub">État du honeypot et apparence du dashboard.</p>
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
                <p className="setting-title">Flux temps réel</p>
                <p className="setting-detail">Connexion SSE à l'API qui lit le log Beelzebub.</p>
              </div>
              <span className="pill" data-kind={status.connected ? "merged" : "review"}>
                {status.connected ? "Connecté" : "Déconnecté"}
              </span>
            </li>
            <li className="setting-row">
              <div>
                <p className="setting-title">Fichier de log</p>
                <p className="setting-detail mono">{status.logPath ?? "—"}</p>
              </div>
            </li>
            <li className="setting-row">
              <div>
                <p className="setting-title">Events en mémoire</p>
                <p className="setting-detail">L'API garde les 10 000 derniers events.</p>
              </div>
              <span className="mono">{formatCount(status.totalEvents)}</span>
            </li>
            <li className="setting-row">
              <div>
                <p className="setting-title">Services exposés</p>
                <p className="setting-detail">{data.services.map((s) => `${s.protocol} ${s.address}`).join(" · ") || "—"}</p>
              </div>
              <ServerIcon size={16} />
            </li>
          </ul>
        </section>

        <section className="card settings-card enter" style={{ "--i": 2.5 } as CSSProperties} aria-labelledby={`${id}-look`}>
          <h2 id={`${id}-look`} className="card-title">
            Apparence
          </h2>
          <div className="setting-row">
            <div>
              <p id={`${id}-accent`} className="setting-title">
                Couleur d'accent
              </p>
              <p className="setting-detail">Boutons, sélections et surlignages. S'applique tout de suite.</p>
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
