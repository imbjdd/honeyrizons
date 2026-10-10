import * as THREE from "three";
import type { CityGeometry } from "./geometry";
import type { Building, RoomStyle } from "./explore";

export interface RoomKit {
  building: Building;
  box: CityGeometry["box"];
  prop: CityGeometry["prop"];
  sign: CityGeometry["sign"];
  solid: (x: number, z: number, w: number, d: number) => void;
  object: (
    title: string,
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    action?: "coffee" | "record" | "water",
  ) => void;
  table: (x: number, z: number, w?: number, d?: number) => void;
  stool: (x: number, z: number, color?: string) => void;
  plant: (x: number, z: number, size?: number) => void;
  shelf: (x: number, z: number, w?: number, books?: boolean) => void;
  sofa: (x: number, z: number) => void;
  mesh: (
    geometry: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    glow?: boolean,
  ) => THREE.Mesh;
}

/** Each case is an authored floor plan. Furniture helpers never choose a layout. */
export function furnishRoom(style: RoomStyle, kit: RoomKit) {
  const {
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
    mesh,
    building,
  } = kit;
  const c = building.color,
    white = "#edf6ff",
    ink = "#172f50",
    steel = "#6685a4",
    cyan = "#00dcff",
    pink = "#ff319c";
  const animated: ((time: number) => void)[] = [];
  let record: THREE.Mesh | null = null;
  function ring(
    x: number,
    y: number,
    z: number,
    r: number,
    color = c,
    vertical = false,
  ) {
    const m = mesh(
      new THREE.TorusGeometry(r, 0.12, 6, 48),
      color,
      x,
      y,
      z,
      true,
    );
    if (!vertical) m.rotation.x = Math.PI / 2;
    return m;
  }
  function counter(x: number, z: number, w: number, d: number, color = c) {
    solid(x, z, w, d);
    box(x, 1.05, z, w, 1.9, d, color);
    box(x, 2.05, z, w + 0.1, 0.18, d + 0.1, white);
    box(x, 0.26, z + d / 2 + 0.06, w, 0.12, 0.08, cyan, 0, true);
  }
  function console(x: number, z: number, label: string, color = cyan, w = 2.3) {
    counter(x, z, w, 1.25, ink);
    box(x, 2.7, z - 0.2, w - 0.2, 1.3, 0.15, steel);
    sign(label, x, 2.72, z - 0.1, w - 0.38, 1.1, ink, color);
    box(x, 2.19, z + 0.3, w - 0.4, 0.08, 0.5, color);
  }
  function arch(x: number, z: number, w: number, h: number, color = c) {
    for (const dx of [-w / 2, w / 2])
      box(x + dx, h / 2, z, 0.22, h, 0.35, color, 0, true);
    box(x, h, z, w, 0.22, 0.35, color, 0, true);
  }
  function display(x: number, z: number, color = c, size = 1) {
    solid(x, z, 1.6 * size, 1.6 * size);
    prop("cylinder", x, 0.6, z, 1.6 * size, 1.1, 1.6 * size, white);
    const art = mesh(
      new THREE.OctahedronGeometry(0.8 * size),
      color,
      x,
      2.5,
      z,
      true,
    );
    animated.push((t) => {
      art.rotation.y = t * 0.3;
    });
    object(
      "Color study",
      `A light sculpture from ${building.name}.`,
      x,
      2.4,
      z,
      1.6 * size,
      3,
      1.6 * size,
    );
  }
  function chairRow(xs: number[], z: number, color = c) {
    for (const x of xs) {
      stool(x, z, color);
      box(x, 1.85, z + 0.43, 1.15, 1.2, 0.2, color);
    }
  }
  function robot(x: number, z: number, size = 1) {
    solid(x, z, 1.2 * size, 1.2 * size);
    prop("cylinder", x, 0.3, z, 1.3 * size, 0.5, 1.3 * size, ink);
    box(x, 1.3 * size, z, 1.1 * size, 1.8 * size, 0.95 * size, c);
    box(x, 2.5 * size, z, 1.4 * size, 0.95 * size, 1 * size, white);
    box(x, 2.55 * size, z + 0.52 * size, 1.15 * size, 0.5 * size, 0.1, ink);
    for (const dx of [-0.32, 0.32])
      box(
        x + dx * size,
        2.55 * size,
        z + 0.59 * size,
        0.24 * size,
        0.25 * size,
        0.05,
        cyan,
        0,
        true,
      );
    object(
      "Courier bot",
      "This little courier is charging between deliveries.",
      x,
      1.5,
      z,
      1.8 * size,
      3.3 * size,
      1.6 * size,
    );
  }
  function monitorWall(text: string, color = c) {
    sign(text, -3, 4.6, -9.55, 12, 2.2, ink, color);
  }
  function bench(x: number, z: number, w = 4, color = c) {
    solid(x, z, w, 1.15);
    box(x, 0.85, z, w, 1.1, 1.15, color);
    box(x, 1.75, z + 0.46, w, 1, 0.2, color);
  }

  switch (style) {
    case "arrival": {
      counter(-6, -3, 8, 2.3);
      console(-6, -3, "Welcome / Honey Tower");
      const cells = mesh(
        new THREE.TorusGeometry(2.1, 0.45, 6, 6),
        c,
        0,
        3.9,
        -2,
        true,
      );
      animated.push((t) => {
        cells.rotation.y = t * 0.17;
      });
      solid(0, -2, 3.8, 3.8);
      prop("cylinder", 0, 0.4, -2, 3.8, 0.5, 3.8, white);
      ring(0, 0.72, -2, 2, cyan);
      sofa(-7, 4);
      table(-6, 1, 3, 1.6);
      display(3, -7, c, 0.8);
      object(
        "Visitor desk",
        "Sign the local guest book. The city command floor is upstairs.",
        -6,
        2,
        -3,
        8.2,
        3,
        2.5,
      );
      break;
    }
    case "command": {
      for (const [x, z] of [
        [-9, -5],
        [-5, -6],
        [-1, -5],
        [3, -3],
      ] as const)
        console(x, z, "HNY / session open", cyan, 2.7);
      solid(-4, 1, 7, 4);
      box(-4, 1.1, 1, 7, 1.8, 4, ink);
      box(-4, 2.05, 1, 7, 0.14, 4, cyan, 0, true);
      for (let i = 0; i < 15; i++)
        box(
          -6.7 + (i % 5) * 1.3,
          2.5 + (i % 4) * 0.2,
          -0.3 + Math.floor(i / 5) * 1.2,
          0.5,
          0.5 + (i % 4) * 0.4,
          0.6,
          [c, pink, cyan][i % 3],
          0,
          true,
        );
      monitorWall("City command / local demo", cyan);
      chairRow([-8, -4, 0], 5);
      object(
        "City model",
        "A tabletop model of the district. The terminals use local demo sessions.",
        -4,
        2.5,
        1,
        7.2,
        3,
        4.2,
      );
      break;
    }
    case "skydeck": {
      for (const z of [-7, -3, 1]) {
        arch(-4, z, 14, 6.2, c);
        box(-4, 6.2, z, 14, 0.22, 1, white);
      }
      display(-5, -5, c, 1.7);
      bench(-10, 3, 3);
      bench(2, 3, 3);
      table(-5, 4, 4, 1.8);
      stool(-5, 6);
      plant(3, -7, 1.4);
      object(
        "Observation ring",
        "Honey Tower's crown catches the last sunlight before the street lamps come on.",
        -5,
        3,
        -5,
        4,
        5,
        4,
      );
      break;
    }
    case "espresso": {
      solid(-4, -2, 6, 6);
      prop("cylinder", -4, 1, -2, 6, 1.8, 6, c);
      prop("cylinder", -4, 2, -2, 6.3, 0.18, 6.3, white);
      ring(-4, 2.2, -2, 2.7, c);
      box(-4, 2.7, -2.4, 2.9, 1.2, 1.2, steel);
      for (const x of [-4.7, -3.3]) {
        prop("cylinder", x, 2.38, -1.5, 0.28, 0.35, 0.28, white);
        box(x, 2.75, -1.86, 0.12, 0.65, 0.1, ink);
      }
      for (const [x, z] of [
        [-10, 3],
        [1, 1],
        [1, 5],
      ] as const) {
        table(x, z, 2.6, 2);
        stool(x - 1.5, z);
        stool(x + 1.5, z);
      }
      bench(-9, -7, 5, c);
      monitorWall("Espresso / 3    Honey toast / 4");
      object(
        "Coffee machine",
        "Mika makes a flat white with a spoon of honey. Order one here.",
        -4,
        2.7,
        -2,
        3.4,
        1.8,
        2,
        "coffee",
      );
      break;
    }
    case "atelier": {
      for (const [x, z] of [
        [-9, -5],
        [-4, -5],
        [1, -5],
      ] as const) {
        solid(x, z, 2.2, 1.4);
        box(x, 1.6, z, 0.15, 3.2, 0.15, steel);
        box(x, 2.9, z, 2.2, 2.2, 0.12, white);
        sign(
          "City sketch",
          x,
          2.9,
          z + 0.08,
          1.9,
          1.7,
          ["#29c8ff", "#ffac28", "#ed44a6"][Math.round((x + 9) / 5)],
          white,
        );
        box(x, 1.6, z + 0.1, 2.2, 0.12, 0.5, c);
      }
      table(-5, 2, 9, 2.5);
      for (let i = 0; i < 8; i++)
        box(-8 + i, 1.73, 2, 0.16, 0.18, 0.8, [pink, cyan, c][i % 3]);
      chairRow([-8, -4, 0], 4);
      shelf(-11, -8, 2, false);
      object(
        "Sketch table",
        "Lou keeps drawing the maglev. Pick a color and leave a sketch.",
        -5,
        1.8,
        2,
        9,
        2.5,
        3,
      );
      break;
    }
    case "hotel": {
      counter(-8, -4, 6, 2, c);
      sign("Check in", -8, 2.6, -3, 4, 0.7, ink, c);
      for (let i = 0; i < 5; i++) {
        counter(-2 + i * 1.5, -8, 1.2, 1.2, ink);
        box(-2 + i * 1.5, 2.8, -8, 0.75, 1.3, 0.8, c);
      }
      sofa(-7, 3);
      sofa(1, 3);
      table(-3, 4, 3, 1.5);
      arch(-4, -7, 13, 6, white);
      for (const x of [-11, 4]) plant(x, 6, 1.2);
      object(
        "Luggage pods",
        "Guests leave their bags in these numbered luggage pods. The infinity lounge is upstairs.",
        1,
        2,
        -8,
        6,
        3,
        1.5,
      );
      break;
    }
    case "pool": {
      solid(-4, -1, 8, 8);
      box(-4, 0.18, -1, 8, 0.5, 8, white);
      box(-4, 0.51, -1, 7.3, 0.12, 7.3, "#00a8f5", 0, true);
      for (const z of [-4, -1, 2])
        box(-4, 0.6, z, 6.7, 0.035, 0.08, cyan, 0, true);
      for (const [x, z] of [
        [-10, 1],
        [2, 1],
        [-7, 6],
        [1, 6],
      ] as const) {
        bench(x, z, 2.4, c);
        arch(x, z, 2.4, 4.5, white);
      }
      plant(-11, -7, 1.3);
      plant(3, -7, 1.3);
      monitorWall("Infinity lounge / take a seat", c);
      object(
        "Infinity pool",
        "The pool reflects the daylight panels. Walk around its edge to reach the cabanas.",
        -4,
        0.7,
        -1,
        8,
        1.5,
        8,
      );
      break;
    }
    case "vinyl": {
      for (const [x, z] of [
        [-9, -3],
        [-3, -3],
        [3, -3],
        [-9, 2],
        [-3, 2],
      ] as const) {
        counter(x, z, 3.4, 2, ink);
        for (let i = 0; i < 6; i++)
          box(
            x - 1.3 + i * 0.5,
            2.42,
            z,
            0.3,
            0.7,
            1.6,
            [c, cyan, "#ffdc24"][i % 3],
          );
      }
      const disc = mesh(
        new THREE.TorusGeometry(2.4, 0.4, 8, 40),
        ink,
        -4,
        4,
        -8,
        true,
      );
      disc.rotation.x = 0;
      ring(-4, 4, -7.94, 0.8, c, true);
      table(2, 5, 4, 2);
      record = mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 0.06, 40),
        ink,
        2,
        1.88,
        5,
      );
      prop("cylinder", 2, 1.92, 5, 0.35, 0.08, 0.35, c);
      object(
        "Turntable",
        "Jun left a city jazz record on the platter. Put it on.",
        2,
        2,
        5,
        4,
        1.6,
        2.5,
        "record",
      );
      break;
    }
    case "sound": {
      solid(-4, -6, 12, 3);
      box(-4, 0.35, -6, 12, 0.55, 3, ink);
      console(-4, -6, "Side A / live", c, 5);
      for (const x of [-10, 2]) {
        solid(x, -6, 1.5, 1.5);
        box(x, 2.5, -6, 1.5, 4.8, 1.5, ink);
        for (const y of [1.5, 3.3]) ring(x, y, -5.23, 0.48, c, true);
      }
      for (let x = -9; x <= 2; x += 1.4)
        for (let z = -2; z < 6; z += 1.4)
          box(
            x,
            0.12,
            z,
            1.35,
            0.1,
            1.35,
            Math.round((x + 9) / 1.4 + z / 1.4) % 2 ? c : ink,
            0,
            true,
          );
      bench(-11, 4, 1.6);
      monitorWall("Side A / listening after dark", c);
      record = mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.05, 32),
        ink,
        -4,
        2.25,
        -5.6,
      );
      object(
        "DJ deck",
        "A long mix for the evening city. Start the record and take the floor.",
        -4,
        2.5,
        -6,
        5,
        3,
        1.8,
        "record",
      );
      break;
    }
    case "archive": {
      for (const x of [-10, -6, -2, 2]) {
        solid(x, -6, 1.5, 1.8);
        box(x, 3, -6, 1.3, 5.7, 1.6, ink);
        for (let y = 0.6; y < 5.5; y += 0.45)
          box(x, y, -5.17, 1.15, 0.15, 0.1, c, 0, true);
      }
      table(-5, 1, 7, 3);
      chairRow([-7, -3], 3.3);
      display(2, 5, cyan);
      shelf(-11, 3, 1.5);
      object(
        "Memory columns",
        "The violet columns store neighborhood sketches and local demo connection records.",
        -6,
        3,
        -6,
        2,
        5.8,
        2,
      );
      break;
    }
    case "servers": {
      for (const x of [-10, -6, 1])
        for (const z of [-6, -1, 4]) {
          solid(x, z, 2.1, 2.4);
          box(x, 3, z, 2.1, 5.5, 2.4, ink);
          box(x, 3, z + 1.23, 1.8, 5.1, 0.08, "#265785");
          for (let y = 0.8; y < 5.5; y += 0.5) {
            box(x, y, z + 1.3, 1.65, 0.08, 0.04, steel);
            box(x + 0.55, y + 0.14, z + 1.32, 0.1, 0.1, 0.04, cyan, 0, true);
          }
        }
      console(-3, 6, "Cold storage / nominal", c, 3.6);
      monitorWall("Memory vault / aisle 7", cyan);
      object(
        "Server vault",
        "Each rack has its own ventilation and a blue status light. The city uses local fixtures today.",
        -6,
        2,
        -1,
        2.3,
        5.8,
        2.6,
      );
      break;
    }
    case "tea": {
      for (const [x, z] of [
        [-8, -3],
        [-2, 0],
        [-8, 4],
      ] as const) {
        solid(x, z, 3, 2.4);
        box(x, 0.65, z, 3, 0.18, 2.4, white);
        for (const dx of [-1.8, 1.8])
          prop("cylinder", x + dx, 0.32, z, 1, 0.45, 1, c);
        prop("cylinder", x, 0.92, z, 0.65, 0.4, 0.65, ink);
      }
      counter(2, -6, 4, 2, c);
      for (let i = 0; i < 6; i++) box(-12, 3, -7 + i * 2.8, 0.15, 6, 0.6, c);
      solid(-9, -8, 5, 1.6);
      box(-9, 0.2, -8, 5, 0.3, 1.6, steel);
      for (let i = 0; i < 6; i++)
        prop("leaf", -11 + i * 0.8, 0.6, -8, 0.5, 0.3, 0.6, white);
      object(
        "Tea service",
        "Nori serves roasted green tea at the pavilion's low tables.",
        2,
        2,
        -6,
        4.3,
        2.8,
        2.3,
        "coffee",
      );
      break;
    }
    case "zen": {
      solid(-5, -2, 8, 5.5);
      box(-5, 0.16, -2, 8, 0.25, 5.5, "#176c8a");
      for (let i = 0; i < 5; i++)
        prop(
          "cylinder",
          -8 + i * 1.5,
          0.4,
          -2 + (i % 2) * 1.1,
          1,
          0.3,
          1,
          white,
        );
      for (const [x, z] of [
        [-10, -7],
        [2, -6],
        [-10, 5],
      ] as const)
        for (let i = 0; i < 4; i++) {
          box(x + i * 0.4, 2.9, z, 0.08, 5.6, 0.08, c);
          prop("leaf", x + i * 0.4, 4.6, z, 0.7, 1, 0.4, c);
        }
      bench(-4, 5, 5, c);
      ring(-5, 4, -7.5, 2.2, c, true);
      object(
        "Reflecting pool",
        "Bamboo leaves hang over the shallow pool. The stones are decorative; take the dry path around it.",
        -5,
        0.6,
        -2,
        8,
        1.2,
        5.5,
      );
      break;
    }
    case "hydroponics": {
      for (const x of [-10, -5, 1])
        for (const z of [-6, 0]) {
          solid(x, z, 2.3, 2.3);
          prop("cylinder", x, 2.5, z, 1.1, 4.8, 1.1, white);
          for (let y = 1; y < 5; y += 0.8)
            for (let n = 0; n < 4; n++) {
              const a = (n * Math.PI) / 2;
              prop(
                "leaf",
                x + Math.cos(a) * 0.7,
                y,
                z + Math.sin(a) * 0.7,
                0.65,
                0.55,
                0.65,
                c,
              );
            }
          ring(x, 5.5, z, 1.4, pink);
        }
      table(-5, 5, 8, 2);
      for (let i = 0; i < 6; i++)
        prop("cylinder", -8 + i, 1.9, 5, 0.6, 0.6, 0.6, c);
      object(
        "Seedling bench",
        "The seedlings need water. Sora left a can beneath the bench.",
        -5,
        2,
        5,
        8,
        2.8,
        2.2,
        "water",
      );
      break;
    }
    case "orchard": {
      for (const [x, z] of [
        [-9, -6],
        [-3, -6],
        [3, -5],
        [-10, 1],
      ] as const) {
        plant(x, z, 1.5);
        for (let i = 0; i < 4; i++)
          prop(
            "leaf",
            x + Math.cos(i * 2.4),
            2.9 + i * 0.2,
            z + Math.sin(i * 2.4),
            0.4,
            0.4,
            0.4,
            "#ffc62a",
          );
      }
      counter(-4, 1, 5, 2, white);
      shelf(-10, 6, 4, false);
      table(2, 4, 3, 2);
      stool(2, 6);
      arch(-4, -6, 13, 6, c);
      object(
        "Citrus station",
        "The rooftop fruit trees need a little water each morning.",
        -4,
        2,
        1,
        5,
        3,
        2.2,
        "water",
      );
      break;
    }
    case "ramen": {
      counter(-4, -4, 12, 2, c);
      counter(-10, -0.5, 2, 5, c);
      counter(2, -0.5, 2, 5, c);
      for (const x of [-8, -5, -2, 1]) {
        stool(x, -1.8, c);
        prop("cylinder", x, 2.25, -3.6, 0.55, 0.25, 0.55, white);
      }
      for (const x of [-7, -2]) {
        prop("cylinder", x, 2.8, -7, 1.6, 0.8, 1.6, steel);
        box(x, 1.8, -7, 2, 2, 2, ink);
      }
      for (let x = -10; x < 5; x += 2.2)
        prop("cylinder", x, 5.8, -4, 0.75, 0.75, 0.75, c, 0, true);
      monitorWall("Midnight broth / open all night", c);
      object(
        "Noodle counter",
        "Otto keeps the broth going through the city's entire night cycle.",
        -4,
        2,
        -4,
        12,
        2.6,
        2.1,
        "coffee",
      );
      break;
    }
    case "books": {
      for (const [x, z, w] of [
        [-9, -7, 5],
        [-3, -7, 5],
        [-9, -1, 5],
        [-2, 2, 5],
      ] as const)
        shelf(x, z, w);
      bench(-9, 4, 4);
      table(2, -3, 3, 2.3);
      stool(2, -0.8);
      display(2, 5, c);
      sign("Leave a book / take a book", -4, 4.7, -9.6, 10, 1, ink, c);
      object(
        "Book exchange",
        "A shelf of secondhand paperbacks. Ada says the margins are half the story.",
        -9,
        2,
        -1,
        5.3,
        5,
        1.5,
      );
      break;
    }
    case "arcade": {
      for (const x of [-10, -6, -2, 2]) {
        solid(x, -6, 2.5, 2);
        box(x, 1, -6, 2.4, 1.8, 2, ink);
        box(x, 3, -6.45, 2.4, 2.4, 1.2, c);
        sign("PLAY / 2086", x, 3, -5.8, 2.1, 1.7, ink, cyan);
        box(x, 2, -5.3, 2.4, 0.2, 1, white);
        for (const dx of [-0.5, 0.5])
          prop(
            "cylinder",
            x + dx,
            2.24,
            -5.2,
            0.23,
            0.2,
            0.23,
            [cyan, c][dx < 0 ? 0 : 1],
          );
      }
      for (const x of [-8, 0]) {
        counter(x, 1, 3, 2, ink);
        stool(x, 3, c);
        ring(x, 2.6, 0.5, 0.6, cyan, true);
      }
      for (let x = -5; x < 1; x += 1.5)
        for (let z = 4; z < 7; z += 1.5)
          box(x, 0.15, z, 1.4, 0.18, 1.4, (x + z) % 3 ? c : cyan, 0, true);
      object(
        "Rhythm pad",
        "Step around the illuminated tiles. Zed keeps the scoreboard above the cabinets.",
        -2,
        0.3,
        5.5,
        6,
        1,
        3,
      );
      break;
    }
    case "esports": {
      for (const x of [-9, -5, -1, 3]) {
        console(x, -4, "Team cyan", cyan, 2.5);
        console(x, 2, "Team pink", pink, 2.5);
        stool(x, -1.5, c);
        stool(x, 4.5, c);
      }
      monitorWall("Pixel Palace / tournament board", c);
      arch(-3, -7, 17, 5.6, c);
      object(
        "Match board",
        "Two teams face each other across the tournament aisle. No account needed for the demo.",
        -3,
        4.5,
        -9.4,
        12,
        2.6,
        0.5,
      );
      break;
    }
    case "assembly": {
      solid(-4, -1, 11, 2.4);
      box(-4, 1.2, -1, 11, 2.2, 2.4, steel);
      box(-4, 2.4, -1, 11, 0.15, 2.4, ink);
      for (let i = 0; i < 12; i++)
        box(-9 + i * 0.9, 2.51, -1, 0.6, 0.09, 2.1, c);
      for (const x of [-9, -4, 1]) {
        solid(x, -5, 1.8, 2);
        box(x, 1.5, -5, 1.5, 2.8, 1.5, c);
        box(x, 3, -4.2, 0.55, 0.6, 3, white);
        box(x, 2.65, -2.85, 0.5, 1.3, 0.5, c);
      }
      robot(-9, 4);
      robot(-4, 4);
      console(2, 5, "Assembly / ready", cyan);
      monitorWall("Bot Works / courier line", c);
      object(
        "Assembly conveyor",
        "Orange arms fit wheels and parcel trays to the little courier bots.",
        -4,
        2.5,
        -1,
        11,
        2.5,
        2.5,
      );
      break;
    }
    case "robotlab": {
      for (const x of [-10, -6, -2, 2]) {
        prop("cylinder", x, 0.2, -6, 2.4, 0.3, 2.4, ink);
        ring(x, 0.5, -6, 1.2, cyan);
        robot(x, -6, 0.7);
      }
      for (const z of [-1, 4]) box(-4, 0.15, z, 12, 0.05, 0.18, c, 0, true);
      for (const x of [-10, 2]) box(x, 0.15, 1.5, 0.18, 0.05, 5, c, 0, true);
      table(-4, 1.5, 3, 2);
      robot(-4, 1.5, 0.5);
      console(-10, 6, "Test track", c);
      object(
        "Bot test track",
        "A clear loop teaches new couriers how to turn without losing a parcel.",
        -4,
        0.3,
        4,
        12,
        1,
        0.6,
      );
      break;
    }
    case "aquarium": {
      solid(-4, -2, 6.7, 6.7);
      prop("cylinder", -4, 2.4, -2, 6.5, 4.6, 6.5, "#007dbe", 0, true);
      for (const y of [0.25, 4.8])
        prop("cylinder", -4, y, -2, 6.9, 0.22, 6.9, white);
      ring(-4, 4.95, -2, 3.3, cyan);
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        const fish = mesh(
          new THREE.OctahedronGeometry(0.22),
          ["#ffbc25", pink, cyan][i % 3],
          -4 + Math.cos(a) * 3.35,
          1.1 + (i % 4) * 0.7,
          -2 + Math.sin(a) * 3.35,
          true,
        );
        animated.push((t) => {
          fish.position.x = -4 + Math.cos(a + t * 0.23) * 3.35;
          fish.position.z = -2 + Math.sin(a + t * 0.23) * 3.35;
          fish.rotation.y = -a - t * 0.23;
        });
      }
      for (const x of [-10, 2]) {
        counter(x, 4, 2.8, 2.8, white);
        box(x, 2.3, 4, 2.4, 0.4, 2.4, cyan, 0, true);
        prop("leaf", x, 2.8, 4, 1.3, 1.2, 1.3, pink);
      }
      object(
        "Ocean cylinder",
        "Coral keeps a small school of bright fish in this huge blue tank.",
        -4,
        2.5,
        -2,
        7,
        5,
        7,
      );
      break;
    }
    case "oceanlab": {
      for (const x of [-10, -5, 0]) {
        counter(x, -5, 3.4, 2.8, white);
        prop("cylinder", x, 2.7, -5, 2.4, 1.2, 2.4, "#00bde5", 0, true);
        prop("leaf", x, 3.3, -5, 0.8, 1.2, 0.8, c);
      }
      table(-6, 2, 8, 3);
      for (const x of [-9, -5, -2]) {
        box(x, 2.4, 2, 0.6, 1.4, 0.6, ink);
        box(x + 0.2, 3, 2, 0.9, 0.25, 0.4, steel);
        stool(x, 4.4, c);
      }
      console(3, 4, "Marine samples", cyan);
      monitorWall("Marine lab / samples 12-18", cyan);
      object(
        "Microscope bench",
        "Small coral samples sit beside each microscope. The keeper records their colors every day.",
        -6,
        2.5,
        2,
        8,
        3,
        3.2,
      );
      break;
    }
    case "concourse": {
      for (const x of [-10, -6, -2, 2]) {
        counter(x, -4, 1.1, 2.7, steel);
        box(x + 0.6, 1.7, -3.4, 1.3, 0.15, 0.2, c, 0, true);
      }
      console(-10, 2, "Tickets / city loop", c);
      bench(-4, 5, 5, c);
      bench(3, 5, 3, c);
      sign(
        "City loop / every 2 min\nNext departure  /  platform 8",
        -4,
        4.6,
        -8.8,
        14,
        2.5,
        ink,
        c,
      );
      for (let i = 0; i < 7; i++)
        box(-10 + i * 2, 5.8, -2, 0.12, 0.12, 14, white);
      object(
        "Ticket gates",
        "The maglev circles the waterfront. Every building in the city is open to explore.",
        -4,
        1.5,
        -4,
        12,
        3,
        3,
      );
      break;
    }
    case "dispatch": {
      sign(
        "Skyport ---- Honey ---- Archive\n       |           |          |\nCentral ---- Palace ---- Gardens",
        -4,
        3.9,
        -9.5,
        16,
        3.5,
        ink,
        cyan,
      );
      for (const x of [-9, -4, 1]) console(x, -3, "Line 8 / clear", c, 3);
      chairRow([-9, -4, 1], 0);
      table(-5, 5, 7, 2);
      for (let i = 0; i < 5; i++) box(-7 + i, 1.72, 5, 0.6, 0.15, 1, cyan);
      object(
        "Route board",
        "Rail tracks two maglev trains across the waterfront. The board marks the main stops.",
        -4,
        3.7,
        -9.4,
        16,
        4,
        0.5,
      );
      break;
    }
    case "cinema": {
      sign(
        "AFTERGLOW\nA film above the rooftops",
        -4,
        4,
        -9.5,
        16,
        3.7,
        "#163e73",
        c,
      );
      for (let row = 0; row < 4; row++)
        for (const x of [-10, -7, -3, 0, 3]) {
          const z = -5 + row * 3;
          solid(x, z, 1.65, 1.7);
          box(x, 0.6 + row * 0.12, z, 1.5, 1, 1.5, c);
          box(x, 1.8 + row * 0.12, z + 0.65, 1.5, 1.8, 0.25, c);
        }
      for (const z of [-5, -2, 1, 4])
        box(-5, 0.14, z, 0.08, 0.03, 1.8, cyan, 0, true);
      object(
        "Screen one",
        "A quiet aerial film runs over the city. The center aisle leads to the screen.",
        -4,
        4,
        -9.2,
        16,
        4,
        0.5,
      );
      break;
    }
    case "projection": {
      for (const x of [-8, 0]) {
        table(x, -2, 4, 3);
        box(x, 2.3, -2, 2.9, 1.6, 1.8, steel);
        prop("cylinder", x, 3.5, -2, 1.6, 0.3, 1.6, ink);
        ring(x, 3.5, -1.04, 0.6, c, true);
      }
      shelf(-10, -8, 4, false);
      bench(-5, 5, 7, c);
      sign(
        "Projection booth / film in progress",
        -3,
        4.8,
        -9.5,
        13,
        1.4,
        ink,
        c,
      );
      object(
        "Projector",
        "Flick keeps two projectors here, so the show can run while one is serviced.",
        -8,
        2.5,
        -2,
        4,
        3,
        3,
      );
      break;
    }
    case "runway": {
      solid(-4, 0, 2.5, 12);
      box(-4, 0.4, 0, 2.5, 0.6, 12, c);
      for (const dx of [-1.35, 1.35])
        box(-4 + dx, 0.75, 0, 0.08, 0.12, 12, cyan, 0, true);
      for (const x of [-10, 2])
        for (const z of [-5, 1, 6]) {
          display(x, z, [c, cyan, "#ffc726"][Math.abs(z) % 3], 0.9);
        }
      arch(-4, -7, 5, 5.7, c);
      sign("Prism / collection 2086", -4, 4.6, -9.5, 13, 1.5, ink, c);
      object(
        "Prism runway",
        "A raised pink runway separates the current color studies. Walk along either side.",
        -4,
        0.7,
        0,
        2.7,
        1.3,
        12,
      );
      break;
    }
    case "wardrobe": {
      for (const x of [-10, -5, 0]) {
        counter(x, -6, 3.2, 1.5, white);
        for (let i = 0; i < 4; i++)
          prop(
            "cylinder",
            x - 1 + i * 0.65,
            2.7,
            -6,
            0.55,
            1.4,
            0.55,
            [c, cyan, "#ffd526", "#a650ff"][i],
          );
      }
      for (const x of [-8, 0]) {
        table(x, 1, 4, 2.5);
        box(x, 2.2, 1, 1.6, 0.8, 0.9, steel);
        stool(x, 3.4, c);
      }
      for (const x of [-10, -5, 0]) arch(x, 6, 2.6, 4.3, c);
      object(
        "Fabric library",
        "Prism arranges fabric rolls by light temperature instead of season.",
        -5,
        2.7,
        -6,
        3.3,
        3,
        1.8,
      );
      break;
    }
    case "fabrication": {
      for (const x of [-9, -3, 3]) {
        counter(x, -5, 3.7, 3, ink);
        arch(x, -5, 3, 5, white);
        box(x, 3.7, -5.9, 2.6, 2.8, 0.12, "#246486");
        box(x, 2.6, -5, 1.6, 0.65, 1.3, c);
      }
      table(-5, 2, 8, 3);
      for (let i = 0; i < 6; i++)
        box(-8 + i * 1.2, 1.8, 2, 0.7, 0.3, 0.6, [c, pink, cyan][i % 3]);
      stool(-5, 4.8, c);
      object(
        "Fabrication bench",
        "Chip prints small replacement parts and assembles them at this bench.",
        -5,
        2,
        2,
        8,
        2.5,
        3,
      );
      break;
    }
    case "print": {
      counter(-6, -2, 7, 3, steel);
      box(-6, 2.9, -2, 5, 0.18, 2.2, c);
      box(-6, 2.3, -2, 0.25, 1.5, 2, ink);
      for (let i = 0; i < 5; i++) {
        solid(-10 + i * 3, -7, 2.4, 1);
        sign(
          ["HNY", "MOVE", "2086", "PLAY", "CITY"][i],
          -10 + i * 3,
          3.4,
          -7,
          2.2,
          3,
          [pink, cyan, c, "#9955ff", ink][i],
          white,
        );
      }
      table(-5, 4, 8, 2);
      for (let i = 0; i < 4; i++)
        prop(
          "cylinder",
          -8 + i * 2,
          1.9,
          4,
          0.7,
          0.55,
          0.7,
          [pink, cyan, c, ink][i],
        );
      object(
        "Printing press",
        "Fresh city posters dry along the back wall. The press leaves one color at a time.",
        -6,
        2.5,
        -2,
        7,
        3,
        3,
      );
      break;
    }
    case "clinic": {
      for (const x of [-9, -3, 3]) {
        solid(x, -4, 3, 4);
        box(x, 1, -4, 2.8, 1.3, 3.8, white);
        box(x, 1.8, -5, 2.5, 0.3, 1.6, c);
        arch(x, -4, 3.2, 5, c);
      }
      console(-9, 4, "Pulse / welcome", c, 4);
      bench(-2, 4, 5, c);
      plant(4, 6, 1.2);
      object(
        "Scan pod",
        "The pod runs a harmless light sequence. Pulse can explain the room.",
        -3,
        2,
        -4,
        3.2,
        4.5,
        4.2,
      );
      break;
    }
    case "recovery": {
      for (const [x, z] of [
        [-9, -4],
        [-3, -4],
        [3, -4],
        [-9, 2],
        [-3, 2],
      ] as const) {
        bench(x, z, 2.8, c);
        box(x, 0.65, z + 1.2, 2.8, 0.7, 1.4, white);
      }
      for (const x of [-10, -6, -2, 2]) plant(x, -8, 1.1);
      arch(-4, 1, 16, 6, white);
      table(3, 4, 2, 2);
      object(
        "Daylight garden",
        "Take a seat beneath the daylight canopy. The planters soften the recovery room.",
        -6,
        2,
        -8,
        8,
        3,
        2,
      );
      break;
    }
    case "planetarium": {
      const dome = mesh(
        new THREE.SphereGeometry(12, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2),
        "#162852",
        -4,
        2.75,
        -2,
      );
      dome.scale.y *= 0.3;
      (dome.material as THREE.MeshStandardMaterial).side = THREE.BackSide;
      for (let i = 0; i < 70; i++) {
        const a = i * 2.4,
          r = 1 + (i % 11);
        const height = 2.75 + Math.sqrt(144 - r * r) * 0.3 - 0.04;
        box(
          -4 + Math.cos(a) * r,
          height,
          -2 + Math.sin(a) * r,
          0.05,
          0.035,
          0.05,
          "#c6ddff",
          0,
          true,
        );
      }
      solid(-4, -2, 6.4, 6.4);
      prop("cylinder", -4, 0.4, -2, 6.3, 0.5, 6.3, ink);
      const sun = mesh(
        new THREE.SphereGeometry(0.9, 24, 16),
        "#ffd123",
        -4,
        3.5,
        -2,
        true,
      );
      animated.push((t) => {
        sun.rotation.y = t * 0.1;
      });
      for (let i = 0; i < 5; i++) {
        const r = 1.6 + i * 0.52;
        ring(-4, 3.5, -2, r, [cyan, c, pink][i % 3]);
        const planet = mesh(
          new THREE.SphereGeometry(0.17 + i * 0.05, 16, 12),
          [cyan, c, pink, "#65f144", "#ff7b32"][i],
          -4 + r,
          3.5,
          -2,
          true,
        );
        animated.push((t) => {
          planet.position.x = -4 + Math.cos(t * (0.5 - i * 0.06) + i) * r;
          planet.position.z = -2 + Math.sin(t * (0.5 - i * 0.06) + i) * r;
        });
      }
      for (const [x, z] of [
        [-10, -2],
        [2, -2],
        [-7, 5],
        [-1, 5],
      ] as const)
        bench(x, z, 2.8, c);
      monitorWall("Orbit / a small solar system", c);
      object(
        "Solar system",
        "Nova built a small moving model of the planets. The real distances would not fit in the building.",
        -4,
        3,
        -2,
        6.6,
        4.6,
        6.6,
      );
      break;
    }
    case "telescope": {
      solid(-4, -2, 4, 5);
      prop("cylinder", -4, 1, -2, 3.8, 1.8, 3.8, steel);
      const scope = mesh(
        new THREE.CylinderGeometry(0.8, 1.1, 5, 24),
        white,
        -4,
        3.8,
        -2,
      );
      scope.rotation.x = Math.PI / 3;
      ring(-4, 5.4, -3.8, 1.1, c, true);
      console(-10, 4, "Orbital view", c);
      console(2, 4, "Stellar chart", cyan);
      for (let i = 0; i < 5; i++)
        ring(-4, 0.12, -2, 2.5 + i * 0.8, i % 2 ? steel : c);
      object(
        "Main telescope",
        "The roof opens for evening observations. Nova knows where to look first.",
        -4,
        3,
        -2,
        4,
        5,
        5,
      );
      break;
    }
    case "hangar": {
      solid(-4, -2, 9, 7);
      prop("cylinder", -4, 0.2, -2, 9, 0.25, 9, ink);
      ring(-4, 0.45, -2, 4.4, c);
      box(-4, 1.8, -2, 5.5, 1.4, 2.2, white);
      box(-4, 2.7, -2, 2.7, 0.8, 1.7, cyan);
      box(-4, 1.6, -2, 1.7, 0.3, 8, c);
      for (const x of [-6, -2])
        for (const z of [-4, 0]) ring(x, 1.6, z, 0.8, c);
      console(-10, 5, "Courier 8 / docked", c);
      counter(2, 5, 3, 2, steel);
      monitorWall("Skyport 8 / keep pad clear", c);
      object(
        "Courier craft",
        "Aero's folding-wing courier carries parcels across the city.",
        -4,
        2,
        -2,
        9,
        3.5,
        7,
      );
      break;
    }
    case "flight": {
      for (const z of [-5, 1]) {
        bench(-8, z, 5, c);
        bench(0, z, 5, c);
      }
      for (const x of [-10, -4, 2]) console(x, 6, "Departure pod", c, 2.8);
      sign(
        "Departures\nCloud loop   08:30\nHarbor run   08:45",
        -4,
        4.2,
        -9.4,
        12,
        3.5,
        ink,
        cyan,
      );
      object(
        "Departure board",
        "The next courier leaves for the waterfront. Flights are local scenery in this demo.",
        -4,
        4,
        -9.2,
        12,
        4,
        0.5,
      );
      break;
    }
    case "gym": {
      for (const x of [-10, -5, 0]) {
        solid(x, -5, 1.8, 1.8);
        prop("cylinder", x, 3, -5, 1.25, 3.1, 1.25, c);
        box(x, 5.3, -5, 0.06, 1.8, 0.06, steel);
      }
      for (const x of [-9, -3, 3]) {
        arch(x, 3, 2.5, 4.8, steel);
        counter(x, 3, 2, 1.2, ink);
      }
      for (let i = 0; i < 16; i++)
        box(
          -12.8,
          1 + (i % 4) * 1.3,
          -7 + Math.floor(i / 4) * 3,
          0.25,
          0.3,
          0.4,
          [c, pink, cyan][i % 3],
        );
      object(
        "Training rig",
        "Dash keeps the center lane clear for warmups. The sprint circuit is upstairs.",
        -3,
        2,
        3,
        3,
        4.5,
        1.6,
      );
      break;
    }
    case "track": {
      for (let i = 0; i < 4; i++) {
        const w = 16 - i * 0.6,
          d = 13 - i * 0.6;
        for (const z of [-d / 2, d / 2])
          box(-4, 0.14, z, w, 0.05, 0.12, i % 2 ? white : c);
        for (const x of [-4 - w / 2, -4 + w / 2])
          box(x, 0.14, 0, 0.12, 0.05, d, i % 2 ? white : c);
      }
      table(-4, 0, 4, 3);
      for (const x of [-7, -1]) stool(x, 0, c);
      bench(-4, -8, 5, c);
      object(
        "Sprint circuit",
        "Four marked lanes circle the stretching deck. Take the outside lane for the longest lap.",
        -4,
        0.2,
        6,
        15,
        0.7,
        1,
      );
      break;
    }
    case "market": {
      for (const [x, z, color, label] of [
        [-10, -6, "#ff6a28", "Dumplings"],
        [-4, -6, "#80ee32", "Fruit"],
        [2, -6, "#ff36a4", "Mochi"],
        [-10, 1, "#00d3ff", "Juice"],
      ] as const) {
        counter(x, z, 4, 2, color);
        arch(x, z, 4.2, 5, color);
        sign(label, x, 4.6, z, 3.5, 0.8, ink, color);
        for (let i = 0; i < 5; i++)
          prop("leaf", x - 1.4 + i * 0.65, 2.35, z, 0.4, 0.3, 0.4, color);
      }
      table(-2, 3, 6, 2.4);
      chairRow([-4, 0], 5);
      monitorWall("Circuit Market / open late", c);
      object(
        "Market table",
        "Pep recommends the orange dumpling stall. Four cooks share this market hall.",
        -2,
        1.6,
        3,
        6.2,
        2,
        2.6,
      );
      break;
    }
    case "kitchen": {
      for (const [x, z] of [
        [-8, -4],
        [-1, -4],
        [-8, 3],
        [-1, 3],
      ] as const) {
        counter(x, z, 4.5, 3, steel);
        for (const dx of [-1, 1]) {
          prop("cylinder", x + dx, 2.2, z, 0.8, 0.08, 0.8, ink);
          prop("cylinder", x + dx, 2.45, z, 0.65, 0.4, 0.65, c);
        }
      }
      shelf(-9, -8, 5, false);
      shelf(-2, -8, 5, false);
      box(-4, 5.6, -4, 14, 0.8, 3, steel);
      object(
        "Test kitchen",
        "The upstairs cooks share induction stations and test tomorrow's market recipes.",
        -1,
        2.3,
        -4,
        4.6,
        2.8,
        3.2,
      );
      break;
    }
    case "apartment": {
      sofa(-8, 3);
      table(-8, 0, 3, 2);
      counter(-8, -7, 6, 2, white);
      console(-8, -7, "Home / kitchen", c, 2);
      solid(0, -3, 5, 6);
      box(0, 0.8, -3, 4.8, 1.1, 5.8, white);
      box(0, 1.45, -3, 4.5, 0.25, 5.5, c);
      box(0, 1.7, -5, 3.7, 0.45, 1, white);
      for (const z of [-6, -2, 2]) box(-3, 2.5, z, 0.12, 5, 0.7, c);
      shelf(-11, 6, 2, false);
      plant(3, 6, 1.3);
      object(
        "Living pod",
        "Hue left the apartment open for visitors. Blue screens separate the sleeping pod from the kitchen.",
        -8,
        1.4,
        3,
        4.7,
        2.7,
        2.1,
      );
      break;
    }
    case "common": {
      for (const x of [-10, -7, -4]) {
        solid(x, -7, 2.2, 1.4);
        box(x, 2.8, -7, 2.2, 5.3, 1.4, steel);
        for (let y = 0.7; y < 5; y += 1.05) {
          box(x, y, -6.26, 1.9, 0.85, 0.08, c);
          box(x + 0.6, y, -6.2, 0.12, 0.12, 0.05, cyan, 0, true);
        }
      }
      table(-6, 0, 6, 3);
      for (let i = 0; i < 8; i++)
        box(
          -8 + (i % 4) * 1.2,
          1.74,
          -0.6 + Math.floor(i / 4),
          0.3,
          0.1,
          0.3,
          i % 2 ? cyan : c,
        );
      sofa(1, 4);
      bench(-9, 5, 4, c);
      console(2, -6, "Parcel 2086", c);
      object(
        "Neighborhood game",
        "Someone left the game halfway through. Hue says the blue player is winning.",
        -6,
        1.8,
        0,
        6.2,
        2.5,
        3.2,
      );
      break;
    }
    case "reactor": {
      solid(-4, -2, 5.6, 5.6);
      prop("cylinder", -4, 2.6, -2, 2.5, 4.8, 2.5, c, 0, true);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        box(
          -4 + Math.cos(a) * 2.7,
          2.8,
          -2 + Math.sin(a) * 2.7,
          0.3,
          5.3,
          0.7,
          white,
          a,
        );
      }
      for (const y of [0.6, 2.8, 5.3]) ring(-4, y, -2, 2.8, cyan);
      console(-10, 4, "Output / 98%", c);
      console(2, 4, "Grid / stable", c);
      monitorWall("Solar Exchange / core gallery", c);
      object(
        "Power core",
        "Lux stores the city's daytime solar energy here. The street lamps draw from the core after sunset.",
        -4,
        2.6,
        -2,
        5.8,
        5.6,
        5.8,
      );
      break;
    }
    case "battery": {
      for (const x of [-10, -5, 0])
        for (const z of [-6, 0]) {
          solid(x, z, 2.8, 2);
          box(x, 2.5, z, 2.8, 4.8, 2, ink);
          for (let y = 1; y < 4.5; y += 1.1) {
            prop("cylinder", x, y, z, 1.7, 0.75, 1.7, c);
            box(x, y, z + 1.06, 1.8, 0.25, 0.06, cyan, 0, true);
          }
        }
      console(-5, 5, "Stored energy / city night", c, 6);
      monitorWall("Battery library / charge ready", c);
      object(
        "Battery cells",
        "Each colored cell stores charge for a different city block.",
        -5,
        2.5,
        -6,
        3,
        5,
        2.2,
      );
      break;
    }
    case "gallery": {
      for (const [x, z, color] of [
        [-10, -6, pink],
        [-4, -6, cyan],
        [2, -6, "#ffd126"],
      ] as const)
        display(x, z, color, 1.15);
      for (let i = 0; i < 6; i++)
        arch(
          -5,
          1 + i * 0.85,
          5.5,
          4.7,
          [pink, c, cyan, "#9748ff", "#ffcf24", "#4dffb4"][i],
        );
      bench(2, 4, 3, c);
      sign("Light / walk through", -4, 4.8, -9.5, 13, 1.3, ink, c);
      object(
        "Light tunnel",
        "Ray arranged the colored arches so each turn changes the overlap of light.",
        -5,
        2.6,
        3,
        6,
        5,
        5,
      );
      break;
    }
    default: {
      const exhaustive: never = style;
      throw new Error(`Missing room layout: ${exhaustive}`);
    }
  }
  return {
    record,
    update: (time: number) => animated.forEach((fn) => fn(time)),
  };
}
