import { useState, type CSSProperties } from "react";
import type { SessionAnalysis, SessionIntel, Severity } from "@honeyrizons/shared";
import { useDashboard } from "./context";
import { rangeStart, relativeTime, type AnalyticsSession, type RangeId } from "./data";
import { ArrowRightIcon, SparklesIcon, TriangleIcon } from "./icons";
import { ProtocolIcon } from "./ui";

export const SEVERITY_RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

const label = (s: string) => s.replace(/-/g, " ").replace(/\bai\b/gi, "AI");

export function useSessionIntel(session: AnalyticsSession | undefined): { intel?: SessionIntel; analysis?: SessionAnalysis } {
  const { intel } = useDashboard();
  const entry = session ? intel.sessions[session.key] : undefined;
  return { intel: entry, analysis: entry ? intel.analyses[entry.fingerprint] : undefined };
}

export function SeverityPill({ severity }: { severity: Severity }) {
  return (
    <span className="sev" data-sev={severity}>
      {severity}
    </span>
  );
}

/** Compact verdict shown in session lists. */
export function ThreatBadge({ session }: { session: AnalyticsSession }) {
  const { intel, analysis } = useSessionIntel(session);
  if (analysis) {
    return (
      <span className="threat-badge" title={`${label(analysis.category)}: ${analysis.verdict}`}>
        <SeverityPill severity={analysis.severity} />
      </span>
    );
  }
  if (intel?.state === "queued") return <span className="threat-badge threat-pending shimmer">Triage…</span>;
  return null;
}

export function SessionAnalysisPanel({ session }: { session: AnalyticsSession }) {
  const { intel: snapshot } = useDashboard();
  const { intel, analysis } = useSessionIntel(session);
  const [allIocs, setAllIocs] = useState(false);
  const { stats } = snapshot;

  let pending: string | null = null;
  if (!analysis) {
    if (!intel || intel.state === "live") pending = "In progress · analyzed when it ends";
    else if (intel.state === "failed") pending = "Analysis failed · retrying later";
    else if (!stats.enabled) pending = "Analyst off · set OPENAI_API_KEY";
    else if (stats.budgetUsed >= stats.budgetPerHour) pending = "Queued · hourly budget reached";
    else pending = "Analyzing…";
  }
  const iocs = analysis ? (allIocs ? analysis.iocs : analysis.iocs.slice(0, 3)) : [];

  return (
    <section className="ai-panel" aria-label="Analyst verdict">
      {pending && (
        <p className={pending === "Analyzing…" ? "ai-pending shimmer" : "ai-pending"}>
          <SparklesIcon size={13} />
          {pending}
        </p>
      )}

      {analysis && (
        <div className="ai-result swap-in">
          <div className="ai-tags">
            <SeverityPill severity={analysis.severity} />
            <span className="ai-tag-text">
              {label(analysis.category)} · {label(analysis.attacker)}
            </span>
          </div>
          <p className="ai-verdict">{analysis.verdict}</p>
          <p className="ai-text">{analysis.summary}</p>

          <p className="ai-reco">
            <span aria-hidden="true">→</span>
            {analysis.recommendation}
          </p>

          {analysis.techniques.length > 0 && (
            <ul className="ai-chips" aria-label="MITRE ATT&CK techniques">
              {analysis.techniques.map((t) => (
                <li key={t.id}>
                  <a href={`https://attack.mitre.org/techniques/${t.id.replace(".", "/")}/`} target="_blank" rel="noreferrer" title={t.evidence}>
                    <code>{t.id}</code>
                    {t.name}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {iocs.length > 0 && (
            <ul className="ai-iocs" aria-label="Indicators">
              {iocs.map((ioc, i) => (
                <li key={i}>
                  <span className="ai-ioc-type">{label(ioc.type)}</span>
                  <code>{ioc.value}</code>
                </li>
              ))}
              {analysis.iocs.length > 3 && (
                <li>
                  <button type="button" className="ai-more" onClick={() => setAllIocs((v) => !v)}>
                    {allIocs ? "Show less" : `+${analysis.iocs.length - 3} indicators`}
                  </button>
                </li>
              )}
            </ul>
          )}

          <p className="ai-meta">
            <SparklesIcon size={11} />
            {analysis.model === "rules" ? "Local rules" : analysis.model}
            {intel && intel.campaign.ips > 1 ? ` · same behavior from ${intel.campaign.ips} IPs` : ""}
          </p>
        </div>
      )}
    </section>
  );
}

/** What the operator should look at first: one line on the period, then the most severe campaigns. */
export function AnalystCard({ range, style }: { range: RangeId; style?: CSSProperties }) {
  const { data, intel, now, openSession, navigate } = useDashboard();
  const { brief, stats } = intel;
  const [open, setOpen] = useState(false);

  const from = rangeStart(range, now);
  const seen = new Set<string>();
  const threats: { session: AnalyticsSession; analysis: SessionAnalysis; ips: number }[] = [];
  for (const session of data.sessions) {
    if (session.end < from) continue;
    const entry = intel.sessions[session.key];
    const analysis = entry ? intel.analyses[entry.fingerprint] : undefined;
    if (!entry || !analysis || seen.has(entry.fingerprint) || analysis.severity === "low") continue;
    seen.add(entry.fingerprint);
    threats.push({ session, analysis, ips: entry.campaign.ips });
  }
  threats.sort((a, b) => SEVERITY_RANK[b.analysis.severity] - SEVERITY_RANK[a.analysis.severity] || b.session.end - a.session.end);
  const shown = threats.slice(0, 4);

  return (
    <section className="card analyst-card enter" style={style} aria-label="Analyst">
      <header className="analyst-top">
        <span className="ai-title">
          <SparklesIcon size={15} />
          Analyst
        </span>
        <span className="map-note">
          {stats.queued ? `${stats.queued} sessions in queue` : `${stats.analyzed + stats.triaged} sessions triaged`}
        </span>
      </header>

      {brief ? (
        <button type="button" className="analyst-headline" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <SeverityPill severity={brief.risk} />
          <span>{brief.headline}</span>
          <TriangleIcon size={9} className="analyst-tri" data-open={open} />
        </button>
      ) : (
        <p className="ai-hint">{stats.enabled ? "First brief coming once a few sessions are analyzed." : "Set OPENAI_API_KEY to get the 24h brief."}</p>
      )}

      {brief && open && (
        <div className="analyst-more swap-in">
          <ul className="brief-list">
            {brief.findings.map((f, i) => (
              <li key={i}>{f.replace(/^\s*\d+[).]\s*/, "")}</li>
            ))}
          </ul>
          <ul className="brief-list brief-actions">
            {brief.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <p className="ai-meta">Last 24h · updated {relativeTime(Date.parse(brief.generatedAt), Date.now())} ago</p>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="ai-hint analyst-empty">Nothing above low severity in this time range.</p>
      ) : (
        <ol className="threat-list">
          {shown.map(({ session, analysis, ips }) => (
            <li key={session.key}>
              <button type="button" className="threat-row" onClick={() => openSession(session.key)}>
                <SeverityPill severity={analysis.severity} />
                <span className="threat-verdict">{analysis.verdict}</span>
                <span className="threat-meta">
                  <ProtocolIcon protocol={session.protocol} size={12} />
                  {ips > 1 ? `${ips} IPs` : session.ip || "1 IP"}
                </span>
                <span className="threat-age">{relativeTime(session.end, now)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {threats.length > shown.length && (
        <button type="button" className="link-more analyst-all" onClick={() => navigate("sessions")}>
          {threats.length - shown.length} more threats
          <ArrowRightIcon size={13} />
        </button>
      )}
    </section>
  );
}
