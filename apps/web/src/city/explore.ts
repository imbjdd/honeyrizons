import type { Protocol } from "./model";

export type BuildingId =
  | "tower"
  | "cafe"
  | "hotel"
  | "records"
  | "archive"
  | "teahouse"
  | "gardens"
  | "ramen"
  | "books";
export type RoomStyle =
  | "lobby"
  | "control"
  | "cafe"
  | "records"
  | "library"
  | "garden"
  | "tea"
  | "ramen"
  | "rooftop";
export interface Building {
  id: BuildingId;
  name: string;
  japanese: string;
  color: string;
  protocol: Protocol;
  position: [number, number, number];
  floors: { name: string; style: RoomStyle; description: string }[];
}
export const buildings: Building[] = [
  {
    id: "tower",
    name: "Honey Tower",
    japanese: "ハニータワー",
    color: "#efb83f",
    protocol: "SSH",
    position: [-15, 0, -20],
    floors: [
      {
        name: "Reception",
        style: "lobby",
        description: "The front desk keeps a record of every visitor.",
      },
      {
        name: "Control room",
        style: "control",
        description: "Terminal screens glow above the main avenue.",
      },
      {
        name: "Roof terrace",
        style: "rooftop",
        description: "A quiet table above the tram line.",
      },
    ],
  },
  {
    id: "cafe",
    name: "Honey Café",
    japanese: "蜂蜜喫茶",
    color: "#e9ae3e",
    protocol: "SSH",
    position: [-2.5, 0, -18],
    floors: [
      {
        name: "Coffee bar",
        style: "cafe",
        description: "Coffee, honey toast, and a window seat.",
      },
      {
        name: "Upstairs studio",
        style: "library",
        description: "A shared table for people who stay a little longer.",
      },
    ],
  },
  {
    id: "hotel",
    name: "Web Hotel",
    japanese: "ウェブホテル",
    color: "#35b8a2",
    protocol: "HTTP",
    position: [23, 0, -18],
    floors: [
      {
        name: "Lobby",
        style: "lobby",
        description: "The hotel has a room for every new connection.",
      },
      {
        name: "Roof lounge",
        style: "rooftop",
        description: "Garden chairs, citrus trees, and the hotel radio.",
      },
    ],
  },
  {
    id: "records",
    name: "Side A Records",
    japanese: "レコード",
    color: "#ee709b",
    protocol: "HTTP",
    position: [49, 0, -19],
    floors: [
      {
        name: "Record shop",
        style: "records",
        description: "Used records downstairs. Ask Jun for a recommendation.",
      },
      {
        name: "Listening room",
        style: "records",
        description: "Pull up a chair and put a record on.",
      },
    ],
  },
  {
    id: "archive",
    name: "The Archive",
    japanese: "記録館",
    color: "#ac81dc",
    protocol: "MYSQL",
    position: [49, 0, 20],
    floors: [
      {
        name: "Reading room",
        style: "library",
        description: "Connection logs sit beside the neighborhood's books.",
      },
      {
        name: "Stacks",
        style: "control",
        description: "Rows of records, filed by arrival.",
      },
    ],
  },
  {
    id: "teahouse",
    name: "Old Town Tea",
    japanese: "お茶",
    color: "#c88b72",
    protocol: "TELNET",
    position: [-58, 0, 17],
    floors: [
      {
        name: "Tea room",
        style: "tea",
        description: "Tea is served at the low tables beside the garden.",
      },
      {
        name: "Garden room",
        style: "garden",
        description: "A small greenhouse behind the old wooden doors.",
      },
    ],
  },
  {
    id: "gardens",
    name: "Cache House",
    japanese: "庭園",
    color: "#49b6dc",
    protocol: "REDIS",
    position: [23, 0, 22],
    floors: [
      {
        name: "Greenhouse",
        style: "garden",
        description: "Cuttings, seed trays, and a very busy potting bench.",
      },
      {
        name: "Roof garden",
        style: "rooftop",
        description: "Plants follow the sun across the roof.",
      },
    ],
  },
  {
    id: "ramen",
    name: "Midnight Ramen",
    japanese: "ラーメン",
    color: "#df805e",
    protocol: "TELNET",
    position: [-60, 0, -17],
    floors: [
      {
        name: "Noodle bar",
        style: "ramen",
        description: "The last bowl is served when the tram stops running.",
      },
    ],
  },
  {
    id: "books",
    name: "Corner Books",
    japanese: "本屋",
    color: "#859eac",
    protocol: "MYSQL",
    position: [-26, 0, 22],
    floors: [
      {
        name: "Bookshop",
        style: "library",
        description: "Secondhand books and a table for reading.",
      },
    ],
  },
];
export interface Resident {
  id: string;
  name: string;
  role: string;
  home: BuildingId;
  look: number;
  greeting: string;
  phrase: string;
}
export const residents: Resident[] = [
  {
    id: "mika",
    name: "Mika",
    role: "Café owner",
    home: "cafe",
    look: 0,
    greeting:
      "I put honey in the coffee. People argue about it until they try it.",
    phrase: "Coffee's on.",
  },
  {
    id: "jun",
    name: "Jun",
    role: "Record collector",
    home: "records",
    look: 1,
    greeting:
      "The record bins are sorted by mood. I gave up on genres last winter.",
    phrase: "Try side B.",
  },
  {
    id: "ada",
    name: "Ada",
    role: "Night archivist",
    home: "archive",
    look: 2,
    greeting:
      "Every connection leaves a record. I keep the interesting ones on the top shelf.",
    phrase: "Filed it already.",
  },
  {
    id: "ren",
    name: "Ren",
    role: "Tram driver",
    home: "tower",
    look: 3,
    greeting:
      "The yellow tram goes past the square. Best seat is at the very back.",
    phrase: "Next stop, Honey square.",
  },
  {
    id: "sora",
    name: "Sora",
    role: "Gardener",
    home: "gardens",
    look: 4,
    greeting:
      "The greenhouse door sticks when it rains. Give it a proper push.",
    phrase: "Needs more sun.",
  },
  {
    id: "nori",
    name: "Nori",
    role: "Tea shopkeeper",
    home: "teahouse",
    look: 5,
    greeting: "Sit down. The tea needs another minute, and so do most people.",
    phrase: "Take your time.",
  },
  {
    id: "bea",
    name: "Bea",
    role: "Hotel concierge",
    home: "hotel",
    look: 6,
    greeting:
      "Welcome to the Web Hotel. The roof lounge is open, and the lift works today.",
    phrase: "There's room upstairs.",
  },
  {
    id: "otto",
    name: "Otto",
    role: "Noodle cook",
    home: "ramen",
    look: 7,
    greeting:
      "The broth's been going since six. Pick a stool and I'll bring you a bowl.",
    phrase: "One more bowl?",
  },
  {
    id: "elli",
    name: "Elli",
    role: "Bookseller",
    home: "books",
    look: 8,
    greeting:
      "You can borrow the chair, but you have to buy the book. House rules.",
    phrase: "A good one on this shelf.",
  },
  {
    id: "kai",
    name: "Kai",
    role: "Terminal keeper",
    home: "tower",
    look: 9,
    greeting:
      "Upstairs is the control room. All the terminals here run on demo activity for now.",
    phrase: "Someone at the door.",
  },
  {
    id: "lou",
    name: "Lou",
    role: "Illustrator",
    home: "cafe",
    look: 10,
    greeting:
      "I've drawn this street twelve times. The tram always moves before I finish.",
    phrase: "Hold still a second.",
  },
  {
    id: "imai",
    name: "Imai",
    role: "Delivery rider",
    home: "hotel",
    look: 11,
    greeting:
      "Three deliveries left. Then I'm taking my coffee up to the hotel roof.",
    phrase: "Just passing through.",
  },
];
export function residentById(id: string): Resident {
  const known = residents.find((r) => r.id === id);
  if (known) return known;
  const n = Number(id.replace("visitor-", "")) || 0;
  const base = residents[n % residents.length];
  return {
    ...base,
    id,
    name: ["Alex", "Yuki", "Sam", "Nina", "Sol", "Robin", "Dee", "Noa"][n % 8],
    role: "Street regular",
    greeting:
      "I live a few blocks from here. Usually you can find me at the café or waiting for the tram.",
    phrase: [
      "Café first.",
      "Missed the tram again.",
      "Hello there.",
      "Nice evening for a walk.",
    ][n % 4],
  };
}
export const getBuilding = (id: BuildingId) =>
  buildings.find((b) => b.id === id)!;
export interface RoomLocation {
  building: BuildingId;
  floor: number;
}
export type Inspection =
  | { kind: "resident"; id: string }
  | {
      kind: "prop";
      title: string;
      text: string;
      action?: "coffee" | "record" | "water";
    };
export interface HoverTarget {
  label: string;
  x: number;
  y: number;
}
export function roomResidents(room: RoomLocation): Resident[] {
  const primary = residents.find((r) => r.home === room.building)!;
  const start =
    buildings.findIndex((b) => b.id === room.building) + room.floor * 3;
  return [
    primary,
    residents[(start + 4) % 12],
    residents[(start + 7) % 12],
    residents[(start + 10) % 12],
  ].filter((r, i, a) => a.findIndex((o) => o.id === r.id) === i);
}
export function replyTo(
  resident: Resident,
  topic: "place" | "activity" | "tip",
) {
  const b = getBuilding(resident.home);
  if (topic === "place")
    return `${b.name} is my usual spot. ${b.floors[0].description} Click its door when you're outside, or find it in Places.`;
  if (topic === "activity")
    return `Around here, ${b.protocol} visitors head to ${b.name}. The activity feed shows their addresses and requests. These are demo sessions until the honeypot is connected.`;
  return [
    "Take a look upstairs in Honey Tower. Kai keeps the terminal room open.",
    "Jun lets you put a record on at Side A. Start with the turntable.",
    "Old Town Tea has a garden room. Nori will show you the way.",
    "Sora's greenhouse is over in Cache House. Don't forget to water the plants.",
  ][resident.look % 4];
}
