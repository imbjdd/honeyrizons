
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  ACCENTS,
  DashboardContext,
  type AnalyticsDashboardAccent,
  type AnalyticsDashboardPage,
  type AnalyticsDashboardStatus,
} from "@/components/analytics-dashboard/context";
import type { AnalyticsDashboardData } from "@/components/analytics-dashboard/data";
import { SessionDetails, type Phase } from "@/components/analytics-dashboard/details";
import { HomeIcon, PanelIcon, ServerIcon, SettingsIcon, TerminalIcon } from "@/components/analytics-dashboard/icons";
import { OverviewPage, ServicesPage, SessionsPage, SettingsPage } from "@/components/analytics-dashboard/pages";
import "./analytics-dashboard.css";

export type { AnalyticsDashboardData } from "@/components/analytics-dashboard/data";
export type { AnalyticsDashboardAccent, AnalyticsDashboardPage, AnalyticsDashboardStatus } from "@/components/analytics-dashboard/context";

/** Keep in sync with the `analytics-dashboard` container queries in analytics-dashboard.css. */
const OVERLAY_WIDTH = 1180;
const COMPACT_WIDTH = 760;
const EXIT_MS = 150;

const NAV = [
  { page: "overview", label: "Overview", Icon: HomeIcon },
  { page: "services", label: "Services", Icon: ServerIcon },
  { page: "sessions", label: "Sessions", Icon: TerminalIcon },
  { page: "settings", label: "Settings", Icon: SettingsIcon },
] as const satisfies readonly { page: AnalyticsDashboardPage; label: string; Icon: typeof HomeIcon }[];

const PAGES: Record<AnalyticsDashboardPage, () => ReactNode> = {
  overview: OverviewPage,
  services: ServicesPage,
  sessions: SessionsPage,
  settings: SettingsPage,
};

export interface AnalyticsDashboardProps {
  /** Metrics, services and sessions derived from the honeypot event stream. */
  data: AnalyticsDashboardData;
  /** Live connection state shown in the sidebar and on the Settings page. */
  status: AnalyticsDashboardStatus;
  /** Reference time for relative dates; tick it to keep "x min ago" fresh. */
  now: number;
  /** Product name and optional logo at the top of the sidebar. */
  brand?: { name: string; logo?: ReactNode };
  /** Controlled page. */
  page?: AnalyticsDashboardPage;
  /** Initial page when uncontrolled. */
  defaultPage?: AnalyticsDashboardPage;
  onPageChange?: (page: AnalyticsDashboardPage) => void;
  /** Initial accent color. Settings → Appearance changes it. */
  defaultAccent?: AnalyticsDashboardAccent;
  onAccentChange?: (accent: AnalyticsDashboardAccent) => void;
  /** Plain color behind the window. */
  background?: string;
  className?: string;
  style?: CSSProperties;
}

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function AnalyticsDashboard({
  data,
  status,
  now,
  brand = { name: "Honeyrizons" },
  page: pageProp,
  defaultPage = "overview",
  onPageChange,
  defaultAccent = "blue",
  onAccentChange,
  background,
  className,
  style,
}: AnalyticsDashboardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [rootRef, width] = useContainerWidth();
  const [pageState, setPageState] = useState<AnalyticsDashboardPage>(defaultPage);
  const page = pageProp ?? pageState;
  const [selected, setSelected] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("in");
  const [panelOpen, setPanelOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [accent, setAccentState] = useState<AnalyticsDashboardAccent>(defaultAccent);
  const [booted, setBooted] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const hideRef = useRef<HTMLButtonElement>(null);

  // Layout follows the dashboard's own width, so it also works inside a panel or a preview.
  const overlay = width !== null && width <= OVERLAY_WIDTH;
  const compact = width !== null && width <= COMPACT_WIDTH;
  const layout = useRef({ overlay, compact });
  useEffect(() => {
    layout.current = { overlay, compact };
  }, [overlay, compact]);

  // Desktop keeps the panel docked unless collapsed; narrower layouts slide it over on demand.
  const detailsVisible = overlay ? panelOpen : !collapsed;
  const navFloating = compact && navOpen;

  // First-load entrances wait for the window to land; later page swaps start right away.
  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [page]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const navigate = useCallback(
    (next: AnalyticsDashboardPage) => {
      if (pageProp === undefined) setPageState(next);
      onPageChange?.(next);
      if (layout.current.compact) setNavOpen(false);
    },
    [pageProp, onPageChange],
  );

  const setAccent = useCallback(
    (next: AnalyticsDashboardAccent) => {
      setAccentState(next);
      onAccentChange?.(next);
    },
    [onAccentChange],
  );

  const hideDetails = useCallback(() => {
    // Focus would otherwise fall to <body> once the panel turns inert.
    const hadFocus = panelRef.current?.contains(document.activeElement) ?? false;
    if (layout.current.overlay) setPanelOpen(false);
    else setCollapsed(true);
    if (hadFocus) requestAnimationFrame(() => reopenRef.current?.focus({ preventScroll: true }));
  }, []);

  function showDetails() {
    if (layout.current.overlay) setPanelOpen(true);
    else setCollapsed(false);
    requestAnimationFrame(() => hideRef.current?.focus({ preventScroll: true }));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (overlay && panelOpen) hideDetails();
    else if (navFloating) setNavOpen(false);
    else return;
    // Marks Escape as handled, so a surrounding dialog or full-screen preview stays open.
    event.preventDefault();
  }

  const ctx = useMemo(() => {
    function openSession(n: string) {
      setSelected(n);
      if (layout.current.overlay) setPanelOpen(true);
      else setCollapsed(false);
      window.clearTimeout(timer.current);
      if (n === shown) {
        setPhase("in");
        return;
      }
      setPhase("out");
      timer.current = window.setTimeout(() => {
        setShown(n);
        setPhase("pre");
        // Two frames so the "pre" offset paints before transitioning to "in".
        requestAnimationFrame(() => requestAnimationFrame(() => setPhase("in")));
      }, EXIT_MS);
    }
    return {
      data,
      status,
      now,
      uid,
      selected,
      openSession,
      navigate,
      accent,
      setAccent,
    };
  }, [data, status, now, uid, selected, shown, navigate, accent, setAccent]);

  const activeIndex = NAV.findIndex((item) => item.page === page);
  const title = NAV[activeIndex]?.label ?? "";
  const Page = PAGES[page] ?? OverviewPage;
  // Until something is picked, show the most recent session.
  const shownSession = data.sessions.find((s) => s.key === shown) ?? data.sessions[0];
  const navId = `${uid}-nav`;
  const detailsId = `${uid}-details`;

  return (
    <DashboardContext value={ctx}>
      <div
        ref={rootRef}
        className={cn("obsidian-analytics-dashboard", className)}
        data-compact={compact}
        style={{ "--accent": ACCENTS[accent].ui, ...(background ? { "--obsidian-analytics-dashboard-background": background } : null), ...style } as CSSProperties}
        onKeyDown={onKeyDown}
      >
        <div
          className="window"
          data-panel-open={panelOpen}
          data-collapsed={collapsed || !shownSession}
          data-nav-open={navOpen}
          data-scrim={(overlay && panelOpen) || navFloating}
          data-booted={booted}
        >
          <nav id={navId} className="rail" aria-label="Primary" data-expanded={navOpen}>
            <button type="button" className="rail-brand press" aria-label={`${brand.name} overview`} onClick={() => navigate("overview")}>
              {brand.logo ? (
                <span className="rail-logo-custom">{brand.logo}</span>
              ) : (
                <span className="rail-logo">
                  <span className="rail-logo-shine" />
                </span>
              )}
              <span className="rail-label rail-brand-name" aria-hidden="true">
                {brand.name}
              </span>
            </button>

            <div className="rail-nav" style={{ "--active": Math.max(0, activeIndex) } as CSSProperties}>
              <span className="rail-indicator" aria-hidden="true" data-hidden={activeIndex < 0} />
              <ul className="rail-list">
                {NAV.map(({ page: target, label, Icon }, i) => {
                  const active = i === activeIndex;
                  return (
                    <li key={target}>
                      <button
                        type="button"
                        className="rail-btn press has-tip tip-right"
                        data-tip={label}
                        aria-label={label}
                        aria-current={active ? "page" : undefined}
                        data-active={active}
                        onClick={() => navigate(target)}
                      >
                        <Icon size={19} strokeWidth={1.7} className="rail-icon" />
                        <span className="rail-label" aria-hidden="true">
                          {label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <button
              type="button"
              className="rail-account press has-tip tip-right"
              data-tip={status.connected ? "Live stream" : "Disconnected"}
              aria-label={status.connected ? "Live stream, settings" : "Disconnected, settings"}
              onClick={() => navigate("settings")}
            >
              <span className="rail-icon live-dot-wrap">
                <span className="live-dot" data-live={status.connected} />
              </span>
              <span className="rail-label rail-account-text" aria-hidden="true">
                <span className="rail-account-name">{status.connected ? "Live" : "Offline"}</span>
                <span className="rail-account-mail">{status.totalEvents} events</span>
              </span>
            </button>
          </nav>

          <main className="main">
            <header className="main-bar enter" style={{ "--i": 0 } as CSSProperties}>
              <button
                type="button"
                className="icon-btn press has-tip tip-below"
                data-tip={navOpen ? "Collapse sidebar" : "Expand sidebar"}
                aria-label="Sidebar"
                aria-expanded={navOpen}
                aria-controls={navId}
                onClick={() => setNavOpen((o) => !o)}
              >
                <PanelIcon side="left" open={navOpen} size={15} />
              </button>
              <span className="main-bar-title">
                <span key={title} className="swap-in">
                  {title}
                </span>
              </span>
              {shownSession && (
                <button
                  ref={reopenRef}
                  type="button"
                  className="icon-btn press has-tip tip-below tip-end details-reopen"
                  data-tip="Show session details"
                  data-visible={!detailsVisible}
                  inert={detailsVisible}
                  aria-label="Show session details"
                  aria-expanded={detailsVisible}
                  aria-controls={detailsId}
                  onClick={showDetails}
                >
                  <PanelIcon side="right" size={15} />
                </button>
              )}
            </header>
            <div className="main-scroll" ref={scrollRef}>
              {/* Keyed by page so every page swap replays its entrance stagger. */}
              <div key={page} className="page">
                <Page />
              </div>
            </div>
          </main>

          {shownSession && (
            <SessionDetails session={shownSession} phase={phase} open={panelOpen} visible={detailsVisible} panelRef={panelRef} hideRef={hideRef} onHide={hideDetails} />
          )}
          <button
            type="button"
            className="scrim"
            aria-label="Close panel"
            tabIndex={-1}
            // Keep focus where it was instead of parking it on the scrim.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (panelOpen) hideDetails();
              if (layout.current.compact) setNavOpen(false);
            }}
          />
        </div>
      </div>
    </DashboardContext>
  );
}

export default AnalyticsDashboard;
