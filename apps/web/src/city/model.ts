import type { WalkAction } from "./RoomController";
import type { AttackerSpec } from "./attackers";
import type {
  BuildingId,
  HoverTarget,
  Inspection,
  RoomLocation,
} from "./explore";
/** A neighborhood of the city. Districts color the night lighting; services live in buildings (see SERVICE_BUILDINGS). */
export type DistrictId = "SSH" | "HTTP" | "TELNET" | "MYSQL" | "REDIS";

export interface District {
  id: DistrictId;
  name: string;
  japanese: string;
  /** Matches the dashboard's protocol palette so the map and the charts agree. */
  color: string;
  position: [number, number, number];
}

export const districts: District[] = [
  {
    id: "SSH",
    name: "Honey square",
    japanese: "ハニー広場",
    color: "#f5a524",
    position: [-14, 0, -26],
  },
  {
    id: "HTTP",
    name: "The web quarter",
    japanese: "ウェブ街",
    color: "#4f9cf9",
    position: [14, 0, -26],
  },
  {
    id: "TELNET",
    name: "Circuit quarter",
    japanese: "回路街",
    color: "#e5484d",
    position: [-42, 0, 18],
  },
  {
    id: "MYSQL",
    name: "Archive avenue",
    japanese: "記録通り",
    color: "#30a46c",
    position: [70, 0, -26],
  },
  {
    id: "REDIS",
    name: "Cache gardens",
    japanese: "庭園",
    color: "#2fd0b5",
    position: [42, 0, 52],
  },
];

export const districtById = (id: DistrictId) => districts.find((d) => d.id === id)!;

/**
 * Building = service: each honeypot service is one landmark, matched by port. Attackers of a service walk to its door.
 * Other buildings stay as the city around them.
 */
export const SERVICE_BUILDINGS: Record<number, BuildingId> = {
  2222: "tower", // SSH → Honey Tower
  8080: "hotel", // WordPress → Web Hotel
  8000: "robotics", // MCP → Bot Works, where AI agents come asking for tools
  2323: "market", // Telnet → Circuit Market
  3306: "archive", // MySQL → The Archive
  6379: "gardens", // Redis → Cache Gardens
};

/** "host:2222" or ":2222" → the building standing for that service. */
export function buildingForAddress(address: string): BuildingId | undefined {
  return SERVICE_BUILDINGS[Number(address.split(":").at(-1))];
}

export interface CityOptions {
  paused: boolean;
  reducedMotion: boolean;
  inputBlocked: boolean;
  onNearby: (label: string | null) => void;
  onReady: () => void;
  onError: (message: string) => void;
  onInteraction: () => void;
  onPhotoSaved: () => void;
  onInspect: (inspection: Inspection | null) => void;
  onRoomChange: (room: RoomLocation | null) => void;
  onFollowChange: (id: string | null) => void;
  onHover: (target: HoverTarget | null) => void;
  /** An attacker was clicked; the id is its session key. */
  onAttacker: (id: string) => void;
}

export interface CityHandle {
  move: (action: WalkAction, pressed: boolean) => void;
  interact: () => void;
  lockLook: () => void;
  zoom: (direction: number) => void;
  rotate: (direction: number) => void;
  home: () => void;
  focus: (building: BuildingId) => void;
  tour: (enabled: boolean) => void;
  capture: () => void;
  /** Rings at the building's door, in the attacker's severity color. */
  pulse: (building: BuildingId, color?: string) => void;
  /** Replaces the attackers walking the streets. */
  setAttackers: (attackers: AttackerSpec[]) => void;
  highlightAttacker: (id: string | null) => void;
  /** Screen position of a building's roof, relative to the canvas, or null when hidden (e.g. inside a room). */
  project: (building: BuildingId) => { x: number; y: number } | null;
  enter: (building: BuildingId, floor?: number) => void;
  exit: () => void;
  inspect: (id: string | null) => void;
  follow: (id: string | null) => void;
  shopAction: (action: "coffee" | "record" | "water") => void;
}
