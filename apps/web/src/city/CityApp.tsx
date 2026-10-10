import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  Download,
  Expand,
  HelpCircle,
  Home,
  Layers3,
  MapPin,
  Maximize,
  Moon,
  Pause,
  Plus,
  Minus,
  RotateCcw,
  RotateCw,
  Search,
  Shield,
  Sun,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import CityCanvas from "./CityCanvas";
import ExploreOverlay from "./ExploreOverlay";
import {
  buildings,
  residents,
  type HoverTarget,
  type Inspection,
  type RoomLocation,
} from "./explore";
import {
  districts,
  type CityEvent,
  type CityHandle,
  type DataView,
  type Protocol,
} from "./model";
import {
  useCitySound,
  useCityTheme,
  useDemoCity,
  useReducedMotion,
} from "./useDemoCity";
import "./city.css";

type Panel =
  | "activity"
  | "district"
  | "views"
  | "places"
  | "help"
  | "about"
  | "stats"
  | null;
const dataViews: {
  id: DataView;
  title: string;
  japanese: string;
  description: string;
}[] = [
  {
    id: "city",
    title: "City",
    japanese: "街",
    description: "Show shops, residents, and traffic.",
  },
  {
    id: "protocols",
    title: "Protocol districts",
    japanese: "区域",
    description: "See where each kind of connection arrives.",
  },
  {
    id: "traffic",
    title: "Street traffic",
    japanese: "交通",
    description: "Follow the cars, buses, and the city tram.",
  },
  {
    id: "threats",
    title: "Threat activity",
    japanese: "活動",
    description: "Locate incoming demo activity across the city.",
  },
];

function HoneyMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m20 3 14.7 8.5v17L20 37 5.3 28.5v-17L20 3Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M13 12v16m14-16v16M13 20h14"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="m20 3 7.3 4.3v8.5L20 20l-7.3-4.2V7.3L20 3Z"
        fill="currentColor"
        opacity=".12"
      />
    </svg>
  );
}

function ToolButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  shortcut,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      className={`tool-button${active ? " is-active" : ""}`}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
      <span className="tool-tooltip">
        {label}
        {shortcut && <kbd>{shortcut}</kbd>}
      </span>
    </button>
  );
}

function ActivityItem({
  event,
  expanded,
  select,
  visit,
}: {
  event: CityEvent;
  expanded: boolean;
  select: () => void;
  visit?: () => void;
}) {
  const district = districts.find((d) => d.id === event.protocol)!;
  return (
    <div className={`event-item${expanded ? " is-expanded" : ""}`}>
      <button
        className="event-trigger"
        onClick={select}
        aria-expanded={expanded}
      >
        <span className="event-symbol" style={{ color: district.color }}>
          <ArrowDownLeft size={16} />
        </span>
        <span className="event-copy">
          <span className="event-meta">
            <b style={{ color: district.color }}>{event.protocol}</b>
            <time>
              {new Date(event.time).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </time>
          </span>
          <span>{event.action}</span>
        </span>
        <ChevronRight size={14} className="event-chevron" />
      </button>
      {expanded && (
        <div className="event-detail">
          <p>{event.detail}</p>
          <dl>
            <div>
              <dt>Source</dt>
              <dd>{event.source}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{event.country}</dd>
            </div>
            <div>
              <dt>Activity</dt>
              <dd className={`severity ${event.severity}`}>{event.severity}</dd>
            </div>
          </dl>
          {visit && (
            <button className="event-visit" onClick={visit}>
              Find this district <ArrowUpRight size={11} />
            </button>
          )}
          <span className="demo-note">Simulated event</span>
        </div>
      )}
    </div>
  );
}

export default function CityApp() {
  const city = useRef<CityHandle | null>(null);
  const { theme, mode, selectMode } = useCityTheme();
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const { events, total } = useDemoCity(paused || reducedMotion);
  const { enabled: sound, toggle: toggleSound } = useCitySound();
  const [ready, setReady] = useState(false);
  const [room, setRoom] = useState<RoomLocation | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [following, setFollowing] = useState<string | null>(null);
  const [nearby, setNearby] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const onInspect = useCallback((value: Inspection | null) => {
    setInspection(value);
    if (value) setPanel(null);
  }, []);
  const onRoomChange = useCallback((value: RoomLocation | null) => {
    setRoom(value);
    setPanel(null);
    setTouring(false);
    setDropdown(false);
  }, []);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [district, setDistrict] = useState<Protocol>("SSH");
  const [view, setView] = useState<DataView>("city");
  const [touring, setTouring] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [photoFilter, setPhotoFilter] = useState("normal");
  const [query, setQuery] = useState("");
  const [protocol, setProtocol] = useState<Protocol | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [dropdown, setDropdown] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const selected = districts.find((d) => d.id === district)!;
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback((message: string) => setError(message), []);
  const onSelect = useCallback((id: Protocol) => {
    setDistrict(id);
    setPanel("district");
  }, []);
  const announce = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 3500);
  }, []);
  const onInteraction = useCallback(() => setTouring(false), []);
  const onPhotoSaved = useCallback(
    () => announce("Your city photo is ready to download."),
    [announce],
  );
  const options = useMemo(
    () => ({
      theme,
      paused,
      view,
      reducedMotion,
      inputBlocked: !!inspection || !!panel || dropdown,
      onNearby: setNearby,
      onReady,
      onError,
      onSelect,
      onInteraction,
      onPhotoSaved,
      onInspect,
      onRoomChange,
      onFollowChange: setFollowing,
      onHover: setHover,
    }),
    [
      theme,
      paused,
      view,
      reducedMotion,
      onReady,
      onError,
      onSelect,
      onInteraction,
      onPhotoSaved,
      onInspect,
      onRoomChange,
      inspection,
      panel,
      dropdown,
    ],
  );
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
  useEffect(() => {
    city.current?.pulse(events[0].protocol);
  }, [events]);
  useEffect(() => {
    if (!panel) return;
    const trigger = document.activeElement as HTMLElement;
    panelRef.current?.focus();
    return () => {
      if (trigger.isConnected) trigger.focus();
    };
  }, [panel]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.pointerLockElement) return;
        if (photo) {
          setPhoto(false);
          return;
        }
        if (inspection) {
          city.current?.inspect(null);
          return;
        }
        if (following) {
          city.current?.follow(null);
          return;
        }
        if (room && !panel && !photo) {
          city.current?.exit();
          return;
        }
        setPanel(null);
        setPhoto(false);
        setDropdown(false);
        setTouring(false);
        city.current?.tour(false);
        return;
      }
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (
        event.code === "Space" &&
        (event.target === document.body ||
          event.target instanceof HTMLCanvasElement)
      ) {
        event.preventDefault();
        setPaused((value) => !value);
      }
      if (event.key.toLowerCase() === "h") {
        city.current?.home();
        setTouring(false);
      }
      if (event.key === "+" || event.key === "=") city.current?.zoom(1);
      if (event.key === "-") city.current?.zoom(-1);
      if (event.key.toLowerCase() === "n")
        selectMode(theme === "day" ? "night" : "day");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [theme, selectMode, inspection, following, room, panel, photo]);

  function openPanel(next: Panel) {
    city.current?.inspect(null);
    setPanel((current) => (current === next ? null : next));
    setDropdown(false);
  }
  function visit(id: Protocol, inspect = false) {
    setDistrict(id);
    city.current?.focus(id);
    setTouring(false);
    setDropdown(false);
    if (inspect) setPanel("district");
  }
  function startTour() {
    const next = !touring;
    setTouring(next);
    city.current?.tour(next);
    setPanel(null);
    setDropdown(false);
  }
  function savePhoto() {
    city.current?.capture();
  }
  const visibleEvents = events.filter(
    (event) =>
      (protocol === "all" || event.protocol === protocol) &&
      `${event.action} ${event.source} ${event.country} ${event.detail} ${event.protocol}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const panelTitles: Record<NonNullable<Panel>, string> = {
    activity: "City activity",
    district: selected.name,
    views: "Data views",
    places: "Places",
    help: "City controls",
    about: "About Honeyrizons",
    stats: "Demo statistics",
  };

  return (
    <main
      className={`city-app theme-${theme}${photo ? " photo-mode" : ""}${room ? " in-room" : ""}`}
    >
      <a href="#city-controls" className="skip-link">
        Skip to city controls
      </a>
      <div className={`city-world filter-${photoFilter}`}>
        <CityCanvas options={options} handle={city} />
      </div>
      {!ready && !error && (
        <div className="city-loader" role="status">
          <HoneyMark size={44} />
          <span>Opening Honeyrizons</span>
          <div className="loader-line">
            <i />
          </div>
          <small>Loading the street and its shops.</small>
        </div>
      )}
      {error && (
        <div className="city-error" role="alert">
          <HoneyMark size={42} />
          <h1>The city could not open</h1>
          <p>{error}</p>
          <button
            className="primary-button"
            onClick={() => window.location.reload()}
          >
            Reload the city
          </button>
        </div>
      )}

      <div className={`city-hud${ready ? " is-ready" : ""}`}>
        <header className="city-brand glass">
          <button
            className="brand-button"
            onClick={() => openPanel("about")}
            aria-label="About Honeyrizons"
          >
            <HoneyMark />
            <span>
              <span className="wordmark">
                Honeyrizons<span className="brand-period">.</span>
              </span>
              <span className="brand-tagline">
                Click a person. Step inside a shop.
              </span>
            </span>
          </button>
          <span className="demo-badge">
            <i />
            Demo city
          </span>
        </header>

        <div
          className="environment-controls"
          role="group"
          aria-label="City environment"
        >
          <div className="control-group glass">
            <ToolButton
              label="Photo mode"
              onClick={() => {
                setPhoto(true);
                setPanel(null);
              }}
            >
              <Camera size={17} />
            </ToolButton>
            <ToolButton
              label={
                room
                  ? paused
                    ? "Resume room"
                    : "Pause room"
                  : "Take a city tour"
              }
              onClick={room ? () => setPaused((value) => !value) : startTour}
              active={room ? paused : touring}
              disabled={!room && reducedMotion}
            >
              {room ? <Pause size={17} /> : <Compass size={17} />}
            </ToolButton>
          </div>
          <div
            className="control-group glass theme-switch"
            role="group"
            aria-label="Time of day"
          >
            <ToolButton
              label="Day"
              onClick={() => selectMode("day")}
              active={mode === "day"}
            >
              <Sun size={17} />
            </ToolButton>
            <ToolButton
              label="Night"
              onClick={() => selectMode("night")}
              active={mode === "night"}
              shortcut="N"
            >
              <Moon size={16} />
            </ToolButton>
            <ToolButton
              label="Follow my clock"
              onClick={() => selectMode("clock")}
              active={mode === "clock"}
            >
              <Clock3 size={16} />
            </ToolButton>
          </div>
          <div className="control-group glass">
            <ToolButton
              label={sound ? "Mute city sound" : "Enable city sound"}
              onClick={() => {
                void toggleSound().catch(() =>
                  announce("Sound is unavailable in this browser."),
                );
              }}
              active={sound}
            >
              {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </ToolButton>
          </div>
        </div>

        <nav
          className="camera-toolbar glass"
          id="city-controls"
          tabIndex={-1}
          aria-label="Explore the city"
        >
          <ToolButton
            label="Zoom in"
            onClick={() => city.current?.zoom(1)}
            shortcut="+"
          >
            <Plus size={18} />
          </ToolButton>
          <ToolButton
            label="Zoom out"
            onClick={() => city.current?.zoom(-1)}
            shortcut="−"
          >
            <Minus size={18} />
          </ToolButton>
          <span className="toolbar-divider" />
          <ToolButton
            label="Turn left"
            onClick={() => {
              city.current?.rotate(-1);
              setTouring(false);
            }}
          >
            <RotateCcw size={16} />
          </ToolButton>
          <ToolButton
            label="Turn right"
            onClick={() => {
              city.current?.rotate(1);
              setTouring(false);
            }}
          >
            <RotateCw size={16} />
          </ToolButton>
          <ToolButton
            label="Back to the square"
            onClick={() => {
              city.current?.home();
              setDistrict("SSH");
              setTouring(false);
            }}
            shortcut="H"
          >
            <Home size={16} />
          </ToolButton>
          <span className="toolbar-divider" />
          <ToolButton
            label="Places"
            onClick={() => openPanel("places")}
            active={panel === "places"}
          >
            <MapPin size={17} />
          </ToolButton>
          <ToolButton
            label="Data views"
            onClick={() => openPanel("views")}
            active={panel === "views" || view !== "city"}
          >
            <Layers3 size={17} />
          </ToolButton>
          <span className="toolbar-divider" />
          <ToolButton
            label="How to explore"
            onClick={() => openPanel("help")}
            active={panel === "help"}
          >
            <HelpCircle size={17} />
          </ToolButton>
        </nav>

        <div className="district-navigation">
          <div className="district-caption">
            <span className="tiny-label">You are exploring</span>
            <span className="district-japanese" lang="ja">
              {selected.japanese}
            </span>
          </div>
          <button
            className="district-trigger glass"
            onClick={() => setDropdown((value) => !value)}
            aria-expanded={dropdown}
            aria-controls="district-menu"
          >
            <i style={{ background: selected.color }} />
            <span>{selected.name}</span>
            <ChevronDown size={14} />
          </button>
          {dropdown && (
            <div className="district-menu glass" id="district-menu">
              <div className="menu-heading">Choose a district</div>
              {districts.map((place) => (
                <button
                  key={place.id}
                  onClick={() => visit(place.id)}
                  className={place.id === district ? "selected" : ""}
                >
                  <i style={{ background: place.color }} />
                  <span>
                    {place.name}
                    <small>{place.id} district</small>
                  </span>
                  {place.id === district ? (
                    <Check size={14} />
                  ) : (
                    <ArrowUpRight size={14} />
                  )}
                </button>
              ))}
            </div>
          )}
          <button
            className="district-more"
            onClick={() => openPanel("district")}
          >
            District details <ArrowUpRight size={12} />
          </button>
        </div>

        <section
          className="network-strip glass"
          aria-label="Demo network statistics"
        >
          <button
            className={`simulation-state${paused || reducedMotion ? " is-paused" : ""}`}
            onClick={() => setPaused((value) => !value)}
            aria-label={
              reducedMotion
                ? "Simulation paused for reduced motion"
                : paused
                  ? "Resume simulation"
                  : "Pause simulation"
            }
            aria-pressed={paused || reducedMotion}
            disabled={reducedMotion}
          >
            {paused || reducedMotion ? (
              <Pause size={12} />
            ) : (
              <span className="status-dot" />
            )}
            <span>{paused || reducedMotion ? "Paused" : "Demo"}</span>
          </button>
          <button
            className="network-stat"
            onClick={() => openPanel("activity")}
          >
            <Activity size={19} className="stat-honey" />
            <span>
              <span className="stat-label">Connections</span>
              <strong>
                {total.toLocaleString("en-US")}
                <small>today</small>
              </strong>
            </span>
            <span className="stat-underline honey" />
          </button>
          <button className="network-stat" onClick={() => openPanel("stats")}>
            <ArrowDownLeft size={20} className="stat-green" />
            <span>
              <span className="stat-label">Active sessions</span>
              <strong>
                36<small>in the city</small>
              </strong>
            </span>
            <span className="stat-underline green" />
          </button>
          <button className="network-stat" onClick={() => openPanel("stats")}>
            <MapPin size={19} className="stat-blue" />
            <span>
              <span className="stat-label">Unique sources</span>
              <strong>
                1,204<small>24h</small>
              </strong>
            </span>
            <span className="stat-underline blue" />
          </button>
          <button className="network-stat" onClick={() => openPanel("places")}>
            <Shield size={19} className="stat-purple" />
            <span>
              <span className="stat-label">Honeypots</span>
              <strong>
                5<small>districts</small>
              </strong>
            </span>
            <span className="stat-underline purple" />
          </button>
        </section>

        <div className="world-hint">
          <span>Drag to move</span>
          <i />
          <span>Click a person or a shop</span>
        </div>
        <button
          className="activity-inbox glass"
          onClick={() => openPanel("activity")}
          aria-label="Open city activity"
          aria-expanded={panel === "activity"}
        >
          <Activity size={21} />
          <span className="inbox-count">
            {events.filter((event) => event.severity === "high").length}
          </span>
        </button>
        <div className="latest-event" aria-hidden="true">
          <span
            className="event-dot"
            style={{
              background: districts.find((d) => d.id === events[0].protocol)!
                .color,
            }}
          />
          <span>{events[0].action}</span>
        </div>
        <div className="city-coordinates" aria-hidden="true">
          HNY / 48°51′ N 2°21′ E{" "}
          <span>
            {theme === "day" ? "Shops are open." : "Last tram at midnight."}
          </span>
        </div>
      </div>

      {ready && (
        <ExploreOverlay
          nearby={nearby}
          room={room}
          inspection={inspection}
          following={following}
          hover={hover}
          city={city}
          close={() => city.current?.inspect(null)}
          announce={announce}
          muted={!sound || paused || reducedMotion}
        />
      )}

      {panel && !photo && (
        <aside
          ref={panelRef}
          className="city-panel glass"
          tabIndex={-1}
          aria-labelledby="panel-title"
        >
          <header className="panel-header">
            <div>
              <span className="panel-kicker">
                Honeyrizons /{" "}
                {panel === "district"
                  ? selected.id
                  : panel === "activity"
                    ? "demo feed"
                    : "city guide"}
              </span>
              <h2 id="panel-title">{panelTitles[panel]}</h2>
            </div>
            <button
              className="close-button"
              aria-label="Close panel"
              onClick={() => setPanel(null)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="panel-body">
            {panel === "activity" && (
              <>
                <p className="panel-intro">
                  Recent connections across the city.
                  <br />
                  <span>All activity here is simulated.</span>
                </p>
                <label className="activity-search">
                  <Search size={15} />
                  <input
                    aria-label="Search activity"
                    placeholder="Search activity or an address"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={13} />
                    </button>
                  )}
                </label>
                <div
                  className="protocol-filters"
                  aria-label="Filter activity by protocol"
                >
                  {(["all", ...districts.map((d) => d.id)] as const).map(
                    (id) => (
                      <button
                        key={id}
                        className={protocol === id ? "is-selected" : ""}
                        onClick={() => setProtocol(id)}
                        aria-pressed={protocol === id}
                      >
                        {id === "all" ? "All" : id}
                      </button>
                    ),
                  )}
                </div>
                <div className="activity-list">
                  {visibleEvents.map((event) => (
                    <ActivityItem
                      key={event.id}
                      event={event}
                      expanded={expanded === event.id}
                      visit={() => {
                        visit(event.protocol);
                        setPanel(null);
                      }}
                      select={() => {
                        setExpanded((value) =>
                          value === event.id ? null : event.id,
                        );
                        city.current?.pulse(event.protocol);
                      }}
                    />
                  ))}
                  {!visibleEvents.length && (
                    <div className="no-results">
                      <Search size={24} />
                      <p>No activity matches that search.</p>
                      <button
                        onClick={() => {
                          setQuery("");
                          setProtocol("all");
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
                <div className="feed-footer">
                  <span className="status-dot" />
                  {paused || reducedMotion
                    ? "Simulation paused"
                    : "Demo activity arriving every few seconds"}
                </div>
              </>
            )}

            {panel === "district" && (
              <>
                <div
                  className="district-art"
                  style={
                    { "--district-color": selected.color } as CSSProperties
                  }
                >
                  <div className="mini-building">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <span lang="ja">{selected.japanese}</span>
                  <b>{selected.id}</b>
                </div>
                <p className="district-description">{selected.description}</p>
                <div className="district-facts">
                  <div>
                    <span>Protocol</span>
                    <strong style={{ color: selected.color }}>
                      {selected.id}
                    </strong>
                  </div>
                  <div>
                    <span>Port</span>
                    <strong>{selected.port}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>
                      <i />
                      Demo
                    </strong>
                  </div>
                </div>
                <button
                  className="primary-button"
                  onClick={() => {
                    visit(selected.id);
                    setPanel(null);
                  }}
                >
                  <MapPin size={16} />
                  Take me there
                </button>
                <div className="panel-section-title">Recent visits</div>
                {events
                  .filter((event) => event.protocol === district)
                  .slice(0, 4)
                  .map((event) => (
                    <ActivityItem
                      key={event.id}
                      event={event}
                      expanded={expanded === event.id}
                      select={() =>
                        setExpanded((value) =>
                          value === event.id ? null : event.id,
                        )
                      }
                    />
                  ))}
              </>
            )}

            {panel === "places" && (
              <>
                <p className="panel-intro">
                  Open a shop or move to a district.
                </p>
                <div className="panel-section-title">Open shops</div>
                <div className="places-list">
                  {buildings.map((b) => (
                    <button
                      key={b.id}
                      className="place-card"
                      onClick={() => city.current?.enter(b.id)}
                    >
                      <span className="place-marker" style={{ color: b.color }}>
                        <Home size={21} />
                      </span>
                      <span>
                        <b>{b.name}</b>
                        <small>
                          {b.floors.length}{" "}
                          {b.floors.length === 1 ? "floor" : "floors"} /{" "}
                          {b.floors[0].name}
                        </small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
                <div className="panel-section-title">Street regulars</div>
                <div className="places-list">
                  {residents.map((person) => (
                    <button
                      key={person.id}
                      className="place-card"
                      onClick={() => {
                        if (room) city.current?.exit();
                        setPanel(null);
                        city.current?.inspect(person.id);
                      }}
                    >
                      <span className="place-marker">
                        <MapPin size={18} />
                      </span>
                      <span>
                        <b>{person.name}</b>
                        <small>{person.role}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
                <div className="panel-section-title">Districts</div>
                <div className="places-list">
                  {districts.map((place) => (
                    <button
                      key={place.id}
                      className="place-card"
                      onClick={() => visit(place.id, true)}
                    >
                      <span
                        className="place-marker"
                        style={{ color: place.color }}
                      >
                        <MapPin size={22} />
                      </span>
                      <span>
                        <b>{place.name}</b>
                        <span lang="ja">{place.japanese}</span>
                        <small>
                          {place.id} / port {place.port}
                        </small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
                <button
                  className="secondary-button"
                  onClick={startTour}
                  disabled={reducedMotion}
                >
                  <Compass size={16} />
                  Orbit the city
                </button>
              </>
            )}

            {panel === "views" && (
              <>
                <p className="panel-intro">Choose what the map shows.</p>
                <div className="view-options">
                  {dataViews.map((item) => (
                    <button
                      key={item.id}
                      className={`view-option${view === item.id ? " is-selected" : ""}`}
                      onClick={() => setView(item.id)}
                      aria-pressed={view === item.id}
                    >
                      <span className="view-japanese" lang="ja">
                        {item.japanese}
                      </span>
                      <span>
                        <b>{item.title}</b>
                        <small>{item.description}</small>
                      </span>
                      <span className="radio-indicator">
                        {view === item.id && <Check size={11} />}
                      </span>
                    </button>
                  ))}
                </div>
                {view === "protocols" || view === "threats" ? (
                  <div className="map-legend">
                    {districts.map((place) => (
                      <span key={place.id}>
                        <i style={{ background: place.color }} />
                        {place.id}
                        <small>{place.name}</small>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="quiet-note">
                    Use the camera controls to get a closer look.
                  </p>
                )}
              </>
            )}

            {panel === "help" && (
              <>
                <p className="panel-intro">
                  Use the canvas or the controls at the edge.
                </p>
                <div className="help-rows">
                  <div>
                    <Expand size={19} />
                    <span>
                      <b>Wander</b>
                      <small>Drag with your mouse or one finger.</small>
                    </span>
                  </div>
                  <div>
                    <Maximize size={19} />
                    <span>
                      <b>Get closer</b>
                      <small>Scroll, pinch, or use + and −.</small>
                    </span>
                  </div>
                  <div>
                    <RotateCw size={19} />
                    <span>
                      <b>Look around</b>
                      <small>
                        Right-drag, use two fingers, or turn buttons.
                      </small>
                    </span>
                  </div>
                  <div>
                    <MapPin size={19} />
                    <span>
                      <b>Meet the neighbors</b>
                      <small>
                        Click a person to talk or follow. Click a shop to step
                        inside.
                      </small>
                    </span>
                  </div>
                  <div>
                    <Expand size={19} />
                    <span>
                      <b>Walk inside</b>
                      <small>
                        WASD or ZQSD to walk. Drag to look, or use the arrow
                        keys. E talks to someone nearby. Stairs connect the
                        floors.
                      </small>
                    </span>
                  </div>
                  <div>
                    <Camera size={19} />
                    <span>
                      <b>Save a photo</b>
                      <small>Photo mode hides the interface. Save a PNG.</small>
                    </span>
                  </div>
                </div>
                <div className="panel-section-title">Keyboard shortcuts</div>
                <div className="keyboard-shortcuts">
                  <span>
                    Back to the square<kbd>H</kbd>
                  </span>
                  <span>
                    Day / night<kbd>N</kbd>
                  </span>
                  <span>
                    Pause / resume<kbd>Space</kbd>
                  </span>
                  <span>
                    Close / return to street<kbd>Esc</kbd>
                  </span>
                </div>
                {reducedMotion && (
                  <p className="quiet-note">
                    Reduced motion is enabled. The city stays still while you
                    explore.
                  </p>
                )}
              </>
            )}

            {panel === "about" && (
              <>
                <div className="about-mark">
                  <HoneyMark size={64} />
                  <span lang="ja">ようこそ</span>
                </div>
                <h3 className="about-title">Explore Honeyrizons</h3>
                <p className="about-copy">
                  Nine shops are open. Click a storefront to enter, take the
                  lift upstairs, or talk to the people inside.
                </p>
                <p className="about-copy">
                  Honeyrizons turns honeypot activity into a place you can
                  explore. The city uses local demo sessions until the honeypot
                  is connected.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setPanel(null)}
                >
                  Explore the city <ArrowUpRight size={16} />
                </button>
                <div className="about-credit">
                  Inspired by{" "}
                  <a
                    href="https://zstreet.cash/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    ZStreet <ArrowUpRight size={11} />
                  </a>
                  <span>Made for Honeyrizons.</span>
                </div>
              </>
            )}

            {panel === "stats" && (
              <>
                <p className="panel-intro">
                  A snapshot of our demo neighborhood.
                </p>
                <div className="stat-overview">
                  <strong>{total.toLocaleString("en-US")}</strong>
                  <span>connections today</span>
                </div>
                <div className="protocol-breakdown">
                  {districts.map((place, index) => (
                    <div key={place.id}>
                      <span>
                        <i style={{ background: place.color }} />
                        {place.id}
                        <b>{[42, 28, 12, 10, 8][index]}%</b>
                      </span>
                      <div>
                        <i
                          style={{
                            width: `${[42, 28, 12, 10, 8][index]}%`,
                            background: place.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="summary-facts">
                  <span>
                    Active sessions<b>36</b>
                  </span>
                  <span>
                    Unique sources<b>1,204</b>
                  </span>
                  <span>
                    Open districts<b>5</b>
                  </span>
                </div>
                <p className="quiet-note">
                  These figures are illustrative demo totals. The activity feed
                  shows the local simulation.
                </p>
              </>
            )}
          </div>
        </aside>
      )}

      {photo && (
        <div className="photo-controls glass">
          <span>
            <Camera size={16} />
            Photo mode
          </span>
          <div className="photo-filters">
            {["normal", "noir", "warm"].map((filter) => (
              <button
                key={filter}
                onClick={() => setPhotoFilter(filter)}
                className={photoFilter === filter ? "is-active" : ""}
                aria-pressed={photoFilter === filter}
              >
                {filter === "normal"
                  ? "Original"
                  : filter === "noir"
                    ? "Noir"
                    : "Golden"}
              </button>
            ))}
          </div>
          <button className="photo-save" onClick={savePhoto}>
            <Download size={15} />
            Save photo
          </button>
          <button
            className="photo-done"
            onClick={() => {
              setPhoto(false);
              setPhotoFilter("normal");
            }}
          >
            Done <kbd>Esc</kbd>
          </button>
        </div>
      )}
      {touring && !photo && (
        <div className="tour-status glass">
          <Compass size={14} />
          <span>Taking the scenic route</span>
          <button
            onClick={() => {
              setTouring(false);
              city.current?.tour(false);
            }}
          >
            Stop <X size={12} />
          </button>
        </div>
      )}
      {notice && (
        <div className="city-notice glass" role="status">
          <Check size={15} />
          {notice}
        </div>
      )}
      <div className="sr-only" role="status" aria-live="polite">
        {paused ? "Simulation paused" : ""}
      </div>
    </main>
  );
}
