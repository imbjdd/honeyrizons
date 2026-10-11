import { useMemo, useRef, useState, type CSSProperties, type Ref } from "react";
import { AGENT_THRESHOLD, agentEvidence, correlateAgents, GOAL_LABELS, LOOT_LABELS, type AgentEvidence, type AgentOperator, type AgentSignalId } from "@honeyrizons/shared";
import { useDashboard } from "./context";
import { formatDuration, rangeStart, relativeTime, sessionTitle, type AnalyticsSession, type RangeId } from "./data";
import { useSessionIntel, SeverityPill } from "./ai";
import { ArrowRightIcon, BotIcon, ClockIcon, ShieldIcon, TriangleIcon, UsersIcon } from "./icons";
import { Digits, IpAvatar, Segmented } from "./ui";
import { CountryFlag } from "./flag";

type Agent = { session: AnalyticsSession; evidence: AgentEvidence };

/** Every signal, in the order the evidence list shows them, so missing ones read as "not seen". */
const SIGNALS: { id: AgentSignalId; label: string; missing: string }[] = [
  { id: "canary", label: "Obeyed a planted instruction", missing: "Did not call the canary tool" },
  { id: "mcp", label: "Speaks MCP", missing: "Not over the Model Context Protocol" },
  { id: "chaining", label: "Read the responses", missing: "Never reused a leaked value" },
  { id: "cadence", label: "Model-paced", missing: "Timing looks like a script or a human" },
  { id: "goal", label: "Goal-directed", missing: "No clear objective" },
];

function confidenceTone(c: number) {
  return c >= 0.9 ? "certain" : c >= 0.7 ? "likely" : "possible";
}

function useAgents() {
  const { data, intel } = useDashboard();
  return useMemo(() => {
    const agents: Agent[] = [];
    for (const session of data.sessions) {
      if (session.interactions.length === 0) continue;
      const entry = intel.sessions[session.key];
      const analysis = entry ? intel.analyses[entry.fingerprint] : undefined;
      const evidence = agentEvidence(session, analysis?.attacker === "ai-agent");
      if (evidence.confidence >= AGENT_THRESHOLD) agents.push({ session, evidence });
    }
    return agents;
  }, [data.sessions, intel]);
}

export function AgentsPage() {
  const { data, now } = useDashboard();
  const [range, setRange] = useState<RangeId>("day");
  const all = useAgents();
  const from = rangeStart(range, now);
  const agents = useMemo(() => all.filter((a) => a.session.end >= from), [all, from]);
  // Correlated over the whole time range, so an operator rotating IPs over hours still ends up in one group.
  const operators = useMemo(() => correlateAgents(agents), [agents]);
  const operatorOf = useMemo(() => new Map(operators.flatMap((op) => op.sessions.map((s) => [s.key, op] as const))), [operators]);
  const [openOp, setOpenOp] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const current = agents.find((a) => a.session.key === pick) ?? agents[0];
  const evidenceRef = useRef<HTMLDivElement>(null);
  const operatorsRef = useRef<HTMLElement>(null);

  function showSession(key: string) {
    setPick(key);
    evidenceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function showOperator(id: string) {
    setOpenOp(id);
    requestAnimationFrame(() => operatorsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const caught = agents.filter((a) => a.evidence.signals.some((s) => s.id === "canary")).length;
  const rotating = operators.filter((op) => op.ips.length > 2).length;
  // Fast scripts posing as agents would win this outright, so only count likely agents.
  const fastest = Math.min(...agents.flatMap((a) => (a.evidence.timeToLoot && confidenceTone(a.evidence.confidence) !== "possible" ? [a.evidence.timeToLoot] : [])));

  return (
    <div className="page-content">
      <header className="page-head enter" style={{ "--i": 1 } as CSSProperties}>
        <div className="page-head-text">
          <h1 className="page-title">Threat intelligence</h1>
          <p className="page-sub">The operators behind the AI agents that hit the honeypot, correlated across rotating IPs, and the behavior that gave each one away.</p>
        </div>
        <Segmented label="Time range" options={data.ranges} value={range} onChange={setRange} />
      </header>

      <ul className="stats" aria-label="AI agent metrics">
        <AgentStat index={0} icon={BotIcon} label="Agents detected" value={agents.length} />
        <AgentStat index={1} icon={ShieldIcon} label="Caught by the canary" value={agents.length ? `${caught}/${agents.length}` : "0"} />
        <AgentStat
          index={2}
          icon={UsersIcon}
          label="Operators behind them"
          value={operators.length}
          note={rotating ? `${rotating} rotate IPs` : undefined}
          noteTitle="Operators seen on 3 or more IP addresses"
        />
        <AgentStat index={3} icon={ClockIcon} label="Fastest full compromise" value={Number.isFinite(fastest) ? formatDuration(fastest) : "—"} />
      </ul>

      {agents.length === 0 || !current ? (
        <div className="empty enter" style={{ "--i": 3 } as CSSProperties}>
          <p className="empty-title">No AI agent caught yet</p>
          <p className="empty-sub">
            Point an agent at the MCP honeypot with <code className="code-chip">bun run attack:claude</code>
          </p>
        </div>
      ) : (
        <>
          <div className="agents-grid" ref={evidenceRef}>
            <section className="card agents-list-card enter" style={{ "--i": 3 } as CSSProperties} aria-label="Detected agents">
              <header className="card-head">
                <h2 className="card-title">Detected</h2>
                <span className="map-note">newest first</span>
              </header>
              <ol className="agents-list">
                {agents.slice(0, 60).map((a) => (
                  <li key={a.session.key}>
                    <AgentRow agent={a} selected={a === current} onSelect={() => setPick(a.session.key)} />
                  </li>
                ))}
              </ol>
            </section>
            <AgentEvidenceCard key={current.session.key} agent={current} operator={operatorOf.get(current.session.key)} onShowOperator={showOperator} />
          </div>
          <OperatorsCard
            ref={operatorsRef}
            operators={operators}
            agents={agents}
            open={openOp}
            current={current.session.key}
            onToggle={(id) => setOpenOp((o) => (o === id ? null : id))}
            onPick={showSession}
          />
        </>
      )}
    </div>
  );
}

function AgentStat({
  index,
  icon: Icon,
  label,
  value,
  note,
  noteTitle,
}: {
  index: number;
  icon: typeof BotIcon;
  label: string;
  value: string | number;
  note?: string;
  noteTitle?: string;
}) {
  return (
    <li className="stat enter" style={{ "--i": 2 + index * 0.4 } as CSSProperties}>
      <span className="stat-label">
        <Icon size={16} strokeWidth={1.7} className="stat-icon" />
        {label}
      </span>
      <div className="stat-row">
        <Digits value={value} delay={420 + index * 70} className="stat-value" />
        {note && (
          <span className="delta delta-new" title={noteTitle}>
            {note}
          </span>
        )}
      </div>
    </li>
  );
}

function ConfidenceRing({ value, size = 36 }: { value: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="conf-ring" data-tone={confidenceTone(value)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="conf-track" />
        <circle cx={size / 2} cy={size / 2} r={r} className="conf-fill" strokeDasharray={`${c * value} ${c}`} />
      </svg>
      <span className="conf-num">{Math.round(value * 100)}</span>
    </span>
  );
}

function AgentRow({ agent, selected, onSelect }: { agent: Agent; selected: boolean; onSelect: () => void }) {
  const { now } = useDashboard();
  const { session, evidence } = agent;
  const seen = new Set(evidence.signals.map((s) => s.id));
  return (
    <button type="button" className="agent-row" data-selected={selected} aria-pressed={selected} onClick={onSelect}>
      <ConfidenceRing value={evidence.confidence} />
      <span className="agent-row-main">
        <span className="agent-row-title">{sessionTitle(session)}</span>
        <span className="agent-row-meta">
          {session.country && <CountryFlag code={session.country} size={12} />}
          {session.ip || "Unknown IP"} · {relativeTime(session.end, now)} ago
        </span>
      </span>
      <span className="agent-signal-dots" aria-label={`${seen.size} of ${SIGNALS.length} signals`}>
        {SIGNALS.map((s) => (
          <i key={s.id} data-on={seen.has(s.id)} data-canary={s.id === "canary"} title={s.label} />
        ))}
      </span>
    </button>
  );
}

function AgentEvidenceCard({ agent, operator, onShowOperator }: { agent: Agent; operator?: AgentOperator; onShowOperator: (id: string) => void }) {
  const { openSession, now } = useDashboard();
  const { session, evidence } = agent;
  const { analysis } = useSessionIntel(session);
  const byId = new Map(evidence.signals.map((s) => [s.id, s]));
  const tone = confidenceTone(evidence.confidence);

  return (
    <section className="card agent-evidence enter swap-in" style={{ "--i": 3.4 } as CSSProperties} aria-label="Evidence">
      <header className="agent-hero">
        <ConfidenceRing value={evidence.confidence} size={64} />
        <div className="agent-hero-text">
          <p className="agent-hero-kicker" data-tone={tone}>
            {tone === "certain" ? "AI agent, confirmed" : tone === "likely" ? "Likely an AI agent" : "Possibly an AI agent"}
          </p>
          <p className="agent-hero-title">{analysis?.verdict ?? sessionTitle(session)}</p>
          <p className="agent-hero-meta">
            <IpAvatar ip={session.ip} size={22} />
            {session.ip || "Unknown IP"} · {session.service} · {relativeTime(session.end, now)} ago
            {analysis && <SeverityPill severity={analysis.severity} />}
          </p>
        </div>
      </header>

      <h3 className="agent-sub">Why we think it's a model</h3>
      <ul className="agent-signals">
        {SIGNALS.map((s) => {
          const hit = byId.get(s.id);
          return (
            <li key={s.id} data-on={!!hit} data-canary={s.id === "canary"}>
              <span className="agent-signal-mark" aria-hidden="true">
                {hit ? "✓" : "–"}
              </span>
              <span>
                <span className="agent-signal-label">{s.label}</span>
                <span className="agent-signal-detail">{hit ? hit.detail : s.missing}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {evidence.loot.length > 0 && (
        <>
          <h3 className="agent-sub">
            What it walked away with
            {evidence.timeToLoot !== null && <span className="agent-sub-note">all of it in {formatDuration(evidence.timeToLoot)}</span>}
          </h3>
          <ul className="agent-loot">
            {evidence.loot.map((l) => (
              <li key={l}>{LOOT_LABELS[l]}</li>
            ))}
          </ul>
        </>
      )}

      <h3 className="agent-sub">Replay</h3>
      <ol className="agent-steps">
        {evidence.steps.map((step, i) => (
          <li key={i} data-canary={step.canary}>
            <span className="agent-step-gap">{step.gap === null ? "start" : `+${(step.gap / 1000).toFixed(1)}s`}</span>
            <span className="agent-step-body">
              <code className="agent-step-call">{step.input}</code>
              <span className="agent-step-tags">
                {step.canary && <span className="agent-tag" data-kind="canary">canary tripped</span>}
                {step.reused && (
                  <span className="agent-tag" data-kind="reused" title={step.reused.value}>
                    reused {step.reused.value.length > 28 ? `${step.reused.value.slice(0, 28)}…` : step.reused.value} from {step.reused.from}
                  </span>
                )}
                {step.loot && <span className="agent-tag" data-kind="loot">{LOOT_LABELS[step.loot]}</span>}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {operator && operator.sessions.length > 1 && (
        <button type="button" className="agent-operator-link" onClick={() => onShowOperator(operator.id)}>
          <UsersIcon size={14} />
          <span>
            Same operator as <b>{operator.sessions.length - 1} other session{operator.sessions.length > 2 ? "s" : ""}</b> from {operator.ips.length} IPs · {operator.id}
          </span>
          <ArrowRightIcon size={13} />
        </button>
      )}

      <button type="button" className="link-more agent-open" onClick={() => openSession(session.key)}>
        Open full session
        <ArrowRightIcon size={13} />
      </button>
    </section>
  );
}

/** One row per operator; opening it shows why its runs are linked, then the runs themselves. */
function OperatorsCard({
  ref,
  operators,
  agents,
  open,
  current,
  onToggle,
  onPick,
}: {
  ref: Ref<HTMLElement>;
  operators: AgentOperator[];
  agents: Agent[];
  open: string | null;
  current: string;
  onToggle: (id: string) => void;
  onPick: (key: string) => void;
}) {
  const { now } = useDashboard();
  const shown = operators.filter((op) => op.sessions.length > 1);
  if (shown.length === 0) return null;
  const span = Math.max(1, now - Math.min(...shown.map((op) => op.first)));
  const byKey = new Map(agents.map((a) => [a.session.key, a]));
  return (
    <section ref={ref} className="card operators-card enter" style={{ "--i": 3.8 } as CSSProperties} aria-label="Operators">
      <header className="card-head">
        <h2 className="card-title">Operators</h2>
        <span className="map-note">the same agent across IPs, linked by behavior</span>
      </header>
      <ol className="operator-rows">
        {shown.map((op) => {
          const isOpen = open === op.id;
          return (
            <li key={op.id} data-open={isOpen}>
              <button type="button" className="operator-row" aria-expanded={isOpen} onClick={() => onToggle(op.id)}>
                <TriangleIcon size={8} className="operator-tri" data-open={isOpen} />
                <span className="operator-id">{op.id}</span>
                <span className="operator-counts">
                  {op.sessions.length} runs · {op.ips.length} IPs
                </span>
                <span className="operator-goal">
                  {GOAL_LABELS[op.profile.goal].label}
                  <span className="soph-dot" data-level={op.profile.level} title={`Sophistication ${op.profile.level}, ${op.profile.score}/100`} />
                </span>
                <span className="operator-flags" aria-label={`${op.countries.length} countries`}>
                  {op.countries.slice(0, 5).map((c) => (
                    <CountryFlag key={c} code={c} size={13} />
                  ))}
                  {op.countries.length > 5 && <span>+{op.countries.length - 5}</span>}
                </span>
                <span className="operator-track" aria-hidden="true">
                  {op.sessions.map((s) => (
                    <i key={s.key} style={{ "--x": 1 - (now - s.end) / span } as CSSProperties} />
                  ))}
                </span>
                <span className="operator-cohesion" title="Average similarity between linked runs">
                  {Math.round(op.cohesion * 100)}%
                </span>
              </button>
              {isOpen && (
                <div className="operator-detail swap-in">
                  <div className="operator-profile">
                    <p className="operator-profile-head">
                      <span className="operator-profile-goal">{GOAL_LABELS[op.profile.goal].label}</span>
                      <span className="soph" data-level={op.profile.level}>
                        {op.profile.level} sophistication · {op.profile.score}/100
                      </span>
                    </p>
                    <p className="operator-motive">{GOAL_LABELS[op.profile.goal].motive}</p>
                    <ul className="operator-factors">
                      {op.profile.factors.map((f) => (
                        <li key={f.text} data-up={f.points > 0}>
                          <span className="operator-factor-pts">{f.points > 0 ? `+${f.points}` : f.points}</span>
                          {f.text}
                        </li>
                      ))}
                    </ul>
                    <p className="operator-disclaimer">
                      A profile from what it did here, not an attribution: IPs are rented, and where they sit says nothing about who is behind them.
                    </p>
                  </div>
                  <h3 className="agent-sub">Why these runs are linked</h3>
                  <ul className="operator-traits">
                    {op.traits.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <ol className="operator-sessions">
                    {op.sessions.map((s) => {
                      const a = byKey.get(s.key);
                      return (
                        <li key={s.key}>
                          <button type="button" className="operator-session" data-selected={s.key === current} onClick={() => onPick(s.key)}>
                            {a && <ConfidenceRing value={a.evidence.confidence} size={26} />}
                            <span className="agent-row-meta">
                              {s.country && <CountryFlag code={s.country} size={12} />}
                              {s.ip || "Unknown IP"}
                            </span>
                            <span className="operator-session-title">{sessionTitle(s)}</span>
                            <span className="operator-session-age">{relativeTime(s.end, now)} ago</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
