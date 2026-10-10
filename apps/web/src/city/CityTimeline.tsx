import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { describeEvent, type ChronicleEvent, type Severity } from "@honeyrizons/shared";
import { SeverityPill } from "@/components/analytics-dashboard/ai";
import { relativeTime } from "@/components/analytics-dashboard/data";
import { ArrowRightIcon, ClockIcon } from "@/components/analytics-dashboard/icons";
import { SEVERITY_GLOW } from "./attackers";

/** Markers closer together than this share a slot, so a burst of events stays readable. */
const MARKER_GAP = 0.006;

const clock = (at: number) => new Date(at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
const day = (at: number) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function markerColor(e: ChronicleEvent): string {
  if (e.type === "threat.emerged" || e.type === "campaign.spread") return SEVERITY_GLOW[e.severity];
  if (e.type === "service.status" && e.status === "besieged") return SEVERITY_GLOW.high;
  return "rgba(255,255,255,0.55)";
}

/**
 * Scrubs through the city's chronicle. Dragging the handle rewinds the whole city: which services stood, what state
 * they were in, and who was in the streets at that instant.
 */
export function CityTimeline({
  events,
  now,
  viewedAt,
  live,
  onScrub,
}: {
  events: ChronicleEvent[];
  now: number;
  viewedAt: number;
  live: boolean;
  onScrub: (at: number | null) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [dragging, setDragging] = useState(false);

  const start = events[0]?.at ?? now - 3_600_000;
  const span = Math.max(now - start, 60_000);
  const ratio = (at: number) => Math.min(1, Math.max(0, (at - start) / span));

  // Events in time order, thinned so overlapping dots do not pile up into a smear.
  const markers = useMemo(() => {
    const sorted = [...events].filter((e) => e.type !== "genesis").sort((a, b) => a.at - b.at);
    const out: { event: ChronicleEvent; at: number; left: number }[] = [];
    for (const event of sorted) {
      const left = ratio(event.at);
      const last = out[out.length - 1];
      // Keep the more severe of two neighbours rather than whichever came first.
      if (last && left - last.left < MARKER_GAP) {
        if (weight(event) > weight(last.event)) out[out.length - 1] = { event, at: event.at, left };
        continue;
      }
      out.push({ event, at: event.at, left });
    }
    return out;
  }, [events, start, span]);

  const nearest = useMemo(() => {
    let best: ChronicleEvent | undefined;
    for (const e of events) if (e.at <= viewedAt && (!best || e.at > best.at)) best = e;
    return best;
  }, [events, viewedAt]);

  const scrubTo = useCallback(
    (clientX: number) => {
      const box = track.current?.getBoundingClientRect();
      if (!box) return;
      const at = start + ((clientX - box.left) / box.width) * span;
      cancelAnimationFrame(frame.current);
      // Dragging fires far faster than the city can rebuild; one update per frame is plenty.
      frame.current = requestAnimationFrame(() => onScrub(at >= now - 1000 ? null : Math.max(start, at)));
    },
    [start, span, now, onScrub],
  );

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    scrubTo(event.clientX);
  }

  /** Steps to the event before or after the handle, which is how you actually read a history. */
  function step(direction: -1 | 1) {
    const ordered = [...events].sort((a, b) => a.at - b.at);
    const next =
      direction < 0
        ? [...ordered].reverse().find((e) => e.at < viewedAt - 500)
        : ordered.find((e) => e.at > viewedAt + 500);
    if (next) onScrub(next.at >= now - 1000 ? null : next.at);
    else if (direction > 0) onScrub(null);
  }

  const left = `${ratio(viewedAt) * 100}%`;
  const described = nearest ? describeEvent(nearest) : undefined;

  return (
    <section className={cn("city-panel city-timeline", !live && "is-rewound")} aria-label="City timeline">
      <div className="city-timeline-head">
        <button type="button" className="icon-btn press has-tip tip-top" data-tip="Previous event" aria-label="Previous event" onClick={() => step(-1)}>
          <ArrowRightIcon size={14} style={{ transform: "rotate(180deg)" }} />
        </button>
        <button type="button" className="icon-btn press has-tip tip-top" data-tip="Next event" aria-label="Next event" onClick={() => step(1)}>
          <ArrowRightIcon size={14} />
        </button>

        <p className="city-timeline-when">
          {live ? (
            <>
              <span className="live-dot" data-live aria-hidden="true" />
              Live
            </>
          ) : (
            <>
              <ClockIcon size={13} />
              {day(viewedAt)} {clock(viewedAt)} · {relativeTime(viewedAt, now)} ago
            </>
          )}
        </p>

        {described && (
          <p className="city-timeline-event">
            {described.severity && <SeverityPill severity={described.severity} />}
            <span>{described.title}</span>
          </p>
        )}

        {!live && (
          <button type="button" className="btn press city-timeline-live" onClick={() => onScrub(null)}>
            Back to live
          </button>
        )}
      </div>

      <div
        ref={track}
        className="city-timeline-track"
        role="slider"
        tabIndex={0}
        aria-label="Point in time"
        aria-valuemin={start}
        aria-valuemax={now}
        aria-valuenow={viewedAt}
        aria-valuetext={live ? "Live" : `${day(viewedAt)} ${clock(viewedAt)}`}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => dragging && scrubTo(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(e) => {
          const nudge = span / 48;
          if (e.key === "ArrowLeft") onScrub(Math.max(start, viewedAt - nudge));
          else if (e.key === "ArrowRight") onScrub(viewedAt + nudge >= now - 1000 ? null : viewedAt + nudge);
          else if (e.key === "Home") onScrub(start);
          else if (e.key === "End") onScrub(null);
          else return;
          e.preventDefault();
        }}
      >
        <div className="city-timeline-fill" style={{ width: left }} />
        {markers.map(({ event, at, left: x }) => {
          const d = describeEvent(event);
          return (
            <i
              key={event.id}
              className="city-timeline-mark"
              style={{ left: `${x * 100}%`, "--c": markerColor(event) } as CSSProperties}
              data-strong={weight(event) >= 2}
              title={`${clock(at)} · ${d.title}`}
            />
          );
        })}
        <div className="city-timeline-handle" style={{ left }} />
      </div>

      <div className="city-timeline-scale" aria-hidden="true">
        <span>{day(start)}</span>
        <span>now</span>
      </div>
    </section>
  );
}

const SEVERITY_WEIGHT: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 4 };

/** How much a marker deserves its slot when two land on the same pixel. */
function weight(e: ChronicleEvent) {
  if (e.type === "threat.emerged" || e.type === "campaign.spread") return SEVERITY_WEIGHT[e.severity];
  if (e.type === "service.discovered" || e.type === "milestone") return 2;
  return 1;
}
