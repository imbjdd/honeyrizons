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
  buildings,
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
import type { CityHandle } from "./model";

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
  const [directory, setDirectory] = useState(false);
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
    setDirectory(false);
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
          <section
            className="room-navigation glass"
            aria-label="Current building"
          >
            <button
              className="street-return"
              onClick={() => city.current?.exit()}
            >
              <ArrowLeft size={15} />
              Return to the street
            </button>
            <div className="room-heading">
              <DoorOpen size={21} style={{ color: building.color }} />
              <div>
                <h1>{building.name}</h1>
                <span lang="ja">{building.japanese}</span>
              </div>
            </div>
            <details className="floor-menu" key={room.floor}>
              <summary>
                {building.floors[room.floor].name}{" "}
                <span>Floor {room.floor === 0 ? "G" : room.floor}</span>
              </summary>
              <div className="floor-tabs" aria-label="Choose a floor">
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
          <div className="room-people glass" aria-label="People in this room">
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
        <div className="following-bar glass">
          <Navigation size={15} />
          <span>Following {residentById(following).name}</span>
          <button onClick={() => city.current?.follow(null)}>
            Stop <X size={13} />
          </button>
        </div>
      )}
      {!room && (
        <button
          className="explore-shops glass"
          onClick={() => setDirectory((v) => !v)}
          aria-expanded={directory}
        >
          <DoorOpen size={15} />
          Open shops <span>{buildings.length}</span>
        </button>
      )}
      {directory && !room && (
        <section className="shop-directory glass" aria-label="Open shops">
          <header>
            <h2>Step inside</h2>
            <button
              aria-label="Close shop directory"
              onClick={() => setDirectory(false)}
            >
              <X size={16} />
            </button>
          </header>
          <p>Click a storefront, or choose a door here.</p>
          {buildings.map((b) => (
            <button key={b.id} onClick={() => enter(b.id)}>
              <i style={{ background: b.color }} />
              <span>
                {b.name}
                <small>{b.floors[0].name}</small>
              </span>
              <DoorOpen size={15} />
            </button>
          ))}
        </section>
      )}
      {hover && !inspection && (
        <div
          className="scene-tooltip"
          style={{
            left: Math.min(hover.x + 14, window.innerWidth - 250),
            top: Math.min(hover.y + 18, window.innerHeight - 60),
          }}
        >
          {hover.label}
        </div>
      )}
      {inspection && (
        <aside
          className="resident-panel glass"
          ref={panel}
          tabIndex={-1}
          aria-labelledby="inspection-title"
        >
          <button
            className="close-button"
            aria-label="Close inspection"
            onClick={close}
          >
            <X size={17} />
          </button>
          {resident ? (
            <>
              <header className="resident-heading">
                <div
                  className="pixel-portrait"
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
              <p className="resident-greeting">"{resident.greeting}"</p>
              <dl className="resident-facts">
                <div>
                  <dt>Usual spot</dt>
                  <dd>{getBuilding(resident.home).name}</dd>
                </div>
                <div>
                  <dt>District</dt>
                  <dd>{getBuilding(resident.home).protocol}</dd>
                </div>
                <div>
                  <dt>Today</dt>
                  <dd>
                    {room ? "Taking a break inside" : "Walking the avenue"}
                  </dd>
                </div>
              </dl>
              <div className="resident-actions">
                <button
                  className="primary-button"
                  onClick={() => setTalking((v) => !v)}
                  aria-expanded={talking}
                >
                  <MessageCircle size={15} />
                  {talking ? "Close conversation" : "Talk"}
                </button>
                {!room && (
                  <button
                    className="secondary-button"
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
                <div className="resident-conversation">
                  <div className="conversation-history" aria-live="polite">
                    {conversation.map((turn, i) => (
                      <div key={i}>
                        <span className="conversation-question">
                          {turn.question}
                        </span>
                        <p>{turn.answer}</p>
                      </div>
                    ))}
                  </div>
                  <span className="conversation-prompt">
                    Ask {resident.name}
                  </span>
                  <div className="conversation-choices">
                    {(
                      [
                        { id: "place", text: "Tell me about your shop" },
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
                  <small>Local demo conversation</small>
                </div>
              )}
              {!room && (
                <button
                  className="resident-home"
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
                <div className="object-symbol">
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
                <p className="object-description">{inspection.text}</p>
                {inspection.action && (
                  <button
                    className="primary-button"
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
                  <p className="quiet-note">Turn on Sound to listen.</p>
                )}
              </>
            )
          )}
        </aside>
      )}
    </>
  );
}
