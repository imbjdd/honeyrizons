import type {
  BuildingId,
  HoverTarget,
  Inspection,
  RoomLocation,
} from "./explore";
export type Protocol = "SSH" | "HTTP" | "TELNET" | "MYSQL" | "REDIS";
export type Theme = "day" | "night";
export type DataView = "city" | "protocols" | "traffic" | "threats";

export interface District {
  id: Protocol;
  name: string;
  japanese: string;
  color: string;
  position: [number, number, number];
  description: string;
  port: number;
}

export const districts: District[] = [
  {
    id: "SSH",
    name: "Honey square",
    japanese: "ハニー広場",
    color: "#edb84b",
    position: [-15, 0, -19],
    description:
      "The heart of the city. Every shell session finds its way to Honey Tower.",
    port: 2222,
  },
  {
    id: "HTTP",
    name: "The web quarter",
    japanese: "ウェブ街",
    color: "#72b39a",
    position: [20, 0, -17],
    description:
      "Storefronts, side streets, and a WordPress hotel with a very welcoming front door.",
    port: 8080,
  },
  {
    id: "TELNET",
    name: "Old town",
    japanese: "旧市街",
    color: "#e29582",
    position: [-43, 0, 17],
    description:
      "A quiet neighborhood of old connections. Some doors have been open for decades.",
    port: 2323,
  },
  {
    id: "MYSQL",
    name: "Archive avenue",
    japanese: "記録通り",
    color: "#a293c8",
    position: [42, 0, 19],
    description:
      "Behind the lavender facades, the city's databases wait for their next visitor.",
    port: 3306,
  },
  {
    id: "REDIS",
    name: "Cache gardens",
    japanese: "庭園",
    color: "#7caec7",
    position: [1, 0, 23],
    description:
      "The greenhouse and roof gardens receive the city's Redis connections.",
    port: 6379,
  },
];

export interface CityEvent {
  id: string;
  time: number;
  protocol: Protocol;
  source: string;
  country: string;
  action: string;
  severity: "low" | "medium" | "high";
  detail: string;
}

// Local, repeatable fixtures. No API calls or honeypot processes are needed.
const scenarios: Omit<CityEvent, "id" | "time">[] = [
  {
    protocol: "SSH",
    source: "198.51.100.24",
    country: "Netherlands",
    action: "A visitor knocked on Honey Tower",
    severity: "medium",
    detail: "Shell login attempt · username: root · port 2222",
  },
  {
    protocol: "HTTP",
    source: "203.0.113.82",
    country: "United States",
    action: "Someone checked into the web quarter",
    severity: "low",
    detail: "GET /wp-login.php · WordPress decoy · port 8080",
  },
  {
    protocol: "MYSQL",
    source: "192.0.2.19",
    country: "Germany",
    action: "The archive received a new query",
    severity: "medium",
    detail: "Database authentication attempt · username: admin · port 3306",
  },
  {
    protocol: "SSH",
    source: "203.0.113.45",
    country: "Singapore",
    action: "An unexpected guest tried the side door",
    severity: "high",
    detail: "Repeated shell login attempts · username: ubuntu · port 2222",
  },
  {
    protocol: "REDIS",
    source: "198.51.100.63",
    country: "France",
    action: "A connection passed through Cache gardens",
    severity: "low",
    detail: "PING command · Redis decoy · port 6379",
  },
  {
    protocol: "TELNET",
    source: "192.0.2.107",
    country: "Japan",
    action: "An old-town doorbell rang",
    severity: "medium",
    detail: "Legacy terminal connection · username: admin · port 2323",
  },
  {
    protocol: "HTTP",
    source: "198.51.100.91",
    country: "Canada",
    action: "A visitor browsed the shop windows",
    severity: "high",
    detail: "POST /xmlrpc.php · repeated requests · port 8080",
  },
  {
    protocol: "REDIS",
    source: "203.0.113.11",
    country: "United Kingdom",
    action: "The gardens caught a curious visitor",
    severity: "medium",
    detail: "INFO command · Redis decoy · port 6379",
  },
];

export function createDemoEvent(index: number, time = Date.now()): CityEvent {
  return { ...scenarios[index % scenarios.length], id: `demo-${index}`, time };
}

export function initialDemoEvents(now = Date.now()): CityEvent[] {
  return Array.from({ length: 24 }, (_, i) =>
    createDemoEvent(23 - i, now - i * 7_000),
  );
}

export interface CityOptions {
  theme: Theme;
  paused: boolean;
  view: DataView;
  reducedMotion: boolean;
  onSelect: (protocol: Protocol) => void;
  onReady: () => void;
  onError: (message: string) => void;
  onInteraction: () => void;
  onPhotoSaved: () => void;
  onInspect: (inspection: Inspection | null) => void;
  onRoomChange: (room: RoomLocation | null) => void;
  onFollowChange: (id: string | null) => void;
  onHover: (target: HoverTarget | null) => void;
}

export interface CityHandle {
  zoom: (direction: number) => void;
  rotate: (direction: number) => void;
  home: () => void;
  focus: (protocol: Protocol) => void;
  tour: (enabled: boolean) => void;
  capture: () => void;
  pulse: (protocol: Protocol) => void;
  enter: (building: BuildingId, floor?: number) => void;
  exit: () => void;
  inspect: (id: string | null) => void;
  follow: (id: string | null) => void;
  shopAction: (action: "coffee" | "record" | "water") => void;
}
