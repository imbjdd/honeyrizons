import * as THREE from "three";
import { CityGeometry, movingMesh, seededRandom } from "./geometry";
import { districts } from "./model";
import { CharacterArt, type CitizenSprite } from "./characters";
import { buildings, residents, residentById, type Building } from "./explore";

export interface MovingActor {
  mesh: THREE.Object3D;
  axis: "x" | "z";
  lane: number;
  speed: number;
  offset: number;
  extent: number;
  height: number;
  pedestrian?: boolean;
  citizen?: CitizenSprite;
}
export interface CityWorld {
  geometry: CityGeometry;
  actors: MovingActor[];
  picks: THREE.Object3D[];
  people: CitizenSprite[];
  bubbles: { bubble: THREE.Sprite; person: CitizenSprite }[];
  art: CharacterArt;
  overlays: THREE.Mesh[];
  water: THREE.Mesh;
  beacon: THREE.Group;
  nightLights: THREE.PointLight[];
  nightProps: THREE.Group;
  dispose: () => void;
}

/** Every building is sourced from the same catalog as its entrance and rooms. */
export function buildWorld(scene: THREE.Group): CityWorld {
  const geo = new CityGeometry(),
    random = seededRandom(2086);
  const box = geo.box.bind(geo),
    prop = geo.prop.bind(geo),
    sign = geo.sign.bind(geo);
  const actors: MovingActor[] = [],
    picks: THREE.Object3D[] = [],
    people: CitizenSprite[] = [];
  const bubbles: CityWorld["bubbles"] = [],
    overlays: THREE.Mesh[] = [];
  const art = new CharacterArt(),
    nightProps = new THREE.Group();
  const extras: THREE.Mesh[] = [],
    nightLights: THREE.PointLight[] = [];
  const extraMaterials = new Set<THREE.Material>();
  const porcelain = "#eaf3ff",
    steel = "#385a7d",
    glass = "#16799f",
    dark = "#122e4b";
  for (const color of [glass, "#12486a", "#216c94", steel]) {
    const material = geo.material(color);
    material.roughness = 0.24;
    material.metalness = 0.45;
  }
  scene.add(nightProps);
  const pickMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  extraMaterials.add(pickMaterial);
  function mesh(
    geometry: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    glow = false,
  ) {
    const object = new THREE.Mesh(geometry, geo.material(color, glow));
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    scene.add(object);
    extras.push(object);
    return object;
  }
  function ring(
    x: number,
    y: number,
    z: number,
    radius: number,
    color: string,
    vertical = false,
    tube = 0.28,
  ) {
    const object = mesh(
      new THREE.TorusGeometry(radius, tube, 6, 48),
      color,
      x,
      y,
      z,
      true,
    );
    if (!vertical) object.rotation.x = Math.PI / 2;
    return object;
  }
  function tree(x: number, z: number, pink = false, y = 0.55, size = 1) {
    prop("cylinder", x, y + 0.3, z, 2.3 * size, 0.6, 2.3 * size, porcelain);
    box(x, y + 1.7 * size, z, 0.22, 3.4 * size, 0.22, steel);
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4;
      prop(
        "leaf",
        x + Math.cos(a) * 0.9 * size,
        y + 3.1 * size + (i % 3) * 0.4 * size,
        z + Math.sin(a) * 0.9 * size,
        1.1 * size,
        1.3 * size,
        1.1 * size,
        pink
          ? ["#ff71c7", "#fe40a0", "#ffa5dd"][i % 3]
          : ["#80dc36", "#2eaf67", "#affc48"][i % 3],
      );
    }
  }
  function lamp(x: number, z: number, color = "#00d9ff") {
    box(x, 3.1, z, 0.12, 5.5, 0.12, steel);
    box(x, 5.9, z, 1.7, 0.12, 0.6, porcelain);
    box(x, 5.78, z, 1.6, 0.08, 0.5, color, 0, true);
    const light = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    extraMaterials.add(light.material);
    light.position.set(x, 5.8, z);
    light.scale.set(2.8, 2.8, 1);
    nightProps.add(light);
  }
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  const ctx = glowCanvas.getContext("2d")!;
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.2, "rgba(255,255,255,.3)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  geo.textures.add(glowTexture);

  // Four city blocks, a waterfront and a raised transit promenade.
  box(0, -1.4, 2, 190, 3, 172, "#466789");
  box(0, 0.22, 2, 188, 0.5, 170, "#bbd3e6");
  box(0, -2.7, 20, 340, 0.35, 285, "#2687b7");
  for (let x = -90; x < 94; x += 4)
    box(x, 0.49, 2, 0.035, 0.02, 168, "#a3bed6");
  for (let z = -80; z < 86; z += 4)
    box(0, 0.49, z, 185, 0.02, 0.035, "#a3bed6");
  for (const z of [-42, -4, 35]) {
    box(0, 0.54, z, 188, 0.12, 8, dark);
    for (const dz of [-4.25, 4.25])
      box(0, 0.65, z + dz, 188, 0.2, 0.3, porcelain);
    for (let x = -89; x < 92; x += 5)
      box(x, 0.612, z, 2.6, 0.03, 0.1, "#e9faff");
    for (const dz of [-3.7, 3.7])
      box(0, 0.62, z + dz, 188, 0.025, 0.06, "#00d9ff", 0, true);
  }
  for (const x of [-56, 0, 56]) {
    box(x, 0.57, 0, 7, 0.12, 162, dark);
    for (const dx of [-3.7, 3.7])
      box(x + dx, 0.65, 0, 0.3, 0.2, 162, porcelain);
    for (let z = -77; z < 81; z += 5)
      box(x, 0.65, z, 0.1, 0.03, 2.4, porcelain);
    for (const z of [-42, -4, 35])
      for (let n = -2.5; n < 3; n += 0.9)
        for (const side of [-1, 1]) {
          box(x + n, 0.68, z + side * 5.8, 0.42, 0.025, 2.1, porcelain);
          box(x + side * 5.3, 0.68, z + n, 2.1, 0.025, 0.42, porcelain);
        }
  }

  function building(b: Building, index: number) {
    const [x, , z] = b.position;
    const { width: w, depth: d, height: h, form } = b.exterior;
    const c = b.color,
      front = z + d / 2;
    box(x, 0.85, z, w + 1.8, 0.65, d + 1.8, porcelain);
    box(x, 2.2, z, w, 2.2, d, glass);
    box(x, 3.4, z, w + 0.7, 0.25, d + 0.7, c);
    if (form === "round") {
      prop("cylinder", x, 2 + h / 2, z, w * 0.91, h - 3, d * 0.91, glass);
      for (let y = 5; y < h; y += 3)
        prop("cylinder", x, y, z, w * 0.98, 0.28, d * 0.98, porcelain);
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        box(
          x + Math.cos(a) * w * 0.46,
          (h + 3) / 2,
          z + Math.sin(a) * d * 0.46,
          0.18,
          h - 3,
          0.18,
          steel,
        );
      }
      prop("cylinder", x, h + 0.3, z, w, 0.55, d, porcelain);
      ring(x, h + 0.7, z, w * 0.39, c, false, 0.4);
    } else if (form === "spire") {
      const levels = Math.ceil((h - 3) / 3.1);
      for (let i = 0; i < levels; i++) {
        const y = 4 + i * 3.1,
          taper = 1 - (i / levels) * 0.48,
          off = Math.sin(i * 0.23) * 1.3;
        box(
          x + off,
          y + 1.4,
          z,
          w * taper,
          2.8,
          d * taper,
          i % 4 === 0 ? "#216c94" : glass,
        );
        box(x + off, y, z, w * taper + 0.8, 0.27, d * taper + 0.8, porcelain);
        box(
          x + off + (w * taper) / 2,
          y + 1.3,
          z,
          0.18,
          2.8,
          d * taper,
          c,
          0,
          true,
        );
      }
      box(x, h + 2.4, z, 0.2, 5, 0.2, c, 0, true);
      ring(x, h + 1, z, 5, c, false, 0.5);
      ring(x, h + 4, z, 3.5, c, false, 0.3);
    } else if (form === "terrace") {
      const levels = Math.ceil((h - 3) / 4);
      for (let i = 0; i < levels; i++) {
        const y = 3.7 + i * 4,
          dx = i % 2 ? 1.4 : -1.4,
          width = w - i * 0.7;
        box(x + dx, y + 1.75, z, width, 3.5, d - 1, glass);
        box(x + dx, y + 3.6, z, width + 1.2, 0.45, d + 0.6, porcelain);
        box(x + dx, y + 3.9, z + d / 2 - 0.5, width + 0.8, 0.18, 1.6, c);
        for (let n = -width / 2 + 1; n < width / 2; n += 2.2)
          prop(
            "leaf",
            x + dx + n,
            y + 4.3,
            z + d / 2 - 0.5,
            0.9,
            0.65,
            0.75,
            "#57c83d",
          );
      }
    } else if (form === "portal") {
      const wing = w * 0.28;
      for (const side of [-1, 1]) {
        box(x + side * (w / 2 - wing / 2), h / 2 + 2, z, wing, h - 3, d, glass);
        box(x + (side * w) / 2, h / 2 + 2, z, 0.5, h - 2, d + 0.3, porcelain);
        box(
          x + side * (w / 2 - wing),
          h / 2 + 2,
          front + 0.12,
          0.16,
          h - 3,
          0.15,
          c,
          0,
          true,
        );
      }
      box(x, h - 1.5, z, w, 3, d, porcelain);
      box(x, h - 1.5, front + 0.05, w - 1, 1.5, 0.1, c, 0, true);
      box(x, 6, z, w, 3, d - 3, glass);
      for (let y = 8; y < h - 3; y += 3)
        for (const side of [-1, 1])
          box(
            x + side * (w / 2 - wing / 2),
            y,
            front + 0.04,
            wing,
            0.18,
            0.12,
            porcelain,
          );
    } else if (form === "sawtooth") {
      box(x, h / 2 + 2, z, w, h - 3, d, glass);
      for (let i = 0; i < 4; i++) {
        const px = x - w / 2 + ((i + 0.5) * w) / 4;
        box(px, h + 0.25, z, w / 4 - 0.3, 0.7, d + 0.5, porcelain);
        box(px, h + 0.8, z - d / 4, w / 4 - 0.3, 0.65, d / 2, c);
        box(px, h + 1.2, z + d / 4, w / 4 - 0.3, 0.18, d / 2, glass);
      }
      for (let i = 0; i < 5; i++)
        box(
          x - w / 2 + 1 + (i * (w - 2)) / 4,
          h / 2 + 2,
          front + 0.07,
          0.22,
          h - 3,
          0.15,
          porcelain,
        );
    } else {
      box(x - 1, h / 2 + 2, z, w - 2, h - 3, d, glass);
      box(x + w / 2 - 1, h / 2 + 1, z, 2, h, d + 0.6, porcelain);
      for (let y = 4; y < h; y += 3) {
        box(x - 1, y, front + 0.1, w - 2, 0.22, 0.35, porcelain);
        box(x - 1, y, z - d / 2 - 0.1, w - 2, 0.22, 0.35, porcelain);
      }
      box(x, h + 0.3, z, w + 1, 0.55, d + 1, porcelain);
      box(
        x + w / 2 - 1,
        h / 2 + 1,
        front + 0.37,
        0.22,
        h - 1,
        0.16,
        c,
        0,
        true,
      );
    }
    // Curtain-wall mullions and window bands keep glazing distinct from the shell.
    if (form !== "round")
      for (let y = 5; y < h - 2; y += 3.1)
        for (let n = 0; n < 6; n++) {
          const px = x - w / 2 + 1.7 + (n * (w - 3.4)) / 5;
          box(
            px,
            y,
            front + 0.07,
            1.15,
            1.55,
            0.1,
            n % 3 === index % 3 ? "#8cdeee" : "#12486a",
            0,
            n % 3 === index % 3,
          );
        }
    // A wide, luminous entrance shared by the outdoor pick and its catalog entry.
    box(x, 2, front + 0.15, 3, 3, 0.2, dark);
    box(x, 2, front + 0.3, 2.55, 2.65, 0.12, "#59d9f0", 0, true);
    box(x, 2, front + 0.38, 0.08, 2.7, 0.06, porcelain);
    box(x, 0.75, front + 1.2, 4, 0.15, 2, c);
    sign(b.name, x, 4.65, front + 0.16, w - 1, 1.1, dark, c);
    sign("Enter", x, 2.6, front + 0.46, 1.4, 0.55, dark, porcelain);
    // Every venue has a recognizable roof object, not a generic roof generator.
    if (b.id === "records") {
      ring(x, h + 3, z, 3.2, c, true, 0.55);
      mesh(new THREE.CircleGeometry(2.9, 40), dark, x, h + 3, z + 0.02);
      ring(x, h + 3, z + 0.08, 0.85, c, true, 0.35);
    }
    if (b.id === "observatory") {
      const dome = mesh(
        new THREE.SphereGeometry(7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        "#486aa1",
        x,
        h + 0.5,
        z,
      );
      dome.scale.z = 1.1;
      ring(x, h + 0.6, z, 7.5, c);
    }
    if (b.id === "skyport") {
      prop("cylinder", x, h + 2, z, 15, 0.5, 15, steel);
      ring(x, h + 2.3, z, 6.5, c);
      sign("8", x, h + 4, z + 4, 3, 3, dark, c);
      box(x, h + 2.8, z, 8, 0.5, 2, porcelain);
      box(x, h + 3.3, z, 2, 0.7, 6, c);
    }
    if (b.id === "aquarium") {
      ring(x, h + 2, z, 5, c);
      mesh(new THREE.SphereGeometry(3, 24, 16), "#00d4f5", x, h + 2, z, true);
    }
    if (b.id === "arcade") {
      box(x, h + 2.4, z, 5, 3.5, 4, c);
      sign("PLAY", x, h + 2.4, z + 2.05, 4.4, 2, dark, porcelain);
    }
    if (b.id === "robotics") {
      box(x, h + 2.5, z, 3.5, 4, 3, c);
      box(x, h + 2.8, z + 1.6, 2.9, 1.2, 0.15, dark);
      for (const dx of [-0.7, 0.7])
        box(x + dx, h + 2.8, z + 1.7, 0.6, 0.6, 0.08, "#00eeff", 0, true);
    }
    if (b.id === "gallery")
      for (let i = 0; i < 3; i++)
        ring(
          x,
          h + 2 + i * 1.5,
          z,
          4 - i * 0.7,
          [c, "#00cfff", "#ffcc24"][i],
          true,
          0.35,
        );
    if (b.id === "clinic") {
      box(x, h + 2.5, z, 4, 1, 1, c, 0, true);
      box(x, h + 2.5, z, 1, 4, 1, c, 0, true);
    }
    if (b.id === "fashion") {
      const crystal = mesh(
        new THREE.OctahedronGeometry(3.2),
        c,
        x,
        h + 3,
        z,
        true,
      );
      crystal.rotation.z = Math.PI / 6;
    }
    if (b.id === "gardens")
      for (const dx of [-5, 0, 5]) tree(x + dx, z, false, h + 0.7, 0.8);
    if (b.id === "energy")
      for (const dx of [-5, 0, 5])
        box(x + dx, h - 2, z, 3.7, 0.25, 6, "#22507d");
    if (b.id === "cinema")
      sign("AFTERGLOW\nSCREEN ONE", x, h + 2, front - 0.3, 13, 3, dark, c);
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1, h + 8, d + 2),
      pickMaterial,
    );
    pick.position.set(x, (h + 8) / 2, z);
    pick.userData = { kind: "building", id: b.id, label: b.name };
    scene.add(pick);
    picks.push(pick);
    tree(x - w / 2 - 1.6, front + 1.5, index % 4 === 0, 0.55, 0.68);
    lamp(x + w / 2 + 1.2, front + 1.8, c);
  }
  buildings.forEach(building);

  // Suspended glazed bridges connect the modern tower volumes.
  for (const [x, z, y, length] of [
    [0, -58, 23, 18],
    [28, -26, 15, 18],
  ] as const) {
    box(x, y, z, length, 0.45, 3.7, porcelain);
    box(x, y + 2, z, length, 3.7, 3.4, glass);
    box(x, y + 3.9, z, length, 0.3, 3.7, porcelain);
    for (const dz of [-1.9, 1.9])
      box(x, y + 0.4, z + dz, length, 0.1, 0.1, "#00d9ff", 0, true);
    for (let n = -length / 2; n < length / 2; n += 2)
      box(x + n, y + 2, z + 1.75, 0.08, 3.6, 0.1, porcelain);
  }
  // Canal, promenade seating and an illuminated sculptural fountain.
  box(0, 0.15, 82, 188, 0.25, 9, "#05a8d5", 0, true);
  for (const z of [76.5, 87.5]) box(0, 0.6, z, 190, 0.5, 0.5, porcelain);
  for (let x = -85; x < 88; x += 9) {
    tree(x, 73, x % 3 === 0, 0.55, 0.8);
    box(x, 1, 75, 3.4, 0.65, 0.8, porcelain);
    box(x, 1.55, 75.35, 3.4, 0.8, 0.16, steel);
  }
  prop("cylinder", -27, 0.8, 72, 10, 0.4, 10, porcelain);
  const water = mesh(
    new THREE.CylinderGeometry(4.5, 4.5, 0.1, 48),
    "#00e0ee",
    -27,
    1.05,
    72,
    true,
  );
  const fountain = ring(-27, 4.4, 72, 3.2, "#00d9ff", true, 0.3);
  fountain.rotation.y = Math.PI / 3;
  ring(-27, 4.4, 72, 2.2, "#ffce24", true, 0.28);
  box(-27, 2.7, 72, 0.3, 3.3, 0.3, porcelain);

  // Maglev track: continuous elevated guideway and two moving trains.
  box(0, 7.1, 68, 195, 0.65, 5.1, porcelain);
  for (const dz of [-2.35, 2.35])
    box(0, 7.6, 68 + dz, 195, 0.25, 0.18, "#00d9ff", 0, true);
  for (let x = -86; x < 91; x += 19) {
    box(x, 3.8, 68, 0.9, 7, 1.6, steel);
    box(x, 6.4, 68, 2.8, 1.3, 2.2, porcelain);
  }
  for (let t = 0; t < 2; t++) {
    const parts: Parameters<typeof movingMesh>[0] = [];
    for (let car = 0; car < 3; car++) {
      const x = car * 6.9;
      parts.push(
        { position: [x, 1.1, 0], size: [6.5, 1.8, 1.95], color: porcelain },
        { position: [x, 1.35, 0], size: [5.9, 0.9, 2], color: "#146e9a" },
        {
          position: [x, 0.45, 0],
          size: [6.6, 0.3, 2.05],
          color: t ? "#ff398e" : "#00d9ff",
        },
        { position: [x, 2.1, 0], size: [6.6, 0.22, 2.1], color: porcelain },
      );
      for (let n = 0; n < 4; n++)
        parts.push({
          position: [x - 2.3 + n * 1.4, 1.4, 0],
          size: [0.09, 1, 2.04],
          color: porcelain,
        });
    }
    const train = movingMesh(parts);
    scene.add(train);
    extras.push(train);
    extraMaterials.add(train.material as THREE.Material);
    actors.push({
      mesh: train,
      axis: "x",
      lane: 68 + (t ? 1.2 : -1.2),
      speed: t ? -7 : 7,
      offset: t ? 70 : -30,
      extent: 110,
      height: 7.6,
    });
  }
  // Small electric shuttles leave pedestrian crossings readable.
  for (let i = 0; i < 22; i++) {
    const color = ["#ffcc24", "#00ddff", "#ff3b8d", "#c3f52a", porcelain][
      i % 5
    ];
    const car = movingMesh([
      { position: [0, 0.5, 0], size: [3.6, 0.75, 1.7], color },
      { position: [-0.2, 1.1, 0], size: [2.5, 0.75, 1.5], color: glass },
      { position: [-0.2, 1.5, 0], size: [2.6, 0.15, 1.6], color: porcelain },
      { position: [1.82, 0.75, 0], size: [0.08, 0.15, 1.4], color: "#a5f5ff" },
      { position: [-1.82, 0.7, 0], size: [0.08, 0.12, 1.3], color: "#ff358b" },
    ]);
    scene.add(car);
    extras.push(car);
    extraMaterials.add(car.material as THREE.Material);
    const axis = i < 16 ? "x" : "z",
      direction = i % 2 ? 1 : -1;
    actors.push({
      mesh: car,
      axis,
      lane:
        axis === "x"
          ? [-42, -4, 35][i % 3] + direction * 2
          : [-56, 0, 56][i % 3] + direction * 1.7,
      speed: direction * (3 + random() * 1.7),
      offset: i * 11,
      extent: axis === "x" ? 90 : 76,
      height: 0.65,
    });
  }
  for (let i = 0; i < 84; i++) {
    const resident =
      i < residents.length ? residents[i] : residentById(`visitor-${i}`);
    const axis = i < 64 ? "x" : "z",
      lane =
        axis === "x"
          ? [-48, -10, 2, 29, 41, 73][i % 6]
          : [-61, -5, 5, 61][i % 4];
    const offset = random() * 160 - 80;
    const person = art.create(
      resident,
      scene,
      axis === "x" ? offset : lane,
      0.65,
      axis === "z" ? offset : lane,
    );
    person.sprite.scale.set(1.9, 2.85, 1);
    people.push(person);
    picks.push(person.sprite);
    actors.push({
      mesh: person.sprite,
      axis,
      lane,
      speed: (i % 2 ? 1 : -1) * (0.5 + random() * 0.35),
      offset,
      extent: axis === "x" ? 86 : 74,
      height: 0.65,
      pedestrian: true,
      citizen: person,
    });
    if (i === 0 || i === 12 || i === 21)
      bubbles.push({
        bubble: art.bubble(
          resident.phrase,
          scene,
          person.sprite.position.x,
          4,
          person.sprite.position.z,
        ),
        person,
      });
  }
  for (const district of districts) {
    const material = new THREE.MeshBasicMaterial({
      color: district.color,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    extraMaterials.add(material);
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(25, 27), material);
    overlay.rotation.x = -Math.PI / 2;
    overlay.position.set(district.position[0], 0.8, district.position[2]);
    overlay.visible = false;
    scene.add(overlay);
    extras.push(overlay);
    overlays.push(overlay);
    const light = new THREE.PointLight(district.color, 0, 32, 1.5);
    light.position.set(district.position[0], 5, district.position[2] + 12);
    scene.add(light);
    nightLights.push(light);
  }
  const beacon = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: "#ffce24",
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    extraMaterials.add(material);
    const r = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.4, 48), material);
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.8 + i * 0.04;
    beacon.add(r);
    extras.push(r);
  }
  beacon.visible = false;
  scene.add(beacon);
  geo.finish();
  scene.add(geo.root);
  return {
    geometry: geo,
    actors,
    picks,
    people,
    bubbles,
    art,
    overlays,
    water,
    beacon,
    nightLights,
    nightProps,
    dispose() {
      art.dispose();
      geo.dispose();
      extras.forEach((m) => m.geometry.dispose());
      picks.forEach((p) => {
        if (p instanceof THREE.Mesh) p.geometry.dispose();
      });
      extraMaterials.forEach((m) => m.dispose());
    },
  };
}
