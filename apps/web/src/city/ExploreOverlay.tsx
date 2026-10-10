import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Coffee,
  DoorOpen,
  Headphones,
  MessageCircle,
  Navigation,
  Sprout,
  X,
} from "lucide-react";
import {
  getBuilding,
  residentById,
  replyTo,
  roomResidents,
  type BuildingId,
  type HoverTarget,
  type Inspection,
  type RoomLocation,
} from "./explore";
import RoomHud from "./RoomHud";
import { portrait } from "./portraits";
import { districtById, type CityHandle } from "./model";

export default function ExploreOverlay({
  room,
  nearby,
  inspection,
  following,
  hover,
  city,
  close,
  announce,
  muted,
}: {
  room: RoomLocation | null;
  nearby: string | null;
  inspection: Inspection | null;
  following: string | null;
  hover: HoverTarget | null;
  city: RefObject<CityHandle | null>;
  close: () => void;
  announce: (text: string) => void;
  muted: boolean;
}) {
  const [talking, setTalking] = useState(false);
  const [conversation, setConversation] = useState<
    { question: string; answer: string }[]
  >([]);
  const [ordered, setOrdered] = useState(false);
  const [recordPlaying, setRecordPlaying] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const resident =
    inspection?.kind === "resident" ? residentById(inspection.id) : null;
  const building = room ? getBuilding(room.building) : null;
  useEffect(() => {
    setTalking(false);
    setConversation([]);
    setOrdered(false);
  }, [inspection]);
  useEffect(() => {
    setRecordPlaying(false);
  }, [room]);
  useEffect(() => {
    if (!inspection) return;
    const previous = document.activeElement as HTMLElement;
    panel.current?.focus();
    return () => {
      if (previous.isConnected) previous.focus();
    };
  }, [inspection]);
  // A short, locally synthesized record. It follows the global sound setting.
  useEffect(() => {
    if (!recordPlaying || muted) return;
    const context = new AudioContext();
    let beat = 0;
    const melody = [329.63, 392, 440, 392, 293.66, 349.23, 392, 293.66];
    const play = () => {
      const now = context.currentTime;
      [melody[beat % melody.length], beat % 2 === 0 ? 130.81 : 146.83].forEach(
        (frequency, i) => {
          const oscillator = context.createOscillator(),
            gain = context.createGain();
          oscillator.type = i ? "sine" : "triangle";
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(i ? 0.04 : 0.022, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(now);
          oscillator.stop(now + 0.55);
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
          };
        },
      );
      beat++;
    };
    void context.resume().catch(() => {});
    play();
    const timer = window.setInterval(play, 600);
    return () => {
      clearInterval(timer);
      void context.close();
    };
  }, [recordPlaying, muted]);
  function enter(id: BuildingId) {
    city.current?.enter(id);
  }
  function action() {
    if (inspection?.kind !== "prop" || !inspection.action) return;
    city.current?.shopAction(inspection.action);
    if (inspection.action === "record") {
      setRecordPlaying((v) => !v);
      announce(
        recordPlaying
          ? "Record stopped."
          : muted
            ? "Record spinning. Turn on Sound to listen."
            : "The record is playing.",
      );
    } else {
      setOrdered(true);
      announce(
        inspection.action === "coffee"
          ? "Your order is at the counter."
          : "The seed trays have been watered.",
      );
    }
  }
  return (
    <>
      {room && building && (
        <>
          <section className="city-panel city-room" aria-label="Current building">
            <button type="button" className="btn press city-room-exit" onClick={() => city.current?.exit()}>
              <ArrowLeft size={15} />
              Return to the street
            </button>
            <div className="city-room-head">
              <DoorOpen size={21} style={{ color: building.color }} />
              <div>
                <h1>{building.name}</h1>
                <span lang="ja">{building.japanese}</span>
              </div>
            </div>
            <details className="city-floors" key={room.floor}>
              <summary>
                {building.floors[room.floor].name}{" "}
                <span>Floor {room.floor === 0 ? "G" : room.floor}</span>
              </summary>
              <div className="city-floor-list" aria-label="Choose a floor">
                {building.floors.map((floor, i) => (
                  <button
                    key={floor.name}
                    aria-pressed={room.floor === i}
                    onClick={() => city.current?.enter(building.id, i)}
                  >
                    <span>{i === 0 ? "G" : i}</span>
                    {floor.name}
                  </button>
                ))}
              </div>
            </details>
            <p>{building.floors[room.floor].description}</p>
          </section>
          <RoomHud city={city} nearby={nearby} blocked={!!inspection} />
          <div className="city-panel city-people" aria-label="People in this room">
            <span>In here</span>
            {roomResidents(room).map((person) => (
              <button
                key={person.id}
                aria-label={`Meet ${person.name}`}
                onClick={() => city.current?.inspect(person.id)}
              >
                <img src={portrait(person.look)} alt="" />
                {person.name}
              </button>
            ))}
          </div>
        </>
      )}
      {following && !room && (
        <div className="city-panel city-following">
          <Navigation size={15} />
          <span>Following {residentById(following).name}</span>
          <button type="button" className="btn press" onClick={() => city.current?.follow(null)}>
            Stop <X size={13} />
          </button>
        </div>
      )}
      {hover && !inspection && (
        <div
          className="city-tooltip"
          style={{
            left: Math.min(hover.x + 14, hover.width - 240),
            top: Math.min(hover.y + 18, hover.height - 48),
          }}
        >
          {hover.label}
        </div>
      )}
      {inspection && (
        <aside
          className="city-panel city-inspector"
          ref={panel}
          tabIndex={-1}
          aria-labelledby="inspection-title"
        >
          <button type="button" className="icon-btn press city-inspector-close" aria-label="Close" onClick={close}>
            <X size={17} />
          </button>
          {resident ? (
            <>
              <header className="city-person">
                <div
                  className="city-portrait"
                  style={{
                    background: getBuilding(resident.home).color + "38",
                  }}
                >
                  <img
                    src={portrait(resident.look)}
                    alt={`Pixel portrait of ${resident.name}`}
                  />
                </div>
                <div>
                  <span>{resident.role}</span>
                  <h2 id="inspection-title">{resident.name}</h2>
                  <p>{getBuilding(resident.home).name}</p>
                </div>
              </header>
              <p className="city-greeting">"{resident.greeting}"</p>
              <dl className="city-facts">
                <div>
                  <dt>Usual spot</dt>
                  <dd>{getBuilding(resident.home).name}</dd>
                </div>
                <div>
                  <dt>District</dt>
                  <dd>{districtById(getBuilding(resident.home).district).name}</dd>
                </div>
                <div>
                  <dt>Today</dt>
                  <dd>
                    {room ? "Taking a break inside" : "Walking the avenue"}
                  </dd>
                </div>
              </dl>
              <div className="city-actions">
                <button
                  type="button"
                  className="btn btn-primary press"
                  onClick={() => setTalking((v) => !v)}
                  aria-expanded={talking}
                >
                  <MessageCircle size={15} />
                  {talking ? "Close conversation" : "Talk"}
                </button>
                {!room && (
                  <button
                    type="button"
                    className="btn press"
                    onClick={() =>
                      city.current?.follow(
                        following === resident.id ? null : resident.id,
                      )
                    }
                  >
                    <Navigation size={15} />
                    {following === resident.id ? "Stop following" : "Follow"}
                  </button>
                )}
              </div>
              {talking && (
                <div className="city-conversation">
                  <div className="city-conversation-history" aria-live="polite">
                    {conversation.map((turn, i) => (
                      <div key={i}>
                        <span className="city-conversation-question">
                          {turn.question}
                        </span>
                        <p>{turn.answer}</p>
                      </div>
                    ))}
                  </div>
                  <span className="ai-label">
                    Ask {resident.name}
                  </span>
                  <div className="city-conversation-choices">
                    {(
                      [
                        { id: "place", text: "Tell me about this place" },
                        { id: "activity", text: "Who visits this district?" },
                        { id: "tip", text: "Where should I go next?" },
                      ] as const
                    ).map((q) => (
                      <button
                        key={q.id}
                        onClick={() =>
                          setConversation((turns) => [
                            ...turns.slice(-2),
                            {
                              question: q.text,
                              answer: replyTo(resident, q.id),
                            },
                          ])
                        }
                      >
                        {q.text}
                        <MessageCircle size={12} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!room && (
                <button
                  type="button"
                  className="link-more city-home-link"
                  onClick={() => enter(resident.home)}
                >
                  Enter {getBuilding(resident.home).name}
                  <ArrowUpRight size={14} />
                </button>
              )}
            </>
          ) : (
            inspection.kind === "prop" && (
              <>
                <div className="city-object-icon">
                  {inspection.action === "coffee" ? (
                    <Coffee size={28} />
                  ) : inspection.action === "record" ? (
                    <Headphones size={28} />
                  ) : inspection.action === "water" ? (
                    <Sprout size={28} />
                  ) : (
                    <DoorOpen size={28} />
                  )}
                </div>
                <h2 id="inspection-title">{inspection.title}</h2>
                <p className="city-object-text">{inspection.text}</p>
                {inspection.action && (
                  <button
                    type="button"
                    className="btn btn-primary press"
                    onClick={action}
                    disabled={ordered}
                  >
                    {inspection.action === "coffee"
                      ? ordered
                        ? "Order ready"
                        : "Order at the counter"
                      : inspection.action === "water"
                        ? ordered
                          ? "Plants watered"
                          : "Water the plants"
                        : recordPlaying
                          ? "Stop record"
                          : "Put a record on"}
                  </button>
                )}
                {inspection.action === "record" && recordPlaying && muted && (
                  <p className="ai-hint">Turn on Sound to listen.</p>
                )}
              </>
            )
          )}
        </aside>
      )}
    </>
  );
}
