import * as THREE from "three";
import { CityGeometry } from "./geometry";
import { furnishRoom } from "./roomLayouts";
import { CharacterArt, type Citizen } from "./characters";
import { getBuilding, roomResidents, type RoomLocation } from "./explore";
import { FLOOR_HEIGHT, type RoomCollider } from "./RoomController";

export interface Interior {
  root: THREE.Group;
  geometries: CityGeometry[];
  colliders: RoomCollider[];
  floors: number;
  update: (time: number, moving: boolean, selected: string | null) => void;
  picks: THREE.Object3D[];
  people: Citizen[];
  record: THREE.Mesh | null;
  dispose: () => void;
}
function buildRoom(location: RoomLocation, art: CharacterArt) {
  const building = getBuilding(location.building);
  const floor = building.floors[location.floor];
  const style = floor.style;
  const roof = [
    "skydeck",
    "orchard",
    "telescope",
    "track",
    "recovery",
  ].includes(style);
  const darkRoom = [
    "arcade",
    "esports",
    "sound",
    "cinema",
    "planetarium",
    "servers",
    "reactor",
  ].includes(style);
  const wall = darkRoom ? "#1c3555" : "#e0edff";
  const tile = darkRoom ? "#223d5d" : "#e9f3ff";
  const root = new THREE.Group();
  const warmLight = new THREE.PointLight(building.color, 28, 24, 1.5);
  warmLight.position.set(-4, 3.9, 0);
  root.add(warmLight);
  const windowLight = new THREE.PointLight("#00dcff", 12, 20, 1.5);
  windowLight.position.set(-10, 3.3, 3);
  root.add(windowLight);
  const geo = new CityGeometry();
  // Human-scale furniture beneath a tall painted ceiling.
  const box: CityGeometry["box"] = (x, y, z, w, h, d, color, rotation, glow) =>
    geo.box(x, y * 0.72, z, w, h * 0.72, d, color, rotation, glow);
  const sign: CityGeometry["sign"] = (
    text,
    x,
    y,
    z,
    w,
    h,
    bg,
    color,
    rotation,
  ) => geo.sign(text, x, y * 0.72, z, w, h * 0.72, bg, color, rotation);
  const prop: CityGeometry["prop"] = (
    kind,
    x,
    y,
    z,
    w,
    h,
    d,
    color,
    rotation,
    glow,
  ) => geo.prop(kind, x, y * 0.72, z, w, h * 0.72, d, color, rotation, glow);
  const colliders: RoomCollider[] = [];
  function solid(x: number, z: number, w: number, d: number) {
    colliders.push({ x, z, w, d, floor: location.floor });
  }
  const picks: THREE.Object3D[] = [];
  const extras: THREE.Mesh[] = [];
  let record: THREE.Mesh | null = null;
  const ink = "#172f50",
    timber = "#6685a4",
    brass = "#00ddff";
  const pickMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  function pick(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    data: Record<string, unknown>,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.72, d),
      pickMaterial,
    );
    mesh.position.set(x, y * 0.72, z);
    mesh.userData = data;
    root.add(mesh);
    picks.push(mesh);
    return mesh;
  }
  function object(
    title: string,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    action?: "coffee" | "record" | "water",
  ) {
    pick(x, y, z, w, h, d, { kind: "prop", title, text, action });
  }
  function plant(x: number, z: number, size = 1) {
    solid(x, z, size, size);
    prop("cylinder", x, 0.8, z, 1 * size, 1.1, 1 * size, "#edf6ff");
    box(x, 2, z, 0.12, 2.5, 0.12, "#38bc79");
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      prop(
        "leaf",
        x + Math.cos(a) * 0.7 * size,
        1.6 + i * 0.24,
        z + Math.sin(a) * 0.7 * size,
        0.55 * size,
        0.65 * size,
        0.55 * size,
        i % 2 ? "#26a975" : "#91ca46",
      );
    }
  }
  function stool(x: number, z: number, color = building.color) {
    solid(x, z, 0.9, 0.9);
    prop("cylinder", x, 1.15, z, 1.25, 0.18, 1.25, color);
    for (const dx of [-0.38, 0.38])
      for (const dz of [-0.38, 0.38])
        box(x + dx, 0.66, z + dz, 0.12, 1, 0.12, timber);
  }
  function table(x: number, z: number, w = 3, d = 2.2) {
    solid(x, z, w, d);
    box(x, 1.5, z, w, 0.18, d, "#edf6ff");
    for (const dx of [-w / 2 + 0.3, w / 2 - 0.3])
      for (const dz of [-d / 2 + 0.3, d / 2 - 0.3])
        box(x + dx, 0.85, z + dz, 0.14, 1.35, 0.14, ink);
  }
  function cup(x: number, z: number, y = 1.76) {
    prop("cylinder", x, y, z, 0.28, 0.34, 0.28, "#fff0d2");
    prop("cylinder", x, y + 0.18, z, 0.23, 0.03, 0.23, "#694b37");
  }
  function shelf(x: number, z: number, w = 5, books = true) {
    solid(x, z, w + 0.3, 1.2);
    for (const dx of [-w / 2, w / 2])
      box(x + dx, 2.8, z, 0.18, 5.3, 0.9, timber);
    for (let row = 0; row < 4; row++) {
      const y = 0.8 + row * 1.25;
      box(x, y, z, w, 0.14, 1.2, timber);
      for (let n = 0; n < Math.floor(w * 2); n++) {
        const px = x - w / 2 + 0.3 + n * 0.48;
        box(
          px,
          y + 0.48,
          z + 0.08,
          books ? 0.3 : 0.38,
          0.7 + (n % 3) * 0.12,
          books ? 0.65 : 0.85,
          [building.color, "#ffda27", "#00ccff", "#ff329c", "#ab55ff"][n % 5],
        );
      }
    }
  }
  function sofa(x: number, z: number) {
    solid(x, z, 4.9, 2);
    box(x, 0.65, z, 4.6, 0.5, 1.9, timber);
    box(x, 1.55, z - 0.65, 4.7, 1.45, 0.55, building.color);
    for (const dx of [-1.2, 0, 1.2])
      box(x + dx, 1, z + 0.1, 1.05, 0.3, 1.45, building.color);
    for (const dx of [-2.3, 2.3])
      box(x + dx, 1.1, z, 0.4, 1.25, 1.9, building.color);
    box(x - 1.15, 1.5, z - 0.35, 0.75, 0.7, 0.35, "#00ccff");
  }
  // Floors leave an open stairwell on the east side. Landings connect both flights.
  box(-3.5, -0.2, 0, 20, 0.4, 20.4, tile);
  for (const z of [-8.8, 8.8]) box(9.4, -0.2, z, 6, 0.4, 2.6, tile);
  if (building.floors.length === 1 || location.floor === 0)
    box(9.4, -0.2, 0, 6, 0.4, 20.4, tile);
  for (let x = -12; x <= 12; x += 1.5)
    for (let z = -9; z <= 9; z += 1.5) {
      if (
        building.floors.length > 1 &&
        location.floor > 0 &&
        x > 6 &&
        Math.abs(z) < 7.5
      )
        continue;
      box(
        x,
        0.07,
        z,
        1.47,
        0.14,
        1.47,
        Math.round(x / 1.5 + z / 1.5) % 2
          ? tile
          : darkRoom
            ? "#294466"
            : "#dceaff",
      );
    }
  if (!roof) {
    box(0, 3.33, -10, 27, 6.66, 0.35, wall);
    box(13.25, 3.33, 0, 0.35, 6.66, 20, building.color);
    // The ceiling stops at the stairwell. Front wall has a walk-through doorway.
    box(-3.5, 6.6, 0, 20, 0.22, 20, tile);
    for (const x of [-7.6, 7.6]) box(x, 3.33, 10, 11.4, 6.66, 0.35, ink);
    box(0, 5.45, 10, 4, 2.4, 0.35, ink);
    for (const x of [-7.6, 7.6]) {
      box(x, 3.3, 9.76, 7.4, 3.1, 0.08, "#4cd8ff", 0, true);
      box(x, 3.3, 9.69, 0.1, 3.1, 0.08, brass);
      box(x, 3.3, 9.69, 7.4, 0.1, 0.08, brass);
    }
    // Low wall panels and a central rug give the room a clear walking route.
    box(0, 0.45, -9.76, 26, 0.85, 0.1, building.color);
    box(-13.01, 0.45, 0, 0.1, 0.85, 20, building.color);
    for (const x of [-6, 0, 5]) {
      box(x, 6.15, -1, 0.035, 0.9, 0.035, ink);
      prop("cylinder", x, 5.6, -1, 0.9, 0.4, 0.9, building.color, 0, true);
    }
    box(-13.25, 3.5, 0, 0.35, 7, 20, wall);
    for (const y of [0.65, 3.25, 6.8]) {
      box(0, y, -9.78, 27, 0.16, 0.12, building.color);
      box(-13, y, 0, 0.12, 0.16, 20, building.color);
    }
    // Large side windows, set against painted plaster with brass frames.
    for (const z of [-4, 2, 7]) {
      box(-13.02, 4.6, z, 0.12, 3.3, 3.6, ink);
      box(-12.93, 4.6, z, 0.05, 2.9, 3.2, "#39bcff", 0, true);
      box(-12.89, 4.6, z, 0.06, 2.9, 0.07, brass);
      box(-12.89, 4.6, z, 0.06, 0.07, 3.2, brass);
    }
  } else {
    box(0, 0.7, -10, 27, 1.3, 0.3, ink);
    box(13.2, 0.7, 0, 0.3, 1.3, 20, ink);
    for (const x of [-7.6, 7.6]) box(x, 0.7, 10, 11.4, 1.3, 0.3, ink);
    for (let z = -9; z <= 9; z += 1.5) box(13.2, 1.5, z, 0.09, 1.8, 0.09, ink);
    box(13.2, 2.3, 0, 0.1, 0.1, 20, ink);
    box(-13.25, 0.7, 0, 0.3, 1.3, 20, ink);
    for (let x = -12; x <= 12; x += 1.5) box(x, 1.5, -10, 0.09, 1.8, 0.09, ink);
    box(0, 2.3, -10, 27, 0.1, 0.1, ink);
  }
  sign(floor.name, -3, 6.08, -9.74, 8, 0.56, ink, building.color);
  // A front doorway is visible from every room and restores the street view.
  for (const x of [-2, 2]) box(x, 2.1, 9.7, 0.25, 4.2, 0.3, ink);
  box(0, 4.2, 9.7, 4.3, 0.25, 0.3, brass);
  sign("Street / exit", 0, 4.25, 9.5, 3.7, 0.65, ink, building.color, Math.PI);
  pick(0, 1.7, 10, 3.8, 3.4, 0.35, { kind: "exit" });
  plant(-10, 7, 1.25);
  if (building.floors.length === 1) plant(11, 3, 1.25);
  if (building.floors.length > 1) {
    sign(
      location.floor < building.floors.length - 1
        ? "Stairs / upstairs"
        : "Stairs / downstairs",
      9.4,
      2.8,
      -9.72,
      5,
      0.7,
      ink,
      building.color,
    );
    if (location.floor < building.floors.length - 1) {
      const sx = location.floor % 2 === 0 ? 10.75 : 7.9;
      for (let i = 0; i < 32; i++) {
        const t = (i + 0.5) / 32;
        const z = location.floor % 2 === 0 ? 7.4 - t * 14.8 : -7.4 + t * 14.8;
        const height = ((i + 1) * FLOOR_HEIGHT) / 32;
        geo.box(
          sx,
          height - 0.07,
          z,
          2.5,
          0.14,
          14.8 / 32 + 0.04,
          i % 2 ? "#dceaff" : building.color,
        );
        if (i % 4 === 0)
          for (const dx of [-1.32, 1.32]) {
            geo.box(sx + dx, height + 0.52, z, 0.06, 1.04, 0.06, "#00bbef");
          }
        if (i % 8 === 0)
          geo.box(sx, height / 2, z, 0.18, height, 0.15, "#00bbef");
      }
      for (const dx of [-1.32, 1.32]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 0.09, Math.hypot(14.8, FLOOR_HEIGHT)),
          geo.material("#00bbef"),
        );
        rail.position.set(sx + dx, FLOOR_HEIGHT / 2 + 1.03, 0);
        rail.rotation.x =
          Math.atan2(FLOOR_HEIGHT, 14.8) * (location.floor % 2 === 0 ? 1 : -1);
        root.add(rail);
        extras.push(rail);
      }
    }
  }

  if (!roof) {
    if (
      [
        "assembly",
        "fabrication",
        "print",
        "servers",
        "kitchen",
        "dispatch",
        "concourse",
      ].includes(style)
    ) {
      for (const z of [-7, 0, 6]) {
        box(-3.5, 6.35, z, 19.7, 0.3, 0.5, ink);
        box(-3.5, 6.15, z, 17, 0.08, 0.14, "#c4f5ff", 0, true);
      }
    } else if (
      ["hydroponics", "zen", "tea", "oceanlab", "pool", "atelier"].includes(
        style,
      )
    ) {
      for (const x of [-10, -5, 0]) {
        box(x, 6.43, 0, 3.7, 0.08, 15, "#69cced", 0, true);
        for (const z of [-6, 0, 6]) box(x, 6.35, z, 3.9, 0.09, 0.12, ink);
      }
    } else if (style === "planetarium") {
      for (let i = 0; i < 48; i++) {
        const a = i * 2.4,
          r = 1 + (i % 7);
        box(
          -4 + Math.cos(a) * r,
          6.4,
          Math.sin(a) * r,
          0.055,
          0.04,
          0.055,
          "#d3ddff",
          0,
          true,
        );
      }
    }
    for (const z of [-8, 8])
      box(-3.5, 6.42, z, 19.5, 0.06, 0.06, building.color, 0, true);
  }

  const layout = furnishRoom(style, {
    building,
    box,
    prop,
    sign,
    solid,
    object,
    table,
    stool,
    plant,
    shelf,
    sofa,
    mesh(geometry, color, x, y, z, glow = false) {
      const mesh = new THREE.Mesh(geometry, geo.material(color, glow));
      mesh.position.set(x, y * 0.72, z);
      mesh.scale.y = 0.72;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      extras.push(mesh);
      return mesh;
    },
  });
  record = layout.record;
  const candidates = [
    [-4, -7],
    [4.8, 7],
    [-10.8, 3],
    [4.8, -1],
    [-8, 6],
    [0, 6],
    [-11, 0],
    [4, -7],
    [-5, 4],
    [1, 0],
    [-8, -3],
    [-1, -8],
  ];
  const positions = candidates
    .filter(
      ([x, z]) =>
        !colliders.some(
          (c) =>
            Math.abs(x - c.x) < c.w / 2 + 0.7 &&
            Math.abs(z - c.z) < c.d / 2 + 1.2,
        ),
    )
    .slice(0, 4);
  // Authoring errors should never place a resident inside a counter.
  for (let z = 6; positions.length < 4 && z >= -8; z -= 2)
    for (let x = -11; positions.length < 4 && x <= 4; x += 3)
      if (
        !colliders.some(
          (c) =>
            Math.abs(x - c.x) < c.w / 2 + 0.7 &&
            Math.abs(z - c.z) < c.d / 2 + 0.7,
        )
      )
        positions.push([x, z]);
  const people = roomResidents(location).map((resident, i) => {
    const [x, z] = positions[i];
    const person = art.create(resident, root, x, 0.11, z, 0.85);
    person.body.userData.floor = location.floor;
    picks.push(person.figure.hit);
    return person;
  });
  const bubble = art.bubble(
    people[0].resident.phrase,
    root,
    positions[0][0],
    2.75,
    positions[0][1],
  );
  bubble.scale.set(3, 0.65, 1);
  function update(time: number, moving: boolean, selected: string | null) {
    if (moving) layout.update(time);
    people.forEach((person, i) => {
      const [x, z] = positions[i];
      // Residents stay in the clear aisles. Selected residents stop for a conversation.
      const offset =
        i === 0 || selected === person.resident.id
          ? 0
          : Math.sin(time * 0.4 + i * 2) * (i === 1 ? 0.8 : 1.2);
      if (
        moving &&
        selected !== person.resident.id &&
        !colliders.some(
          (c) =>
            Math.abs(x - c.x) < c.w / 2 + 0.3 &&
            Math.abs(z + offset - c.z) < c.d / 2 + 0.3,
        )
      )
      {
        // Turn towards the way they're pacing, and face the room when standing.
        const dz = z + offset - person.body.position.z;
        person.body.position.z = z + offset;
        if (Math.abs(dz) > 0.0005) person.figure.face(0, dz);
      }
      const walking = moving && i > 0 && selected !== person.resident.id;
      // Standing residents face the room; the one you're talking to keeps facing you (set by the scene).
      if (!walking && selected !== person.resident.id) person.body.rotation.y = 0;
      person.figure.pose(time * 6 + i, walking);
      person.shadow.position.set(
        person.body.position.x,
        0.115,
        person.body.position.z,
      );
    });
  }
  geo.finish();
  root.add(geo.root);
  return {
    root,
    geometry: geo,
    picks,
    people,
    record,
    colliders,
    update,
    dispose() {
      art.release(root);
      geo.dispose();
      picks.forEach((p) => {
        if (p instanceof THREE.Mesh) p.geometry.dispose();
      });
      pickMaterial.dispose();
      extras.forEach((m) => m.geometry.dispose());
    },
  };
}

/** Assemble the complete building so walking on stairs keeps one continuous 3D space. */
export function buildInterior(
  location: RoomLocation,
  art: CharacterArt,
): Interior {
  const building = getBuilding(location.building);
  const root = new THREE.Group();
  const rooms = building.floors.map((_, floor) => {
    const room = buildRoom({ building: building.id, floor }, art);
    room.root.position.y = floor * FLOOR_HEIGHT;
    room.picks.forEach((p) => {
      p.userData.floor = floor;
    });
    root.add(room.root);
    return room;
  });
  return {
    root,
    geometries: rooms.map((r) => r.geometry),
    picks: rooms.flatMap((r) => r.picks),
    people: rooms.flatMap((r) => r.people),
    colliders: rooms.flatMap((r) => r.colliders),
    floors: rooms.length,
    get record() {
      return rooms[location.floor].record;
    },
    update(time, moving, selected) {
      rooms.forEach((r) => r.update(time, moving, selected));
    },
    dispose() {
      rooms.forEach((r) => r.dispose());
    },
  };
}
