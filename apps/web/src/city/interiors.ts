import * as THREE from "three";
import { CityGeometry } from "./geometry";
import { CharacterArt, type CitizenSprite } from "./characters";
import { getBuilding, roomResidents, type RoomLocation } from "./explore";

export interface Interior {
  root: THREE.Group;
  geometry: CityGeometry;
  picks: THREE.Object3D[];
  people: CitizenSprite[];
  record: THREE.Mesh | null;
  dispose: () => void;
}
export function buildInterior(
  location: RoomLocation,
  art: CharacterArt,
): Interior {
  const building = getBuilding(location.building);
  const floor = building.floors[location.floor];
  const style = floor.style;
  const roof = style === "rooftop";
  const root = new THREE.Group();
  const warmLight = new THREE.PointLight("#ffe0a3", 25, 24, 1.5);
  warmLight.position.set(-4, 6, 0);
  root.add(warmLight);
  const windowLight = new THREE.PointLight("#a5d5dd", 12, 20, 1.5);
  windowLight.position.set(-10, 4, 3);
  root.add(windowLight);
  const geo = new CityGeometry();
  const box = geo.box.bind(geo),
    sign = geo.sign.bind(geo);
  const picks: THREE.Object3D[] = [];
  const extras: THREE.Mesh[] = [];
  let record: THREE.Mesh | null = null;
  const ink = "#345565",
    timber = "#ad8059",
    brass = "#ddb567";
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
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pickMaterial);
    mesh.position.set(x, y, z);
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
    geo.prop("cylinder", x, 0.8, z, 1 * size, 1.1, 1 * size, "#c88c69");
    box(x, 2, z, 0.12, 2.5, 0.12, "#7d8a56");
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      geo.prop(
        "leaf",
        x + Math.cos(a) * 0.7 * size,
        1.6 + i * 0.24,
        z + Math.sin(a) * 0.7 * size,
        0.55 * size,
        0.65 * size,
        0.55 * size,
        i % 2 ? "#6ca282" : "#8ab080",
      );
    }
  }
  function stool(x: number, z: number, color = building.color) {
    geo.prop("cylinder", x, 1.15, z, 1.25, 0.18, 1.25, color);
    for (const dx of [-0.38, 0.38])
      for (const dz of [-0.38, 0.38])
        box(x + dx, 0.66, z + dz, 0.12, 1, 0.12, timber);
  }
  function table(x: number, z: number, w = 3, d = 2.2) {
    box(x, 1.5, z, w, 0.18, d, "#d0a67a");
    for (const dx of [-w / 2 + 0.3, w / 2 - 0.3])
      for (const dz of [-d / 2 + 0.3, d / 2 - 0.3])
        box(x + dx, 0.85, z + dz, 0.14, 1.35, 0.14, ink);
  }
  function cup(x: number, z: number, y = 1.76) {
    geo.prop("cylinder", x, y, z, 0.28, 0.34, 0.28, "#fff0d2");
    geo.prop("cylinder", x, y + 0.18, z, 0.23, 0.03, 0.23, "#694b37");
  }
  function shelf(x: number, z: number, w = 5, books = true) {
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
          [building.color, "#dfad6e", "#72a9a3", "#bd8394", "#ece1bd"][n % 5],
        );
      }
    }
  }
  function sofa(x: number, z: number) {
    box(x, 0.65, z, 4.6, 0.5, 1.9, timber);
    box(x, 1.55, z - 0.65, 4.7, 1.45, 0.55, building.color);
    for (const dx of [-1.2, 0, 1.2])
      box(x + dx, 1, z + 0.1, 1.05, 0.3, 1.45, building.color);
    for (const dx of [-2.3, 2.3])
      box(x + dx, 1.1, z, 0.4, 1.25, 1.9, building.color);
    box(x - 1.15, 1.5, z - 0.35, 0.75, 0.7, 0.35, "#edd1a0");
  }
  // Raised base, tiled floor and two walls. The front and right stay open.
  box(0, -0.35, 0, 27.4, 0.75, 21.4, ink);
  for (let x = -12; x <= 12; x += 1.5)
    for (let z = -9; z <= 9; z += 1.5)
      box(
        x,
        0.07,
        z,
        1.47,
        0.14,
        1.47,
        roof
          ? "#cbbfab"
          : Math.round(x / 1.5 + z / 1.5) % 2
            ? "#e2dfd1"
            : "#ece7d9",
      );
  if (!roof) {
    box(0, 3.5, -10, 27, 7, 0.35, "#e2e0d4");
    box(-13.25, 3.5, 0, 0.35, 7, 20, "#c6d6d1");
    for (const y of [0.65, 3.25, 6.8]) {
      box(0, y, -9.78, 27, 0.16, 0.12, building.color);
      box(-13, y, 0, 0.12, 0.16, 20, building.color);
    }
    // Large side windows, set against painted plaster with brass frames.
    for (const z of [-4, 2, 7]) {
      box(-13.02, 4.6, z, 0.12, 3.3, 3.6, ink);
      box(-12.93, 4.6, z, 0.05, 2.9, 3.2, "#8bbcbf", 0, true);
      box(-12.89, 4.6, z, 0.06, 2.9, 0.07, brass);
      box(-12.89, 4.6, z, 0.06, 0.07, 3.2, brass);
    }
  } else {
    box(0, 0.7, -10, 27, 1.3, 0.3, "#99b3aa");
    box(-13.25, 0.7, 0, 0.3, 1.3, 20, "#99b3aa");
    for (let x = -12; x <= 12; x += 1.5) box(x, 1.5, -10, 0.09, 1.8, 0.09, ink);
    box(0, 2.3, -10, 27, 0.1, 0.1, ink);
    for (const x of [-11, -4])
      for (const z of [-7, 0]) box(x, 3.7, z, 0.18, 7.4, 0.18, timber);
    for (let x = -12; x < -3; x += 0.65)
      box(x, 7.4, -3.5, 0.17, 0.2, 9, timber);
  }
  sign(building.name, -3, 5.65, -9.76, 10, 1.15, building.color, "#fff3d8");
  sign(floor.name, -3, 4.35, -9.74, 7, 0.68, ink, "#e5d4ac");
  // A real clickable lift changes floors. One-floor shops have a storage door.
  box(10, 2.7, -7.7, 4, 5.4, 3.6, ink);
  box(10, 2.7, -5.86, 3.2, 4.65, 0.15, brass);
  box(10, 2.55, -5.74, 2.75, 4.25, 0.13, "#75969e");
  box(10, 2.55, -5.64, 0.05, 4.25, 0.05, ink);
  sign(
    building.floors.length > 1 ? "Lift  ↑" : "Storage",
    10,
    5.25,
    -5.62,
    3.2,
    0.65,
    ink,
    "#f2cf83",
  );
  if (building.floors.length > 1)
    pick(10, 2.9, -7.4, 4.3, 5.8, 4.2, { kind: "lift" });
  else
    object(
      "Storage cupboard",
      "Boxes of supplies for the shop. The rest of the room is open to visitors.",
      10,
      2.9,
      -7.4,
      4.3,
      5.8,
      4.2,
    );
  // The exit is a small street-facing gate at the front of the cutaway.
  for (const x of [8.2, 12.2]) box(x, 2.15, 9.5, 0.25, 4.3, 0.3, ink);
  box(10.2, 4.3, 9.5, 4.4, 0.35, 0.35, ink);
  sign("Street  ↗", 10.2, 4.28, 9.72, 4, 0.65, ink, "#f1d28e");
  pick(10.2, 2.3, 9.5, 4.4, 4.6, 0.8, { kind: "exit" });
  plant(-10, 7, 1.25);
  plant(11, 3, 1.25);

  if (style === "cafe" || style === "ramen" || style === "tea") {
    const tea = style === "tea";
    box(-3, 1.25, -5, 14, 2.35, 2.4, timber);
    box(-3, 2.5, -5, 14.6, 0.18, 2.65, tea ? "#557f6c" : "#ecdbb1");
    for (let x = -8; x <= 2; x += 2.4) {
      box(x, 1.3, -3.75, 0.09, 2.05, 0.07, brass);
      stool(x, -2.15);
      cup(x, -4.55, 2.75);
    }
    shelf(-8, -9.25, 6, false);
    if (style === "cafe") {
      box(0, 3.1, -5.15, 2.9, 1.2, 1.1, "#547b81");
      box(0, 3.65, -5.1, 3.1, 0.12, 1.2, brass);
      for (const x of [-0.75, 0.75]) {
        box(x, 3, -4.54, 0.3, 0.5, 0.1, ink);
        cup(x, -4.3, 2.76);
      }
      object(
        "Coffee machine",
        "Mika's usual order is a flat white with a spoon of honey.",
        0,
        3.1,
        -5.1,
        3.4,
        1.8,
        2,
        "coffee",
      );
      sign(
        "Honey toast   4\nCoffee   3\nTea   2",
        1,
        4.6,
        -9.65,
        4,
        2.6,
        ink,
        "#f6dfa2",
      );
    } else {
      for (const x of [-1, 1])
        geo.prop(
          "cylinder",
          x,
          2.8,
          -5.4,
          1.05,
          0.35,
          1.05,
          style === "ramen" ? "#df805c" : "#7d9e80",
        );
      object(
        tea ? "Tea service" : "Noodle counter",
        tea
          ? "Nori serves roasted green tea in these cups."
          : "Otto keeps a pot of broth on the stove until the last tram.",
        -1,
        2.75,
        -5.1,
        4,
        1,
        2,
        "coffee",
      );
      sign(
        tea ? "煎茶\nRoasted green tea" : "ラーメン\nFresh noodles",
        1,
        4.6,
        -9.65,
        4,
        2.6,
        building.color,
        "#f6dfa2",
      );
    }
    for (const [x, z] of [
      [-7, 3],
      [-1, 4],
      [5, 2],
    ] as const) {
      table(x, z, tea ? 3.6 : 2.7, 2);
      stool(x - 1.9, z);
      stool(x + 1.9, z);
      cup(x, z);
      box(x + 0.65, 1.65, z, 0.5, 0.1, 0.55, brass);
    }
    for (const x of [-8, -2, 4]) {
      box(x, 6.3, -4.8, 0.06, 1.4, 0.06, ink);
      geo.prop(
        "cylinder",
        x,
        5.45,
        -4.8,
        1.1,
        0.6,
        1.1,
        building.color,
        0,
        true,
      );
    }
  } else if (style === "records") {
    shelf(-9, -9.15, 5, false);
    shelf(-3, -9.15, 5, false);
    for (const [x, z] of [
      [-8, -2],
      [-2, 0],
      [4, 1],
    ] as const) {
      box(x, 0.9, z, 3.3, 1.7, 2.4, timber);
      box(x, 1.83, z, 3.5, 0.15, 2.6, ink);
      for (let n = 0; n < 7; n++) {
        box(
          x - 1.25 + n * 0.41,
          2.2,
          z,
          0.28,
          0.7,
          1.55,
          [building.color, "#dda85c", "#819cb6"][n % 3],
        );
      }
    }
    table(3, -5, 5, 2.7);
    box(3, 1.68, -5, 3, 0.2, 1.9, ink);
    record = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.76, 0.06, 40),
      geo.material("#263e4d"),
    );
    record.position.set(3, 1.85, -5);
    root.add(record);
    extras.push(record);
    geo.prop("cylinder", 3, 1.9, -5, 0.3, 0.08, 0.3, building.color);
    box(3.85, 1.92, -4.9, 0.65, 0.06, 0.08, brass);
    for (const x of [0, 6]) {
      box(x, 2.3, -6, 1.2, 2.8, 1.2, ink);
      for (const y of [1.8, 2.8])
        geo.prop("cylinder", x, y, -5.35, 0.65, 0.12, 0.65, "#8b98a2");
    }
    object(
      "Turntable",
      "Jun left a city jazz record on the platter. Put it on and watch the disc turn.",
      3,
      1.8,
      -5,
      3.7,
      1.1,
      2.4,
      "record",
    );
    object(
      "Record bins",
      "A handwritten divider reads: 'For the walk home'. Jun can help you find a record.",
      -2,
      1.5,
      0,
      3.7,
      3,
      2.8,
    );
    sofa(-6, 6);
    table(0, 6, 2.5, 1.6);
    sign("Side A / Side B", 1, 4.3, -9.65, 5, 1.8, ink, "#edb6ba");
  } else if (style === "library" || style === "control") {
    shelf(-9, -9.1, 5);
    shelf(-3, -9.1, 5);
    for (const z of [-4, 1]) shelf(-11.8, z, 1.6);
    table(-3, 0, 10, 4);
    for (const x of [-6, -3, 0]) {
      stool(x, 3);
      stool(x, -3);
      box(x, 1.7, 0, 1.1, 0.18, 1.5, building.color);
    }
    if (style === "control") {
      for (const x of [-6, -2, 2]) {
        box(x, 2.35, -0.6, 2.3, 1.5, 0.3, ink);
        box(x, 2.35, -0.4, 2, 1.2, 0.07, "#79b59f", 0, true);
        sign(
          "Session open\n> listening",
          x,
          2.35,
          -0.34,
          1.9,
          1.1,
          ink,
          "#a2d1b3",
        );
        box(x, 1.72, 0.6, 1.8, 0.08, 0.6, "#658690");
      }
      object(
        "Session terminal",
        "The demo terminal records incoming shell and database sessions. The activity feed contains the full request details.",
        -2,
        2.2,
        0,
        10.5,
        2.5,
        4.3,
      );
      sign("Sessions / local demo", 0, 4.2, -9.65, 6, 1.3, ink, "#a2d1b3");
    } else {
      object(
        "Reading table",
        "The open book is a collection of sketches of this neighborhood. Lou drew the tram on page twelve.",
        -3,
        1.5,
        0,
        10.5,
        1.9,
        4.3,
      );
      sign("Please leave the page open", 1, 4.2, -9.65, 5, 1.3, ink, "#f1dba7");
    }
    sofa(3, 6);
    table(-3, 6, 2, 1.5);
    cup(-3, 6);
    object(
      "Archive shelves",
      "Connection logs and secondhand books share these shelves. Ada files new arrivals by protocol.",
      -3,
      2.8,
      -9,
      5.4,
      5.8,
      1.7,
    );
  } else if (style === "garden" || roof) {
    for (const x of [-10, -6, -2, 3, 7]) {
      plant(x, -7, 1.2);
      box(x, 0.5, -7, 2.8, 0.65, 2.6, "#a0b29b");
    }
    table(-7, 0, 6, 3);
    for (let n = 0; n < 5; n++) {
      geo.prop("cylinder", -9 + n, 1.95, 0, 0.65, 0.65, 0.65, "#c98e67");
      geo.prop("leaf", -9 + n, 2.7, 0, 0.55, 0.85, 0.55, "#73a17c");
    }
    object(
      "Potting bench",
      "The seed trays are dry. Sora keeps a watering can under the bench.",
      -7,
      1.5,
      0,
      6.6,
      3.2,
      3.5,
      "water",
    );
    table(2, 3, 4, 2.5);
    for (const x of [0, 4]) {
      stool(x, 5);
      stool(x, 1);
    }
    cup(2, 3);
    sofa(-7, 6);
    plant(7, -1, 1.5);
    if (!roof) {
      for (let x = -12; x < 13; x += 3) box(x, 6.8, 0, 0.15, 0.18, 20, ink);
      box(0, 6.8, 0, 27, 0.18, 0.15, ink);
    }
    sign(
      roof ? "The roof is open" : "Cuttings / ask Sora",
      0,
      3,
      -9.65,
      6,
      1,
      building.color,
      "#edf2d9",
    );
  } else {
    box(-5, 1.2, -4, 12, 2.3, 2.5, timber);
    box(-5, 2.45, -4, 12.5, 0.18, 2.7, "#e9d7ab");
    for (let x = -10; x < 1; x += 0.6)
      box(x, 1.2, -2.72, 0.1, 2.1, 0.08, brass);
    box(-3, 2.7, -4, 1.8, 0.5, 1.2, ink);
    sign("Reception", -6, 4.4, -9.7, 8, 1.4, ink, "#f6d79a");
    object(
      "Guest book",
      "Bea keeps the guest book open. Today's arrivals are simulated HTTP and SSH connections.",
      -5,
      2.6,
      -4,
      5,
      1,
      3,
    );
    sofa(-7, 4);
    sofa(1, 4);
    table(-3, 5, 3, 2);
    cup(-3, 5);
    box(1, 2.1, -8, 4.2, 3.9, 1, ink);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 6; x++)
        box(-0.7 + x * 0.57, 0.65 + y * 0.82, -7.4, 0.4, 0.58, 0.15, brass);
    object(
      "Key rack",
      "Every key opens a demo room. The roof lounge is one floor up.",
      1,
      2.1,
      -8,
      4.5,
      4.3,
      1.5,
    );
  }
  const positions =
    style === "cafe" || style === "tea" || style === "ramen"
      ? [
          [-4, -6.9],
          [5, 5],
          [-8, 3],
          [1, -0.8],
        ]
      : style === "records"
        ? [
            [4, -7.5],
            [-7, 0],
            [-6, 5],
            [5, 5],
          ]
        : [
            [-5, -6.5],
            [-7, 3],
            [5, 4],
            [2, -2],
          ];
  const people = roomResidents(location).map((resident, i) => {
    const [x, z] = positions[i];
    const person = art.create(resident, root, x, 0.16, z);
    picks.push(person.sprite);
    return person;
  });
  // The same speech-bubble treatment follows a resident into a shop.
  art.bubble(
    people[0].resident.phrase,
    root,
    positions[0][0],
    3.85,
    positions[0][1],
  );
  geo.finish();
  root.add(geo.root);
  return {
    root,
    geometry: geo,
    picks,
    people,
    record,
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
