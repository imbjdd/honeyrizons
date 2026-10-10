import { useMemo, useState, type CSSProperties } from "react";
import { buildComplianceReport, reportToCsv, SEVERITY_ORDER, type ComplianceReport, type Severity } from "@honeyrizons/shared";
import { useDashboard } from "./context";
import { rangeStart, type RangeId } from "./data";
import { SeverityPill } from "./ai";
import { Digits, Segmented } from "./ui";
import { BotIcon, PulseIcon, ShieldIcon, TerminalIcon, UsersIcon } from "./icons";

const SEVERITY_TONE: Record<Severity, string> = { critical: "#ff6369", high: "#ff8a5b", medium: "var(--review)", low: "var(--text-3)" };

function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** A standalone, print-optimized HTML document, opened in a new tab for "Save as PDF". */
function printableHtml(report: ComplianceReport): string {
  const { meta, summary } = report;
  const sevRows = SEVERITY_ORDER.map((s) => `<span class="sev sev-${s}">${s}: ${summary.bySeverity[s]}</span>`).join("");
  const register = report.register
    .map(
      (r) => `<tr>
      <td class="mono">${esc(r.ref)}</td>
      <td>${esc(r.lastSeen.replace("T", " ").replace("Z", ""))}</td>
      <td>${esc(r.protocol)} · ${esc(r.service)}</td>
      <td><span class="sev sev-${r.severity}">${r.severity}</span></td>
      <td>${esc(r.category)}${r.aiAgentConfidence !== null ? `<br><span class="muted">AI agent ${r.aiAgentConfidence}%${r.operator ? ` · ${esc(r.operator)}` : ""}</span>` : ""}</td>
      <td>${esc(r.verdict)}<br><span class="muted">${esc(r.summary)}</span></td>
      <td class="mono small">${r.techniques.map(esc).join("<br>") || "—"}</td>
      <td>${r.sessions} · ${r.sourceIps.length} IP${r.sourceIps.length > 1 ? "s" : ""}${r.countries.length ? `<br><span class="muted">${esc(r.countries.join(", "))}</span>` : ""}</td>
      <td>${esc(r.recommendation)}</td>
    </tr>`,
    )
    .join("");
  const operators = report.operators.length
    ? `<h2>AI operators</h2>
    <table><thead><tr><th>ID</th><th>Runs · IPs</th><th>Likely goal</th><th>Sophistication</th><th>Evidence of linkage</th></tr></thead><tbody>
    ${report.operators
      .map(
        (o) => `<tr><td class="mono">${esc(o.id)}</td><td>${o.sessions} · ${o.ips} on ${o.networks} net.</td><td>${esc(o.goal)}</td><td>${esc(o.sophistication)} (${o.sophisticationScore}/100)</td><td class="small">${o.traits.map(esc).join("<br>")}</td></tr>`,
      )
      .join("")}
    </tbody></table>`
    : "";
  const mitre = report.mitre.length
    ? `<h2>MITRE ATT&CK coverage</h2><table><thead><tr><th>Technique</th><th>Name</th><th>Sessions</th></tr></thead><tbody>${report.mitre
        .map((t) => `<tr><td class="mono">${esc(t.id)}</td><td>${esc(t.name)}</td><td>${t.count}</td></tr>`)
        .join("")}</tbody></table>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Honeyrizons compliance report</title>
  <style>
    @page { size: A4; margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    body { font: 11px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; color: #15171a; margin: 0; }
    .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
    .muted { color: #5a6066; }
    .small { font-size: 9.5px; }
    header { border-bottom: 2px solid #15171a; padding-bottom: 12px; margin-bottom: 18px; }
    h1 { font-size: 19px; margin: 0 0 2px; }
    h2 { font-size: 13px; margin: 22px 0 8px; border-bottom: 1px solid #d4d8dc; padding-bottom: 4px; }
    .kicker { color: #b7791f; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 9.5px; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 22px; margin-top: 8px; color: #5a6066; }
    .cards { display: flex; flex-wrap: wrap; gap: 10px; margin: 6px 0 2px; }
    .card { border: 1px solid #d4d8dc; border-radius: 6px; padding: 8px 12px; min-width: 110px; }
    .card b { font-size: 20px; display: block; }
    .sevs { display: flex; gap: 6px; margin: 10px 0; flex-wrap: wrap; }
    .sev { padding: 1px 7px; border-radius: 4px; font-size: 9.5px; font-weight: 600; text-transform: uppercase; }
    .sev-critical { background: #fde8e8; color: #c81e1e; } .sev-high { background: #fdeadd; color: #c2410c; }
    .sev-medium { background: #fdf6e3; color: #b7791f; } .sev-low { background: #eef1f3; color: #5a6066; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #5a6066; border-bottom: 1px solid #15171a; padding: 5px 6px; }
    td { padding: 6px; border-bottom: 1px solid #e4e7ea; vertical-align: top; }
    tr { break-inside: avoid; }
    .notes { margin-top: 10px; padding-left: 16px; color: #3a4046; }
    .notes li { margin-bottom: 4px; }
    footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #d4d8dc; color: #8a9096; font-size: 9px; }
    @media print { .hint { display: none; } }
  </style></head><body onload="window.print()">
  <div class="hint" style="background:#fdf6e3;padding:8px 12px;font-size:11px;border-bottom:1px solid #e0d6b8">Use your browser's print dialog and choose <b>Save as PDF</b>. This banner is not printed.</div>
  <header>
    <div class="kicker">Honeyrizons · AI threat monitoring</div>
    <h1>Compliance &amp; threat intelligence report</h1>
    <div class="meta"><span><b>Period:</b> ${esc(meta.periodLabel)} (${esc(meta.periodStart.slice(0, 10))} → ${esc(meta.periodEnd.slice(0, 10))})</span>
    <span><b>Generated:</b> ${esc(meta.generatedAt.replace("T", " ").replace("Z", " UTC"))}</span>
    <span><b>Services monitored:</b> ${meta.services}</span></div>
  </header>
  <h2>Executive summary</h2>
  <div class="cards">
    <div class="card"><b>${summary.sessions}</b>attack sessions</div>
    <div class="card"><b>${summary.attackers}</b>distinct source IPs</div>
    <div class="card"><b>${summary.aiAgents}</b>AI-agent sessions</div>
    <div class="card"><b>${summary.operators}</b>correlated operators</div>
    <div class="card"><b>${summary.canaryTrips}</b>canary trips</div>
  </div>
  <div class="sevs">${sevRows}</div>
  <h2>Threat register (${report.register.length} findings)</h2>
  <table><thead><tr><th>Ref</th><th>Last seen (UTC)</th><th>Vector</th><th>Severity</th><th>Category</th><th>Finding</th><th>MITRE</th><th>Scale</th><th>Recommendation</th></tr></thead>
  <tbody>${register || '<tr><td colspan="9" class="muted">No analyzed findings in this period.</td></tr>'}</tbody></table>
  ${operators}
  ${mitre}
  <h2>Methodology &amp; limitations</h2>
  <ul class="notes">${report.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
  <footer>References: ${meta.references.map(esc).join(" · ")}. Generated by Honeyrizons. Monitoring evidence, not an audit opinion.</footer>
  </body></html>`;
}

export function ReportsPage() {
  const { data, intel, now, status } = useDashboard();
  const [range, setRange] = useState<RangeId>("day");
  const [busy, setBusy] = useState<string | null>(null);

  const report = useMemo(() => {
    const periodLabel = data.ranges.find((r) => r.id === range)?.label ?? range;
    return buildComplianceReport(data.sessions, intel, {
      periodLabel: `Last ${periodLabel}`,
      periodStart: rangeStart(range, now),
      now,
      services: data.services.length,
      totalEvents: status.totalEvents,
    });
  }, [data, intel, now, range, status.totalEvents]);

  const stamp = report.meta.generatedAt.slice(0, 10).replace(/-/g, "");
  const base = `honeyrizons-compliance-${stamp}`;

  function exportCsv() {
    download(`${base}.csv`, "﻿" + reportToCsv(report), "text/csv;charset=utf-8");
  }

  async function exportXlsx() {
    setBusy("xlsx");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const summary = [
        ["Honeyrizons compliance report"],
        ["Period", report.meta.periodLabel],
        ["Generated (UTC)", report.meta.generatedAt],
        ["Services monitored", report.meta.services],
        ["Analyst", report.meta.analyst.enabled ? report.meta.analyst.model : "local rules only"],
        [],
        ["Attack sessions", report.summary.sessions],
        ["Distinct source IPs", report.summary.attackers],
        ["Analyzed sessions", report.summary.analyzed],
        ["AI-agent sessions", report.summary.aiAgents],
        ["Correlated operators", report.summary.operators],
        ["Canary trips", report.summary.canaryTrips],
        [],
        ["Critical", report.summary.bySeverity.critical],
        ["High", report.summary.bySeverity.high],
        ["Medium", report.summary.bySeverity.medium],
        ["Low", report.summary.bySeverity.low],
        [],
        ["References", ...report.meta.references],
        ...report.notes.map((n) => ["Note", n]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          report.register.map((r) => ({
            Ref: r.ref,
            "First seen (UTC)": r.firstSeen,
            "Last seen (UTC)": r.lastSeen,
            Protocol: r.protocol,
            Service: r.service,
            "Source IPs": r.sourceIps.join(" "),
            Countries: r.countries.join(" "),
            Sessions: r.sessions,
            "Attacker type": r.attacker,
            Category: r.category,
            Severity: r.severity,
            "AI agent confidence %": r.aiAgentConfidence ?? "",
            Operator: r.operator ?? "",
            Verdict: r.verdict,
            Summary: r.summary,
            "MITRE ATT&CK": r.techniques.join("; "),
            Indicators: r.iocs.join("; "),
            Recommendation: r.recommendation,
            "Analysis source": r.source,
          })),
        ),
        "Threat register",
      );
      if (report.operators.length)
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            report.operators.map((o) => ({
              Operator: o.id,
              Sessions: o.sessions,
              "Source IPs": o.ips,
              Networks: o.networks,
              Countries: o.countries.join(" "),
              "Likely goal": o.goal,
              Sophistication: o.sophistication,
              "Score /100": o.sophisticationScore,
              "First seen (UTC)": o.firstSeen,
              "Last seen (UTC)": o.lastSeen,
              "Evidence of linkage": o.traits.join(" | "),
            })),
          ),
          "Operators",
        );
      if (report.mitre.length)
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(report.mitre.map((t) => ({ Technique: t.id, Name: t.name, Sessions: t.count }))),
          "MITRE ATT&CK",
        );
      XLSX.writeFile(wb, `${base}.xlsx`);
    } finally {
      setBusy(null);
    }
  }

  function exportPdf() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(printableHtml(report));
    w.document.close();
  }

  const s = report.summary;

  return (
    <div className="page-content">
      <header className="page-head enter" style={{ "--i": 1 } as CSSProperties}>
        <div className="page-head-text">
          <h1 className="page-title">Compliance report</h1>
          <p className="page-sub">Audit-ready threat intelligence export — PDF, Excel and CSV, from the same evidence.</p>
        </div>
        <Segmented label="Reporting period" options={data.ranges} value={range} onChange={setRange} />
      </header>

      <div className="report-actions enter" style={{ "--i": 2 } as CSSProperties}>
        <button type="button" className="btn-export press" onClick={exportPdf}>
          Download PDF
        </button>
        <button type="button" className="btn-export press" onClick={exportXlsx} disabled={busy === "xlsx"}>
          {busy === "xlsx" ? "Preparing…" : "Export Excel"}
        </button>
        <button type="button" className="btn-export press" onClick={exportCsv}>
          Export CSV
        </button>
        <span className="report-stamp">
          {base}.* · generated {report.meta.generatedAt.replace("T", " ").replace("Z", " UTC")}
        </span>
      </div>

      <ul className="stats" aria-label="Report summary">
        <ReportStat index={0} icon={TerminalIcon} label="Attack sessions" value={s.sessions} />
        <ReportStat index={1} icon={BotIcon} label="AI-agent sessions" value={s.aiAgents} />
        <ReportStat index={2} icon={UsersIcon} label="Correlated operators" value={s.operators} />
        <ReportStat index={3} icon={ShieldIcon} label="Canary trips" value={s.canaryTrips} />
      </ul>

      <section className="card report-card enter" style={{ "--i": 3 } as CSSProperties}>
        <header className="card-head">
          <h2 className="card-title">Severity breakdown</h2>
          <span className="map-note">{s.analyzed} analyzed sessions across the period</span>
        </header>
        <div className="sev-bar" role="img" aria-label="Sessions by severity">
          {SEVERITY_ORDER.map((sev) =>
            s.bySeverity[sev] ? (
              <span key={sev} className="sev-seg" style={{ flexGrow: s.bySeverity[sev], background: SEVERITY_TONE[sev] } as CSSProperties} title={`${sev}: ${s.bySeverity[sev]}`} />
            ) : null,
          )}
        </div>
        <ul className="sev-legend">
          {SEVERITY_ORDER.map((sev) => (
            <li key={sev}>
              <SeverityPill severity={sev} />
              <Digits value={s.bySeverity[sev]} delay={400} />
            </li>
          ))}
        </ul>
      </section>

      <section className="block enter" style={{ "--i": 3.6 } as CSSProperties} aria-label="Threat register">
        <div className="block-head">
          <h2 className="block-title">Threat register</h2>
          <span className="map-note">{report.register.length} findings</span>
        </div>
        {report.register.length === 0 ? (
          <div className="empty">
            <p className="empty-title">No analyzed findings in this period</p>
            <p className="empty-sub">The register fills as the analyst triages sessions.</p>
          </div>
        ) : (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Vector</th>
                  <th>Severity</th>
                  <th>Finding</th>
                  <th>MITRE</th>
                  <th>Scale</th>
                </tr>
              </thead>
              <tbody>
                {report.register.map((r) => (
                  <tr key={r.ref}>
                    <td className="mono">{r.ref}</td>
                    <td>
                      {r.protocol}
                      <span className="report-dim"> · {r.service}</span>
                    </td>
                    <td>
                      <SeverityPill severity={r.severity} />
                    </td>
                    <td>
                      <span className="report-verdict">{r.verdict}</span>
                      <span className="report-dim">
                        {r.category}
                        {r.aiAgentConfidence !== null ? ` · AI agent ${r.aiAgentConfidence}%${r.operator ? ` · ${r.operator}` : ""}` : ""}
                      </span>
                    </td>
                    <td className="mono report-dim">{r.techniques.map((t) => t.split(" ")[0]).join(", ") || "—"}</td>
                    <td className="report-dim">
                      {r.sessions} · {r.sourceIps.length} IP{r.sourceIps.length > 1 ? "s" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card report-card enter" style={{ "--i": 4.2 } as CSSProperties}>
        <header className="card-head">
          <h2 className="card-title">Methodology &amp; limitations</h2>
          <span className="map-note">{report.meta.references.join(" · ")}</span>
        </header>
        <ul className="report-notes">
          {report.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ReportStat({ index, icon: Icon, label, value }: { index: number; icon: typeof PulseIcon; label: string; value: number }) {
  return (
    <li className="stat enter" style={{ "--i": 2 + index * 0.4 } as CSSProperties}>
      <span className="stat-label">
        <Icon size={16} strokeWidth={1.7} className="stat-icon" />
        {label}
      </span>
      <div className="stat-row">
        <Digits value={value} delay={420 + index * 70} className="stat-value" />
      </div>
    </li>
  );
}
