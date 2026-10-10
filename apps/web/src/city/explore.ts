import type { DistrictId } from "./model";
import { MAYOR_LOOK } from "./portraits";

export type BuildingId =
  | "tower"
  | "cafe"
  | "hotel"
  | "records"
  | "archive"
  | "teahouse"
  | "gardens"
  | "ramen"
  | "books"
  | "arcade"
  | "robotics"
  | "aquarium"
  | "transit"
  | "cinema"
  | "fashion"
  | "studio"
  | "clinic"
  | "observatory"
  | "skyport"
  | "gym"
  | "market"
  | "apartments"
  | "energy"
  | "gallery";
export type RoomStyle =
  | "arrival"
  | "command"
  | "skydeck"
  | "espresso"
  | "atelier"
  | "hotel"
  | "pool"
  | "vinyl"
  | "sound"
  | "archive"
  | "servers"
  | "tea"
  | "zen"
  | "hydroponics"
  | "orchard"
  | "ramen"
  | "books"
  | "arcade"
  | "esports"
  | "assembly"
  | "robotlab"
  | "aquarium"
  | "oceanlab"
  | "concourse"
  | "dispatch"
  | "cinema"
  | "projection"
  | "runway"
  | "wardrobe"
  | "fabrication"
  | "print"
  | "clinic"
  | "recovery"
  | "planetarium"
  | "telescope"
  | "hangar"
  | "flight"
  | "gym"
  | "track"
  | "market"
  | "kitchen"
  | "apartment"
  | "common"
  | "reactor"
  | "battery"
  | "gallery";
export type BuildingForm =
  "spire" | "terrace" | "round" | "portal" | "slab" | "sawtooth";
export interface Building {
  id: BuildingId;
  name: string;
  japanese: string;
  color: string;
  district: DistrictId;
  position: [number, number, number];
  exterior: {
    width: number;
    depth: number;
    height: number;
    form: BuildingForm;
  };
  floors: { name: string; style: RoomStyle; description: string }[];
}
const floor = (name: string, style: RoomStyle, description: string) => ({
  name,
  style,
  description,
});
const venue = (
  id: BuildingId,
  name: string,
  color: string,
  district: DistrictId,
  x: number,
  z: number,
  height: number,
  form: BuildingForm,
  floors: Building["floors"],
  width = 19,
  depth = 21,
): Building => ({
  id,
  name,
  japanese: "",
  color,
  district,
  position: [x, 0, z],
  exterior: { width, depth, height, form },
  floors,
});

export const buildings: Building[] = [
  venue("tower", "Honey Tower", "#ffce24", "SSH", -14, -58, 53, "spire", [
    floor(
      "Arrival hall",
      "arrival",
      "A floating honeycomb sculpture hangs over the reception island.",
    ),
    floor(
      "City command",
      "command",
      "A curved bank of terminals faces a live model of the city.",
    ),
    floor(
      "Sky deck",
      "skydeck",
      "The observation ring sits above the maglev line.",
    ),
  ]),
  venue("cafe", "Honey Café", "#ffb800", "SSH", -14, -26, 12, "round", [
    floor(
      "Espresso lab",
      "espresso",
      "A circular coffee bar and yellow booths surround the espresso machine.",
    ),
    floor(
      "Drawing atelier",
      "atelier",
      "Lou's easels face a wall of oversized city sketches.",
    ),
  ]),
  venue("hotel", "Web Hotel", "#00e7bc", "HTTP", 14, -26, 27, "terrace", [
    floor(
      "Check-in lounge",
      "hotel",
      "Luggage pods and a long emerald desk welcome new arrivals.",
    ),
    floor(
      "Infinity lounge",
      "pool",
      "An indoor blue pool separates the cabanas from the skyline.",
    ),
  ]),
  venue("records", "Side A Records", "#ff398e", "HTTP", 42, -26, 16, "portal", [
    floor(
      "Vinyl exchange",
      "vinyl",
      "Crates of records sit beneath a giant wall-mounted turntable.",
    ),
    floor(
      "Sound stage",
      "sound",
      "A raised DJ booth faces a checkerboard dance floor.",
    ),
  ]),
  venue("archive", "The Archive", "#9955ff", "MYSQL", 70, -26, 25, "slab", [
    floor(
      "Memory hall",
      "archive",
      "Tall violet data columns surround a sunken reading island.",
    ),
    floor(
      "Cold storage",
      "servers",
      "Glass server vaults flank a clear central service aisle.",
    ),
  ]),
  venue("teahouse", "Cloud Tea", "#82f428", "TELNET", -70, 18, 13, "terrace", [
    floor(
      "Tea pavilion",
      "tea",
      "Low green tables sit between curved screens and a pebble garden.",
    ),
    floor(
      "Rain garden",
      "zen",
      "Bamboo islands and stepping stones cross a shallow reflecting pool.",
    ),
  ]),
  venue("gardens", "Cache Gardens", "#19e6aa", "REDIS", 42, 52, 16, "terrace", [
    floor(
      "Hydroponic lab",
      "hydroponics",
      "Grow towers and pink lamps feed rows of seedlings.",
    ),
    floor(
      "Citrus terrace",
      "orchard",
      "Fruit trees, a seed library and a potting station fill the open roof.",
    ),
  ]),
  venue(
    "ramen",
    "Midnight Ramen",
    "#ff5c26",
    "TELNET",
    -42,
    -26,
    11,
    "sawtooth",
    [
      floor(
        "Noodle circuit",
        "ramen",
        "A U-shaped orange counter wraps around the open broth kitchen.",
      ),
    ],
  ),
  venue("books", "Corner Books", "#257aff", "MYSQL", -14, 18, 14, "slab", [
    floor(
      "Book maze",
      "books",
      "Blue shelves form little reading alcoves around a clear walking loop.",
    ),
  ]),
  venue("arcade", "Pixel Palace", "#fb42f5", "HTTP", -14, 52, 18, "portal", [
    floor(
      "Arcade floor",
      "arcade",
      "Racing cabinets and rhythm machines face a glowing dance platform.",
    ),
    floor(
      "Tournament arena",
      "esports",
      "Two teams of terminals face each other across the arena.",
    ),
  ]),
  venue("robotics", "Bot Works", "#ff7035", "HTTP", 70, -58, 25, "sawtooth", [
    floor(
      "Assembly line",
      "assembly",
      "Orange robot arms assemble little courier bots along the conveyor.",
    ),
    floor(
      "Bot nursery",
      "robotlab",
      "Charging nests and a test track give new robots room to learn.",
    ),
  ]),
  venue("aquarium", "Blue Current", "#00bfff", "REDIS", 70, 18, 20, "round", [
    floor(
      "Ocean gallery",
      "aquarium",
      "An enormous blue cylindrical tank rises above coral display pools.",
    ),
    floor(
      "Marine lab",
      "oceanlab",
      "Sample tanks and microscopes overlook the water below.",
    ),
  ]),
  venue("transit", "Maglev Central", "#00d9ff", "HTTP", -70, 52, 14, "portal", [
    floor(
      "Concourse",
      "concourse",
      "Ticket gates, route boards and platform seating connect the city.",
    ),
    floor(
      "Dispatch gallery",
      "dispatch",
      "An illuminated route map stretches behind the dispatch consoles.",
    ),
  ]),
  venue("cinema", "Afterglow Cinema", "#ff3c69", "HTTP", -42, 52, 18, "slab", [
    floor(
      "Screen one",
      "cinema",
      "Rows of red seats face a huge widescreen city film.",
    ),
    floor(
      "Projection booth",
      "projection",
      "Projectors and film reels share a balcony above the screen.",
    ),
  ]),
  venue("fashion", "Prism House", "#fd38a5", "MYSQL", 42, 18, 20, "slab", [
    floor(
      "Runway",
      "runway",
      "A pink runway cuts between sculptural clothing displays.",
    ),
    floor(
      "Wardrobe lab",
      "wardrobe",
      "Fabric rolls, fitting pods and sewing stations fill the upper floor.",
    ),
  ]),
  venue("studio", "Maker Station", "#ffd320", "SSH", 14, 52, 15, "sawtooth", [
    floor(
      "Fabrication hall",
      "fabrication",
      "Laser cutters and enclosed printers surround the shared workbench.",
    ),
    floor(
      "Print room",
      "print",
      "Bright posters dry beside a screen-printing press.",
    ),
  ]),
  venue("clinic", "Pulse Clinic", "#3dffcf", "REDIS", 70, 52, 17, "round", [
    floor(
      "Scan lounge",
      "clinic",
      "White scanning arches and mint treatment pods line the room.",
    ),
    floor(
      "Recovery garden",
      "recovery",
      "Quiet recliners face a wall of plants and the daylight panels.",
    ),
  ]),
  venue(
    "observatory",
    "Orbit Observatory",
    "#a675ff",
    "MYSQL",
    -42,
    -58,
    33,
    "round",
    [
      floor(
        "Planetarium",
        "planetarium",
        "A glowing solar system hangs over the circular planetarium.",
      ),
      floor(
        "Telescope deck",
        "telescope",
        "A huge telescope points through the open roof.",
      ),
    ],
  ),
  venue("skyport", "Skyport 8", "#28c5ff", "HTTP", -70, -58, 31, "portal", [
    floor(
      "Courier hangar",
      "hangar",
      "A winged courier craft rests on the illuminated landing pad.",
    ),
    floor(
      "Flight lounge",
      "flight",
      "Departure boards and departure pods face the launch windows.",
    ),
  ]),
  venue("gym", "Vector Club", "#beff29", "SSH", -70, -26, 17, "slab", [
    floor(
      "Movement studio",
      "gym",
      "Punch bags, climbing grips and training rigs leave a long open lane.",
    ),
    floor(
      "Sprint deck",
      "track",
      "A striped running circuit surrounds the stretching deck.",
    ),
  ]),
  venue(
    "market",
    "Circuit Market",
    "#ffbd30",
    "TELNET",
    -42,
    18,
    12,
    "sawtooth",
    [
      floor(
        "Night market",
        "market",
        "Four different food stalls surround a central shared table.",
      ),
      floor(
        "Test kitchen",
        "kitchen",
        "Steel cooking islands and bright ingredient trays invite experiments.",
      ),
    ],
  ),
  venue(
    "apartments",
    "Chromatic Lofts",
    "#6591ff",
    "MYSQL",
    42,
    -58,
    37,
    "terrace",
    [
      floor(
        "Open apartment",
        "apartment",
        "A blue living pod, compact kitchen and sleeping loft make a home.",
      ),
      floor(
        "Residents' commons",
        "common",
        "A game table, parcel lockers and shared lounge connect the neighbors.",
      ),
    ],
  ),
  venue("energy", "Solar Exchange", "#ffdf35", "REDIS", 14, -58, 39, "spire", [
    floor(
      "Reactor gallery",
      "reactor",
      "A glowing power core sits inside a ring of yellow containment fins.",
    ),
    floor(
      "Battery library",
      "battery",
      "Color-coded battery cells line the walls beside the energy desk.",
    ),
  ]),
  venue("gallery", "Light Museum", "#ff779e", "MYSQL", 14, 18, 13, "round", [
    floor(
      "Light gallery",
      "gallery",
      "Floating color sculptures and a tunnel of light fill an open gallery.",
    ),
  ]),
];
// Footprints vary by use; all volumes still map to exactly one entrance.
const footprints: Partial<Record<BuildingId, [number, number]>> = {
  cafe: [16, 17],
  teahouse: [17, 17],
  ramen: [18, 17],
  books: [15, 19],
  gardens: [22, 22],
  robotics: [22, 22],
  archive: [18, 23],
  hotel: [21, 22],
  gallery: [16, 17],
  observatory: [20, 23],
  skyport: [23, 23],
  transit: [23, 20],
  market: [23, 21],
  cinema: [22, 23],
  apartments: [20, 23],
  energy: [17, 20],
};
for (const b of buildings) {
  const size = footprints[b.id];
  if (size) {
    b.exterior.width = size[0];
    b.exterior.depth = size[1];
  }
}

export interface Resident {
  id: string;
  name: string;
  role: string;
  home: BuildingId;
  look: number;
  greeting: string;
  phrase: string;
  /** Always present on this floor of their home building, besides walking the streets. */
  floor?: number;
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
      "Welcome to the Web Hotel. The infinity lounge is upstairs. Take the stairs on the right.",
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
      "City command is upstairs. All the terminals here run on demo activity for now.",
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
  {
    id: "david-lisnard",
    name: "David Lisnard",
    role: "Mayor of Honeyrizons",
    home: "tower",
    look: MAYOR_LOOK,
    greeting:
      "Bienvenue à Honeyrizons ! Every service has its own building here, and I like to know who knocks on each door.",
    phrase: "Bonjour !",
    floor: 0,
  },
];
const newHosts: [BuildingId, string, string, string][] = [
  [
    "arcade",
    "Zed",
    "Arcade host",
    "The rhythm pad is free. My high score isn't.",
  ],
  [
    "robotics",
    "Bolt",
    "Robot engineer",
    "The little orange bots deliver parcels. This one keeps stealing my screwdriver.",
  ],
  [
    "aquarium",
    "Coral",
    "Marine keeper",
    "Watch the blue tank. The fish take turns leading the school.",
  ],
  [
    "transit",
    "Rail",
    "Transit guide",
    "The maglev loops around the city. Dispatch is upstairs.",
  ],
  [
    "cinema",
    "Flick",
    "Projectionist",
    "Today's film is a slow ride over the rooftops. The best seat is in the middle.",
  ],
  [
    "fashion",
    "Prism",
    "Clothing designer",
    "Every jacket here is a color experiment. Try the pink one.",
  ],
  [
    "studio",
    "Chip",
    "Fabricator",
    "We print spare parts downstairs and posters upstairs.",
  ],
  [
    "clinic",
    "Pulse",
    "Care bot",
    "The scan is just a light show today. Take a seat and catch your breath.",
  ],
  [
    "observatory",
    "Nova",
    "Astronomer",
    "The planets aren't to scale. You'd be walking for years.",
  ],
  [
    "skyport",
    "Aero",
    "Courier pilot",
    "The wings fold in for landing. Keep clear of the yellow pad.",
  ],
  [
    "gym",
    "Dash",
    "Movement coach",
    "Leave the weights for a minute. Take a lap upstairs.",
  ],
  [
    "market",
    "Pep",
    "Market cook",
    "Pick a stall. I recommend the orange dumplings.",
  ],
  [
    "apartments",
    "Hue",
    "Loft resident",
    "Come in. The parcel lockers are upstairs, and someone left a game running.",
  ],
  [
    "energy",
    "Lux",
    "Energy keeper",
    "The core charges the street lamps. They switch on at sunset.",
  ],
  [
    "gallery",
    "Ray",
    "Light artist",
    "Walk through the light tunnel. The colors change as you turn.",
  ],
];
newHosts.forEach(([home, name, role, greeting], i) =>
  residents.push({
    id: home + "-host",
    name,
    role,
    home,
    look: i + 12,
    greeting,
    phrase: ["Come on in.", "Take a look upstairs.", "Hello, traveler."][i % 3],
  }),
);
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
/** Pointer position and canvas size, in pixels relative to the canvas. */
export interface HoverTarget {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export function roomResidents(room: RoomLocation): Resident[] {
  const primary = residents.find((r) => r.home === room.building)!;
  const start =
    buildings.findIndex((b) => b.id === room.building) + room.floor * 3;
  const regulars = residents.filter((r) => r.home === room.building && r.floor === room.floor);
  return [
    ...regulars,
    primary,
    residents[(start + 4) % residents.length],
    residents[(start + 7) % residents.length],
    residents[(start + 10) % residents.length],
  ]
    .filter((r, i, a) => a.findIndex((o) => o.id === r.id) === i)
    // Interiors lay out four spots.
    .slice(0, 4);
}
export function replyTo(
  resident: Resident,
  topic: "place" | "activity" | "tip",
) {
  const b = getBuilding(resident.home);
  if (topic === "place")
    return `${b.name} is my usual spot. ${b.floors[0].description} Click its door when you're outside, or find it in Places.`;
  if (topic === "activity")
    return `Around here, ${b.district} visitors head to ${b.name}. The sessions page shows every address and request they leave behind.`;
  return [
    "Take a look upstairs in Honey Tower. Kai keeps city command open.",
    "Jun lets you put a record on at Side A. Start with the turntable.",
    "Cloud Tea has a garden room. Nori will show you the way.",
    "Sora's hydroponic lab is over in Cache Gardens. Don't forget to water the plants.",
  ][resident.look % 4];
}
