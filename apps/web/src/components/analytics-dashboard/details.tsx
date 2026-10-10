import { useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useDashboard } from "./context";
import { countryName, formatDuration, sessionTitle, type AnalyticsSession } from "./data";
import { CountryFlag } from "./flag";
import { PanelIcon, TriangleIcon } from "./icons";
import { IpAvatar, ProtocolIcon } from "./ui";

export type Phase = "in" | "out" | "pre";

type Props = {
  session: AnalyticsSession;
  phase: Phase;
  /** Slide-over state below the desktop breakpoint. */
  open: boolean;
  /** Whether the panel is on screen in the current layout. */
  visible: boolean;
  panelRef: RefObject<HTMLElement | null>;
  hideRef: RefObject<HTMLButtonElement | null>;
  onHide: () => void;
};

const formatTime = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour12: false });
const formatDate = (t: number) => new Date(t).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium", hour12: false });

export function SessionDetails({ session, phase, open, visible, panelRef, hideRef, onHide }: Props) {
  const { uid } = useDashboard();
  const scrollRef = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = scrollRef.current;
    if (el) el.dataset.scrolled = String(el.scrollTop > 4);
  }

  const panelId = `${uid}-details`;
  const titleId = `${uid}-details-title`;
  const isHttp = session.protocol === "HTTP";
  const isMcp = session.protocol === "MCP";

  return (
    <aside ref={panelRef} id={panelId} className="details" data-open={open} inert={!visible} aria-labelledby={titleId}>
      <header className="details-bar enter" style={{ "--i": 1 } as CSSProperties}>
        <button
          ref={hideRef}
          type="button"
          className="icon-btn press has-tip tip-below details-hide"
          data-tip="Hide session details"
          aria-label="Hide session details"
          aria-expanded={visible}
          aria-controls={panelId}
          onClick={onHide}
        >
          <PanelIcon side="right" open size={15} />
        </button>
        <span id={titleId} className="details-bar-title">
          <span key={session.key} className="swap-in">
            Session {session.protocol}
          </span>
        </span>
      </header>

      <div className="details-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="details-body enter" style={{ "--i": 2 } as CSSProperties}>
          <div className="details-swap" data-phase={phase}>
            <p className="status" data-kind={session.status.kind}>
              <ProtocolIcon protocol={session.protocol} size={15} />
              {session.status.label}
            </p>
            <h2 className="details-title">{sessionTitle(session)}</h2>

            <dl className="kv">
              <div>
                <dt>Source</dt>
                <dd>
                  <IpAvatar ip={session.ip} size={22} />
                  <span className="mono">{session.ip || "unknown"}</span>
                </dd>
              </div>
              <div>
                <dt>Country</dt>
                <dd>
                  {session.country && <CountryFlag code={session.country} size={18} />}
                  {countryName(session.country)}
                </dd>
              </div>
              <div>
                <dt>Service</dt>
                <dd>{session.service}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{formatDate(session.start)}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{formatDuration(session.end - session.start)}</dd>
              </div>
              {session.client && (
                <div>
                  <dt>Client</dt>
                  <dd className="mono details-client">{session.client}</dd>
                </div>
              )}
            </dl>

            {session.creds.length > 0 && (
              <Disclosure key={`c-${session.key}`} title={`Credentials (${session.creds.length})`}>
                <ul className="cred-list">
                  {session.creds.map((c, i) => (
                    <li key={i}>
                      <code className="code-chip">{c.user || "∅"}</code>
                      <span aria-hidden="true">:</span>
                      <code className="code-chip">{c.password}</code>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            )}

            <Disclosure key={`t-${session.key}`} title={`${isHttp ? "Requests" : isMcp ? "Tool calls" : "Transcript"} (${session.interactions.length})`}>
              {session.interactions.length === 0 ? (
                <p>No commands recorded.</p>
              ) : (
                <ol className="transcript">
                  {session.interactions.map((it, i) => (
                    <li key={i}>
                      <div className="transcript-in">
                        <span className="transcript-prompt">{isHttp ? "→" : isMcp ? "ƒ" : "$"}</span>
                        <code>{it.input}</code>
                        <time>{formatTime(it.time)}</time>
                      </div>
                      {it.output && !isHttp && <pre className="transcript-out">{it.output}</pre>}
                    </li>
                  ))}
                </ol>
              )}
            </Disclosure>

            <Disclosure key={`r-${session.key}`} title={`Raw events (${session.events.length})`} defaultOpen={false}>
              <pre className="transcript-out raw">{JSON.stringify(session.events, null, 2)}</pre>
            </Disclosure>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Disclosure({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="acc" data-open={open}>
      <button type="button" className="acc-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <TriangleIcon size={10} className="acc-tri" />
        {title}
      </button>
      <div className="acc-panel" id={id}>
        <div className="acc-inner">{children}</div>
      </div>
    </div>
  );
}
