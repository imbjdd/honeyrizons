import * as THREE from "three";
import { CityGeometry, movingMesh, seededRandom } from "./geometry";
import { districts, type Protocol } from "./model";

export interface MovingActor {
  mesh: THREE.Mesh;
  axis: "x" | "z";
  lane: number;
  speed: number;
  offset: number;
  extent: number;
  height: number;
  pedestrian?: boolean;
}
export interface CityWorld {
  geometry: CityGeometry;
  actors: MovingActor[];
  picks: THREE.Mesh[];
  overlays: THREE.Mesh[];
  water: THREE.Mesh;
  beacon: THREE.Group;
  nightLights: THREE.PointLight[];
  nightProps: THREE.Group;
  dispose: () => void;
}

export function buildWorld(scene: THREE.Scene): CityWorld {
  const geo = new CityGeometry();
  const random = seededRandom(8102026);
  const actors: MovingActor[] = [];
  const picks: THREE.Mesh[] = [];
  const overlays: THREE.Mesh[] = [];
  const extraGeometries = new Set<THREE.BufferGeometry>();
  const extraMaterials = new Set<THREE.Material>();
  const nightProps = new THREE.Group();
  nightProps.visible = false;
  scene.add(nightProps);
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  const glowContext = glowCanvas.getContext("2d")!;
  const glowGradient = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  glowGradient.addColorStop(0, "rgba(255,235,171,1)");
  glowGradient.addColorStop(0.18, "rgba(255,220,137,.4)");
  glowGradient.addColorStop(1, "rgba(255,220,137,0)");
  glowContext.fillStyle = glowGradient;
  glowContext.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  geo.textures.add(glowTexture);
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: "#f6db9d",
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  extraMaterials.add(glowMaterial);
  const coneMaterial = new THREE.MeshBasicMaterial({
    color: "#f6d89a",
    transparent: true,
    opacity: 0.047,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  extraMaterials.add(coneMaterial);
  const coneGeometry = new THREE.ConeGeometry(1.5, 5.5, 16, 1, true);
  extraGeometries.add(coneGeometry);
  const box = geo.box.bind(geo);
  const sign = geo.sign.bind(geo);
  const palettes = [
    "#d4c9b9",
    "#adb8c0",
    "#b6b0a9",
    "#ccb3a2",
    "#999fa9",
    "#c4c2b1",
    "#c3b6af",
    "#bcc9c0",
  ];
  const trim = "#5b6269";

  function tree(x: number, z: number, pink = false, scale = 1) {
    const y = 0.38;
    box(x, y, z, 2.1 * scale, 0.55, 2.1 * scale, "#797c74");
    box(x, 0.68, z, 1.7 * scale, 0.12, 1.7 * scale, "#627357");
    box(x, 2.1 * scale, z, 0.36 * scale, 3.1 * scale, 0.36 * scale, "#80654c");
    const colors = pink
      ? ["#d989b2", "#eaa7c8", "#cd79a4", "#edb6d1"]
      : ["#6c9d59", "#578c50", "#83ab65", "#649650"];
    for (let i = 0; i < 21; i++) {
      const angle = i * 2.4;
      const radius = i < 7 ? 0.45 : 1.12;
      geo.prop(
        "leaf",
        x + Math.cos(angle) * radius * scale,
        (3.9 + random() * 1.5) * scale,
        z + Math.sin(angle) * radius * scale,
        (0.68 + random() * 0.35) * scale,
        (0.65 + random() * 0.4) * scale,
        (0.65 + random() * 0.4) * scale,
        colors[i % colors.length],
        angle,
      );
      if (i % 3 === 0)
        box(
          x + Math.cos(angle) * radius * scale,
          (4 + random() * 1.1) * scale,
          z + Math.sin(angle) * radius * scale,
          0.52 * scale,
          0.49 * scale,
          0.53 * scale,
          colors[(i + 1) % colors.length],
        );
    }
  }

  function bench(x: number, z: number, rotation = 0) {
    const c = Math.cos(rotation),
      s = Math.sin(rotation);
    function part(
      dx: number,
      dy: number,
      dz: number,
      w: number,
      h: number,
      d: number,
      color: string,
    ) {
      box(
        x + dx * c + dz * s,
        dy,
        z - dx * s + dz * c,
        w,
        h,
        d,
        color,
        rotation,
      );
    }
    for (let i = 0; i < 4; i++)
      part(0, 0.88, -0.34 + i * 0.21, 2.6, 0.12, 0.16, "#bb9462");
    part(0, 1.4, -0.55, 2.6, 0.7, 0.12, "#b88a56");
    for (const x of [-0.92, 0.92]) {
      part(x, 0.55, 0, 0.15, 0.65, 0.8, "#59605e");
      part(x, 1.15, -0.5, 0.12, 1.1, 0.12, "#59605e");
    }
  }

  function lamp(x: number, z: number, direction = 1) {
    box(x, 0.45, z, 0.65, 0.4, 0.65, "#4e5253");
    box(x, 3.4, z, 0.18, 6, 0.18, "#505758");
    box(x + direction * 0.68, 6.35, z, 1.5, 0.18, 0.2, "#505758");
    box(x + direction * 1.24, 6.22, z, 0.75, 0.22, 0.48, "#f6e3ac", 0, true);
    const glow = new THREE.Sprite(glowMaterial);
    glow.position.set(x + direction * 1.24, 6.1, z);
    glow.scale.set(2.1, 2.1, 1);
    nightProps.add(glow);
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.set(x + direction * 1.24, 3.25, z);
    nightProps.add(cone);
  }

  function bollard(x: number, z: number) {
    box(x, 0.74, z, 0.28, 0.96, 0.28, "#555958");
    box(x, 1.03, z, 0.29, 0.18, 0.29, "#e4ba55");
  }

  function ac(x: number, y: number, z: number) {
    box(x, y, z, 1.35, 0.85, 1.1, "#d6d9d6");
    for (let i = 0; i < 4; i++)
      box(x - 0.46 + i * 0.3, y + 0.06, z + 0.56, 0.07, 0.54, 0.02, "#8d9898");
    geo.prop("cylinder", x, y + 0.44, z, 0.7, 0.06, 0.7, "#8d9898");
  }

  function roofGarden(x: number, y: number, z: number, w: number) {
    box(x, y, z, w - 0.7, 0.15, 4.2, "#768868");
    for (const dz of [-1.8, 1.8]) {
      box(x, y + 0.35, z + dz, w - 0.9, 0.5, 0.45, "#8c745a");
      for (let dx = -w / 2 + 0.9; dx < w / 2 - 0.5; dx += 0.65)
        geo.prop("leaf", x + dx, y + 0.72, z + dz, 0.34, 0.35, 0.34, "#70945b");
    }
    for (const dx of [-2, 2])
      for (const dz of [-1.3, 1.3])
        box(x + dx, y + 1.3, z + dz, 0.14, 2.6, 0.14, "#9b7a51");
    for (let dx = -2.5; dx < 2.7; dx += 0.45)
      box(x + dx, y + 2.65, z, 0.15, 0.14, 3.4, "#ac8757");
  }

  function awning(x: number, z: number, w: number, color: string, y = 3.4) {
    const strips = Math.round(w / 0.55);
    for (let i = 0; i < strips; i++) {
      box(
        x - w / 2 + ((i + 0.5) * w) / strips,
        y,
        z + 0.75,
        w / strips,
        0.16,
        1.8,
        i % 2 ? "#f1ece0" : color,
      );
      box(
        x - w / 2 + ((i + 0.5) * w) / strips,
        y - 0.23,
        z + 1.58,
        w / strips,
        0.45,
        0.12,
        i % 2 ? "#f1ece0" : color,
      );
    }
  }

  interface BuildingConfig {
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    color?: string;
    accent?: string;
    name?: string;
    style?: "balcony" | "office" | "shop";
    garden?: boolean;
    protocol?: Protocol;
  }
  function building({
    x,
    z,
    w,
    d,
    h,
    color = palettes[Math.floor(random() * palettes.length)],
    accent = "#78978a",
    name,
    style = "office",
    garden = false,
    protocol,
  }: BuildingConfig) {
    const base = 0.38;
    box(x, base + h / 2, z, w, h, d, color);
    box(x, 0.61, z, w + 0.15, 0.42, d + 0.15, trim);
    box(x, h + 0.65, z, w + 0.4, 0.6, d + 0.4, "#62656c");
    box(x, h + 0.97, z, w - 0.5, 0.06, d - 0.5, "#82848a");
    const floorCount = Math.floor((h - 3.6) / 2.65);
    const cols = Math.max(2, Math.floor(w / 2.2));
    const front = z + d / 2 + 0.02;
    for (let floor = 0; floor < floorCount; floor++) {
      const y = 4.5 + floor * 2.65;
      for (let col = 0; col < cols; col++) {
        const px = x - w / 2 + ((col + 0.5) * w) / cols;
        const windowColor =
          random() > 0.66 ? "#e8b966" : random() > 0.5 ? "#9fbfc2" : "#344550";
        box(px, y, front, 1.45, 1.72, 0.14, "#606467");
        box(
          px,
          y + 0.03,
          front + 0.09,
          1.15,
          1.44,
          0.04,
          windowColor,
          0,
          windowColor !== "#344550",
        );
        box(px, y - 0.05, front + 0.14, 0.06, 1.42, 0.04, "#d1d0c5");
      }
      box(x, y - 1.08, front + 0.1, w, 0.16, 0.28, "#dedbcf");
      for (const side of [-1, 1]) {
        for (let col = 0; col < Math.floor(d / 2.5); col++) {
          const pz = z - d / 2 + ((col + 0.5) * d) / Math.floor(d / 2.5);
          const warm = random() > 0.65;
          box(
            x + side * (w / 2 + 0.025),
            y,
            pz,
            0.12,
            1.55,
            1.1,
            warm ? "#e8b966" : "#46565f",
            0,
            warm,
          );
        }
      }
      if (style === "balcony") {
        box(x, y - 0.86, front + 0.48, w + 0.25, 0.18, 1, "#c7c7c1");
        box(x, y - 0.33, front + 0.99, w + 0.1, 0.88, 0.12, "#ccd2cf");
        for (const dx of [-w / 2, 0, w / 2])
          box(x + dx, y - 0.35, front + 0.54, 0.12, 1, 1, "#daddd5");
        box(x + w * 0.28, y - 0.57, front + 0.68, 0.65, 0.45, 0.35, accent);
      }
    }
    if (style === "office" && h > 18)
      for (let col = 0; col <= cols; col++)
        box(
          x - w / 2 + (col * w) / cols,
          h / 2 + 2.1,
          front + 0.17,
          0.12,
          h - 4,
          0.16,
          trim,
        );
    // Glass storefront, slim mullions, door and striped canopy.
    for (let col = 0; col < cols; col++) {
      const px = x - w / 2 + ((col + 0.5) * w) / cols;
      box(px, 1.82, front + 0.02, w / cols - 0.24, 2.45, 0.15, "#577d7e");
      box(px, 1.84, front + 0.12, 0.09, 2.45, 0.05, "#eadbc1");
      box(px, 1.37, front + 0.1, w / cols - 0.4, 0.75, 0.08, "#c0b890");
    }
    box(x, 2.93, front + 0.09, w, 0.3, 0.18, accent);
    if (name) {
      sign(name, x, 3.57, front + 0.14, w - 0.3, 0.91, accent);
      awning(x, front, w - 0.1, accent, 2.85);
    }
    for (let i = 0; i < Math.max(1, Math.floor(w / 4)); i++)
      ac(x - w / 2 + 1.5 + i * 3, h + 1.41, z - d / 2 + 1.6);
    box(x + w / 2 - 1.4, h + 1.7, z, 0.8, 1.5, 0.8, "#b9c0bd");
    box(x + w / 2 - 1.4, h + 2.65, z, 0.36, 0.5, 0.36, "#d9dfd9");
    // Roofs have vents, aerials, access rooms, water tanks and occasional solar panels.
    if (random() > 0.5) {
      geo.prop(
        "cylinder",
        x + w / 2 - 2.4,
        h + 2.75,
        z - d / 2 + 2,
        1.75,
        2.1,
        1.75,
        "#9ca9ac",
      );
      for (let n = 0; n < 3; n++)
        geo.prop(
          "cylinder",
          x + w / 2 - 2.4,
          h + 2.05 + n * 0.65,
          z - d / 2 + 2,
          1.8,
          0.1,
          1.8,
          "#7d8e91",
        );
      box(
        x + w / 2 - 2.4,
        h + 3.84,
        z - d / 2 + 2,
        1.45,
        0.14,
        1.45,
        "#bcc4c2",
      );
    } else {
      box(x + w / 2 - 1.2, h + 3.6, z - 2, 0.08, 5.3, 0.08, "#647272");
      for (let n = 0; n < 4; n++)
        box(
          x + w / 2 - 1.2,
          h + 4.1 + n * 0.45,
          z - 2,
          1.35 - n * 0.15,
          0.06,
          0.06,
          "#647272",
        );
    }
    if (!garden && random() > 0.6) {
      box(x - 1.4, h + 1.85, z + 1.5, 3.5, 1.65, 3, color);
      box(x - 1.4, h + 2.75, z + 1.5, 3.8, 0.2, 3.3, trim);
    }
    if (!garden && random() > 0.6)
      for (let n = 0; n < 3; n++) {
        box(
          x - w / 2 + 1.1 + n * 1.4,
          h + 1.3,
          z + d / 2 - 2,
          1.25,
          0.15,
          2.2,
          "#566e83",
        );
        for (let m = 0; m < 4; m++)
          box(
            x - w / 2 + 1.1 + n * 1.4,
            h + 1.39,
            z + d / 2 - 2.8 + m * 0.55,
            1.25,
            0.02,
            0.03,
            "#98adb8",
          );
      }
    if (garden) roofGarden(x, h + 1.05, z + 1, w);
    if (protocol) {
      const pick = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.5, h + 1, d + 1),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      pick.position.set(x, h / 2, z);
      pick.userData.protocol = protocol;
      scene.add(pick);
      picks.push(pick);
    }
  }

  // A repeating pavement texture gives the world scale without thousands of tiles.
  const pavement = document.createElement("canvas");
  pavement.width = 128;
  pavement.height = 128;
  const ctx = pavement.getContext("2d")!;
  ctx.fillStyle = "#c9cac6";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 250; i++) {
    ctx.fillStyle = `rgba(100,100,90,${random() * 0.08})`;
    ctx.fillRect(random() * 128, random() * 128, 2, 2);
  }
  ctx.strokeStyle = "#b6b9b6";
  ctx.lineWidth = 1;
  for (let n = 0; n <= 128; n += 32) {
    ctx.beginPath();
    ctx.moveTo(n, 0);
    ctx.lineTo(n, 128);
    ctx.moveTo(0, n);
    ctx.lineTo(128, n);
    ctx.stroke();
  }
  const pavementMap = new THREE.CanvasTexture(pavement);
  pavementMap.colorSpace = THREE.SRGBColorSpace;
  pavementMap.wrapS = pavementMap.wrapT = THREE.RepeatWrapping;
  pavementMap.repeat.set(35, 35);
  geo.textures.add(pavementMap);
  const groundMaterial = new THREE.MeshStandardMaterial({
    map: pavementMap,
    roughness: 1,
  });
  extraMaterials.add(groundMaterial);
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(160, 0.65, 150),
    groundMaterial,
  );
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);
  extraGeometries.add(ground.geometry);

  // Connected avenues with curb edges, lane markings and zebra crossings.
  for (const z of [-44, 0, 44, -78]) {
    const width = z === 0 ? 11 : 9;
    box(0, 0.31, z, 160, 0.05, width, "#8b9093");
    for (const edge of [-1, 1]) {
      box(0, 0.39, z + edge * (width / 2 + 0.16), 160, 0.16, 0.32, "#e4e1d4");
      box(0, 0.351, z + edge * (width / 2 - 0.5), 160, 0.025, 0.08, "#e4c86b");
      box(0, 0.353, z + edge * 0.12, 160, 0.025, 0.065, "#e4c86b");
    }
    for (let x = -77; x < 79; x += 6)
      if (Math.abs(x + 37) > 5 && Math.abs(x - 37) > 5) {
        for (const dz of [-width / 4, width / 4])
          box(x, 0.36, z + dz, 2.4, 0.03, 0.12, "#e7e7db");
      }
  }
  for (const x of [-37, 37, -75, 75]) {
    box(x, 0.34, -1, 9, 0.06, 150, "#8b9093");
    for (const edge of [-1, 1]) {
      box(x + edge * 4.65, 0.39, -1, 0.32, 0.16, 150, "#e4e1d4");
      box(x + edge * 4, 0.383, -1, 0.08, 0.025, 150, "#e4c86b");
    }
    box(x - 0.12, 0.383, -1, 0.065, 0.025, 150, "#e4c86b");
    box(x + 0.12, 0.383, -1, 0.065, 0.025, 150, "#e4c86b");
    for (let z = -72; z < 74; z += 6)
      if (Math.abs(z) > 7 && Math.abs(z - 44) > 6 && Math.abs(z + 44) > 6)
        for (const dx of [-2.3, 2.3])
          box(x + dx, 0.385, z, 0.12, 0.025, 2.4, "#e7e7db");
    for (const z of [-44, 0, 44]) {
      for (let n = -3.4; n < 4; n += 1.1) {
        for (const side of [-1, 1]) {
          box(x + side * 6.7, 0.39, z + n, 2.7, 0.03, 0.55, "#efede3");
          box(x + n, 0.39, z + side * 7.3, 0.55, 0.03, 2.7, "#efede3");
        }
      }
    }
  }

  // The avenue's main row. A recognisable skyline, varied silhouettes and shops.
  building({
    x: -60,
    z: -17,
    w: 10,
    d: 12,
    h: 15,
    name: "RAMEN  ラーメン",
    accent: "#c77d5a",
    style: "shop",
  });
  building({
    x: -48,
    z: -18,
    w: 10,
    d: 14,
    h: 21,
    style: "balcony",
    accent: "#af8f80",
    garden: true,
  });
  building({
    x: -26,
    z: -19,
    w: 8,
    d: 15,
    h: 19,
    name: "THE HONEY SHOP",
    accent: "#b99855",
    style: "balcony",
  });
  building({
    x: -15,
    z: -20,
    w: 12,
    d: 16,
    h: 29,
    color: "#d8c7a8",
    accent: "#b69352",
    name: "HONEYRIZONS",
    protocol: "SSH",
  });
  building({
    x: -2.5,
    z: -18,
    w: 10.5,
    d: 12,
    h: 6.5,
    name: "蜂蜜  HONEY CAFE",
    color: "#c5b99d",
    accent: "#d1a13d",
    garden: false,
  });
  building({
    x: 10,
    z: -20,
    w: 11,
    d: 16,
    h: 22,
    color: "#808f92",
    name: "GREEN MARKET",
    accent: "#689b83",
    style: "balcony",
    garden: true,
  });
  building({
    x: 23,
    z: -18,
    w: 11,
    d: 12,
    h: 13.5,
    name: "WEB HOTEL",
    accent: "#579c7d",
    color: "#a1b7a4",
    protocol: "HTTP",
    style: "balcony",
  });
  building({
    x: 49,
    z: -19,
    w: 12,
    d: 14,
    h: 25,
    name: "RECORDS  レコード",
    accent: "#927aab",
    style: "balcony",
  });
  building({
    x: 62,
    z: -17,
    w: 10,
    d: 10,
    h: 13,
    name: "FLOWERS  花",
    accent: "#c884a0",
    garden: true,
  });

  // Honey Tower: warm vertical fins, rooftop penthouse and honeycomb crown.
  for (const x of [-20.85, -9.15])
    box(x, 15.2, -11.84, 0.34, 27.3, 0.2, "#bca77c");
  box(-15, 32.3, -20, 7, 4.3, 9, "#caba97");
  box(-15, 34.6, -20, 7.5, 0.35, 9.5, "#9f8d69");
  sign("HONEY\nTOWER", -15, 26.65, -11.84, 8.8, 3.05, "#4e5551", "#f3d77e");
  sign("SSH  :2222", -15, 19.2, -11.83, 6.5, 1.25, "#4d5558", "#dfc377");
  sign(
    "OPEN DOORS\nCURIOUS VISITORS",
    -26,
    13,
    -11.34,
    6.8,
    2.8,
    "#344f58",
    "#96c7c2",
  );
  sign("蜂蜜\nHONEY\nCAFE", -7.25, 5.4, -10.9, 1.2, 3.2, "#d0a14b", "#fff0b9");
  sign("WE'RE OPEN\n8080", 23, 10.35, -11.89, 6.7, 2.05, "#38695e", "#b9dcc4");
  sign(
    "音楽\nVINYL\nRECORDS",
    54.55,
    10,
    -11.9,
    1.45,
    5.3,
    "#805178",
    "#efb5d9",
  );
  // A low cafe roof and a bright yellow tram-stop billboard.
  for (let i = 0; i < 7; i++)
    box(
      -2.5,
      7.2 + i * 0.22,
      -18,
      11.4,
      0.25,
      13.1 - i * 1.6,
      i % 2 ? "#5f7162" : "#4f6559",
    );
  sign(
    "A LITTLE CITY.\nA LOT OF STORIES.",
    9,
    8.3,
    -11.8,
    7,
    2.1,
    "#445754",
    "#e5c675",
  );
  // A street-side demo board, coffee tables and lanterns at the cafe.
  for (const x of [-5.4, 0.4]) box(x, 10.3, -17.4, 0.17, 4.5, 0.17, "#62695c");
  box(-2.5, 11.35, -17.4, 8.7, 3.7, 0.5, "#d0ae61");
  sign(
    "CITY ACTIVITY\n36 VISITORS / 5 DISTRICTS\nDEMO NEIGHBORHOOD",
    -2.5,
    11.35,
    -17.13,
    8.3,
    3.3,
    "#354c4c",
    "#e9d7a0",
  );
  for (const x of [-5.7, 0.6]) {
    geo.prop("cylinder", x, 1.24, -9.8, 1.15, 0.13, 1.15, "#c3a174");
    box(x, 0.83, -9.8, 0.16, 0.8, 0.16, "#5e635c");
    for (const dx of [-0.85, 0.85]) {
      box(x + dx, 0.86, -9.8, 0.47, 0.1, 0.5, "#b89360");
      box(x + dx, 0.65, -9.8, 0.13, 0.5, 0.13, "#5e635c");
      box(x + dx, 1.2, -10.06, 0.47, 0.63, 0.08, "#b89360");
    }
    box(x, 1.44, -9.8, 0.18, 0.28, 0.18, "#eee4cc");
  }
  for (let x = -6.5; x < 2.5; x += 1.5)
    geo.prop(
      "cylinder",
      x,
      3.1,
      -10.12,
      0.45,
      0.62,
      0.45,
      x % 2 ? "#d6ac58" : "#cf8c6e",
      0,
      true,
    );
  // Bicycles and delivery boxes tucked against the shop fronts.
  for (const x of [-23, 18, 28]) {
    for (const dx of [-0.7, 0.7]) {
      const wheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.06, 4, 12),
        geo.material("#5c6560"),
      );
      wheel.position.set(x + dx, 0.92, -10);
      scene.add(wheel);
      extraGeometries.add(wheel.geometry);
    }
    box(x, 1.21, -10, 1.5, 0.08, 0.08, "#b78567");
    box(x - 0.3, 1.45, -10, 0.08, 0.65, 0.08, "#b78567");
    box(x + 0.5, 1.55, -10, 0.08, 1.1, 0.08, "#b78567");
    box(x + 0.5, 2.11, -10, 0.45, 0.08, 0.08, "#5c6560");
    box(x - 0.35, 1.82, -10, 0.38, 0.1, 0.15, "#5c6560");
    box(x + 1.45, 0.92, -10.2, 0.75, 0.85, 0.75, "#be9e6c");
    box(x + 1.45, 1.39, -10.2, 0.78, 0.08, 0.78, "#cdb07e");
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const cell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.82, 0.5, 6),
      geo.material("#e8b449", true),
    );
    cell.rotation.x = Math.PI / 2;
    cell.position.set(-15 + Math.cos(a) * 1.52, 37 + Math.sin(a) * 1.52, -20);
    cell.castShadow = true;
    scene.add(cell);
    extraGeometries.add(cell.geometry);
  }
  const centerCell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.83, 0.83, 0.5, 6),
    geo.material("#f5d17c", true),
  );
  centerCell.rotation.x = Math.PI / 2;
  centerCell.position.set(-15, 37, -20);
  scene.add(centerCell);
  extraGeometries.add(centerCell.geometry);
  box(-15, 35.6, -20, 0.24, 2.2, 0.24, "#7d795e");

  // A little green-tiled tea house with a stepped pitched roof.
  building({
    x: -58,
    z: 17,
    w: 10,
    d: 10,
    h: 5.7,
    color: "#d2bea5",
    accent: "#6b977c",
    name: "お茶  TEA HOUSE",
    style: "shop",
  });
  for (let i = 0; i < 9; i++)
    box(
      -58,
      6.25 + i * 0.23,
      17,
      11.1,
      0.27,
      11.3 - i * 0.94,
      i % 2 ? "#657c6b" : "#55705e",
    );
  building({
    x: -47,
    z: 20,
    w: 8.5,
    d: 15,
    h: 12,
    color: "#d1b0a0",
    accent: "#b77565",
    name: "OLD TOWN  旧市街",
    protocol: "TELNET",
    style: "balcony",
  });
  building({
    x: -26,
    z: 22,
    w: 9,
    d: 15,
    h: 9,
    name: "BOOKS & COFFEE",
    accent: "#b5866b",
    garden: true,
  });
  building({
    x: 23,
    z: 22,
    w: 10,
    d: 15,
    h: 11,
    color: "#b1c4c4",
    accent: "#699db1",
    name: "CACHE  GARDENS",
    protocol: "REDIS",
    garden: true,
  });
  building({
    x: 49,
    z: 20,
    w: 12,
    d: 17,
    h: 18,
    color: "#c6bfcb",
    accent: "#9380b1",
    name: "THE ARCHIVE",
    protocol: "MYSQL",
    style: "balcony",
    garden: true,
  });
  building({
    x: 63,
    z: 19,
    w: 11,
    d: 15,
    h: 9,
    name: "VINYL & VINTAGE",
    accent: "#aa9675",
  });

  // Background neighborhoods, with irregular heights, alleys and roof silhouettes.
  for (const z of [-62, -34, 61]) {
    for (const x of [-62, -49, -24, -10, 4, 19, 51, 64]) {
      const h =
        z === 61
          ? 5 + random() * 7
          : z === -34
            ? 10 + random() * 17
            : 16 + random() * 17;
      building({
        x,
        z,
        w: 9 + random() * 2.7,
        d: z === -34 ? 6 : 12,
        h,
        style: random() > 0.65 ? "balcony" : "office",
        garden: random() > 0.73,
        ...(z === 61
          ? {
              name: ["BAKERY", "LOCAL STORE", "STUDIO", "SUSHI"][
                Math.floor(random() * 4)
              ],
              accent: ["#bd9870", "#789b87", "#a4869a"][
                Math.floor(random() * 3)
              ],
            }
          : {}),
      });
    }
  }

  // Station roof and elevated railway in the foreground.
  box(0, 4.35, 38, 156, 0.6, 4.3, "#a5aaab");
  for (const z of [36.4, 39.6]) {
    box(0, 4.75, z, 157, 0.4, 0.24, "#cbd0cc");
    box(0, 4.82, z, 157, 0.25, 0.12, "#626c70");
  }
  for (let x = -74; x < 80; x += 13) {
    box(x, 2.2, 38, 0.9, 4.5, 3.8, "#9ca4a3");
    box(x, 4.1, 38, 2.4, 0.4, 4.4, "#919b9d");
  }
  for (let x = -78; x < 80; x += 1.1)
    box(x, 4.72, 38, 0.28, 0.13, 3, "#808786");
  box(-7, 4.15, 33.4, 26, 0.4, 4, "#d7d4c6");
  box(-7, 9, 33.4, 28, 0.45, 5.2, "#576767");
  for (const x of [-18, -7, 4]) box(x, 6.65, 33.4, 0.28, 4.8, 0.28, "#5b6c6b");
  sign(
    "HONEY SQUARE  ハニー広場",
    -7,
    8.25,
    35.99,
    18,
    1.15,
    "#465c57",
    "#e8dbaa",
  );
  for (let i = 0; i < 9; i++)
    box(-20 - i * 0.35, 3.8 - i * 0.38, 32.7, 0.7, 0.38, 2.7, "#c0c4bf");

  // Central garden and tiled fountain. Small details give the square its identity.
  box(-4, 0.43, 19, 22, 0.15, 22, "#bccbb0");
  box(-4, 0.53, 19, 5, 0.15, 22, "#ddd8c4");
  box(-4, 0.55, 19, 22, 0.15, 4.5, "#ddd8c4");
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(3.9, 3.9, 0.7, 12),
    geo.material("#b7c6c1"),
  );
  basin.position.set(-4, 0.9, 18);
  basin.castShadow = basin.receiveShadow = true;
  scene.add(basin);
  extraGeometries.add(basin.geometry);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: "#8dbbc2",
    transparent: true,
    opacity: 0.87,
    roughness: 0.21,
    metalness: 0.3,
  });
  extraMaterials.add(waterMaterial);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3.5, 0.1, 32),
    waterMaterial,
  );
  water.position.set(-4, 1.28, 18);
  scene.add(water);
  extraGeometries.add(water.geometry);
  geo.prop("cylinder", -4, 1.9, 18, 1.1, 1.6, 1.1, "#b1bcb1");
  geo.prop("cylinder", -4, 2.6, 18, 2.4, 0.3, 2.4, "#c8cec3");
  geo.prop("leaf", -4, 3.3, 18, 0.5, 0.95, 0.5, "#a9d4d2", 0, true);
  for (const dx of [-8.5, 8.5])
    for (const dz of [-8.5, 0, 8.5]) tree(-4 + dx, 18 + dz, dz === -8.5, 0.86);
  bench(-9, 23);
  bench(1, 23);
  bench(-9, 13, Math.PI);
  bench(1, 13, Math.PI);
  for (const x of [-14, 6]) {
    box(x, 0.7, 27.6, 3.4, 0.6, 0.75, "#ac9b7c");
    for (let n = 0; n < 9; n++) {
      geo.prop(
        "leaf",
        x - 1.4 + n * 0.35,
        1.05,
        27.6,
        0.28,
        0.35,
        0.28,
        "#789858",
      );
      box(
        x - 1.4 + n * 0.35,
        1.34,
        27.6,
        0.18,
        0.2,
        0.18,
        n % 2 ? "#dbb66a" : "#cb88a2",
      );
    }
  }
  for (const x of [-16, 8]) {
    box(x, 3.1, 8.8, 0.3, 5.5, 0.3, "#736c5a");
  }
  box(-4, 5.55, 8.8, 24.8, 0.7, 0.6, "#796f5b");
  sign("HONEY SQUARE", -4, 5.53, 9.13, 10, 0.65, "#ad9059", "#fff0c8");

  // Street trees, lamps, bins, hydrants, vending machines and market stalls.
  for (const z of [-8.2, 7.7])
    for (let x = -67; x < 71; x += 10)
      if (Math.abs(x + 37) > 6 && Math.abs(x - 37) > 6) {
        lamp(x, z, z > 0 ? 1 : -1);
        bollard(x - 2, z > 0 ? 6.3 : -6.4);
        bollard(x + 2, z > 0 ? 6.3 : -6.4);
      }
  for (const x of [-43, 43])
    for (let z = -64; z < 72; z += 17)
      if (Math.abs(z) > 10 && Math.abs(z - 44) > 10 && Math.abs(z + 44) > 10)
        lamp(x, z, x > 0 ? -1 : 1);
  for (const x of [-68, -53, -23, 5, 18, 30, 55, 67])
    tree(x, -8.9, x < -40, 0.8);
  for (const x of [-66, -53, -23, 17, 29, 57, 67]) tree(x, 9.5, x > 50, 0.85);
  for (const x of [-70, 70])
    for (let z = -60; z < 71; z += 14) tree(x, z, false, 0.9);
  for (const x of [-29, 29, 57, -65]) {
    bench(x, -9.3);
    box(x + 2.3, 1.1, -9.5, 0.7, 1.3, 0.7, "#6f8980");
    box(x + 2.3, 1.8, -9.5, 0.8, 0.1, 0.8, "#4c665e");
    geo.prop("cylinder", x - 2.1, 0.85, -7.3, 0.38, 1, 0.38, "#c37861");
    box(x - 2.1, 1.1, -7.3, 0.76, 0.18, 0.2, "#c37861");
  }
  function vending(x: number, z: number, color: string) {
    box(x, 1.6, z, 1.35, 2.5, 0.85, color);
    box(x - 0.1, 1.9, z + 0.45, 0.95, 1.5, 0.08, "#cde6e0", 0, true);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 4; j++)
        box(
          x - 0.46 + j * 0.24,
          1.45 + i * 0.45,
          z + 0.51,
          0.13,
          0.24,
          0.03,
          ["#edb954", "#779eb1", "#ce8b89"][j % 3],
        );
    box(x, 0.68, z + 0.48, 0.8, 0.21, 0.05, "#405255");
  }
  vending(-31, -9.9, "#c57465");
  vending(-29.4, -9.9, "#82adbc");
  vending(30.5, -10, "#83a792");
  vending(57, 11, "#b79bc0");
  for (const [x, z, color] of [
    [-14, 29, "#d4a25a"],
    [-8, 29, "#b57b94"],
    [0, 29, "#709a9d"],
    [7, 29, "#809b65"],
  ] as const) {
    box(x, 1.2, z, 3.3, 1.6, 1.65, "#b69165");
    for (const dx of [-1.45, 1.45])
      box(x + dx, 2.2, z, 0.13, 3.8, 0.13, "#7b6951");
    awning(x, z - 0.75, 3.65, color, 3.6);
    for (let n = 0; n < 7; n++)
      geo.prop(
        "leaf",
        x - 1.2 + n * 0.39,
        2.15,
        z + 0.45,
        0.25,
        0.3,
        0.25,
        n % 2 ? "#dca054" : "#9cab69",
      );
  }
  // Traffic lights at the crossings.
  for (const x of [-31.5, 31.5])
    for (const z of [-6.7, 6.7]) {
      box(x, 2.9, z, 0.2, 5, 0.2, "#616762");
      box(x, 5.2, z, 0.5, 1.3, 0.36, "#434c49");
      for (let n = 0; n < 3; n++)
        box(
          x,
          4.83 + n * 0.36,
          z + 0.19,
          0.23,
          0.23,
          0.05,
          n === 2 ? "#87b299" : n === 1 ? "#e3bd6a" : "#b77567",
          0,
          n === 2,
        );
    }

  function vehicle(color: string, bus = false) {
    const length = bus ? 6.8 : 3.2;
    const parts = [
      {
        position: [0, 0.58, 0] as [number, number, number],
        size: [length, 0.82, 1.55] as [number, number, number],
        color,
      },
      {
        position: [bus ? 0 : -0.1, bus ? 1.5 : 1.13, 0] as [
          number,
          number,
          number,
        ],
        size: [bus ? 6.2 : 1.8, bus ? 1.35 : 0.65, 1.45] as [
          number,
          number,
          number,
        ],
        color: bus ? "#e8dbaf" : color,
      },
      {
        position: [0.25, bus ? 1.54 : 1.2, 0] as [number, number, number],
        size: [bus ? 5.8 : 1.4, bus ? 0.8 : 0.45, 1.48] as [
          number,
          number,
          number,
        ],
        color: "#6a8f98",
      },
      {
        position: [0, bus ? 2.23 : 1.5, 0] as [number, number, number],
        size: [bus ? 6.5 : 1.8, 0.14, 1.57] as [number, number, number],
        color: bus ? "#d3b771" : color,
      },
    ];
    for (const x of [-length * 0.3, length * 0.3])
      for (const z of [-0.78, 0.78])
        parts.push({
          position: [x, 0.28, z],
          size: [0.53, 0.53, 0.18],
          color: "#3e4649",
        });
    parts.push({
      position: [length / 2, 0.6, 0],
      size: [0.05, 0.17, 1.2],
      color: "#f6e5bb",
    });
    parts.push({
      position: [-length / 2, 0.6, 0],
      size: [0.05, 0.17, 1.1],
      color: "#cd8173",
    });
    if (bus)
      for (let n = -2.5; n < 3; n += 0.85)
        parts.push({
          position: [n, 1.55, 0],
          size: [0.07, 0.95, 1.5],
          color: "#dec991",
        });
    return movingMesh(parts);
  }
  const carColors = [
    "#d6ac65",
    "#98b2ad",
    "#c38b7d",
    "#a8b4c1",
    "#ddd7c3",
    "#869baf",
  ];
  for (let i = 0; i < 24; i++) {
    const mesh = vehicle(carColors[i % carColors.length], i === 0 || i === 12);
    scene.add(mesh);
    extraGeometries.add(mesh.geometry);
    extraMaterials.add(mesh.material as THREE.Material);
    const axis = i < 16 ? "x" : "z";
    const direction = i % 2 ? 1 : -1;
    const lane =
      axis === "x"
        ? [0, -44, 44][Math.floor(i / 6) % 3] + direction * 2.5
        : [37, -37][i % 2] + (i % 3 ? 2.3 : -2.3);
    actors.push({
      mesh,
      axis,
      lane,
      speed: direction * (i === 0 ? 3.1 : 3.2 + random() * 2),
      offset: i * 13,
      extent: 76,
      height: 0.4,
    });
  }

  // A honey-colored city tram; all cars move as a single object.
  const trainParts: Parameters<typeof movingMesh>[0] = [];
  for (let car = 0; car < 3; car++) {
    const x = car * 7.1;
    trainParts.push(
      { position: [x, 1.2, 0], size: [6.8, 2.2, 2.7], color: "#d4c7a6" },
      { position: [x, 0.66, 0], size: [6.9, 0.5, 2.75], color: "#bfa163" },
      { position: [x, 2.41, 0], size: [7, 0.22, 2.8], color: "#7f918c" },
    );
    for (let n = 0; n < 5; n++)
      trainParts.push({
        position: [x - 2.5 + n * 1.2, 1.55, 0],
        size: [0.91, 0.8, 2.73],
        color: "#70949d",
      });
    for (const dx of [-2.2, 2.2])
      trainParts.push({
        position: [x + dx, 0.17, 0],
        size: [1, 0.3, 2.1],
        color: "#55605f",
      });
  }
  const train = movingMesh(trainParts);
  scene.add(train);
  extraGeometries.add(train.geometry);
  extraMaterials.add(train.material as THREE.Material);
  actors.push({
    mesh: train,
    axis: "x",
    lane: 38,
    speed: 5.3,
    offset: -30,
    extent: 100,
    height: 4.85,
  });

  // Small voxel citizens use shared geometry and materials.
  const citizens: THREE.Mesh[] = [];
  const clothes = [
    "#b77d67",
    "#88a5a1",
    "#d2b56d",
    "#8a91ae",
    "#a2809e",
    "#87a273",
  ];
  for (let v = 0; v < 6; v++) {
    const mesh = movingMesh([
      { position: [0, 1.06, 0], size: [0.42, 0.42, 0.38], color: "#d9b79a" },
      {
        position: [0, 1.3, 0],
        size: [0.45, 0.13, 0.43],
        color: v % 2 ? "#686052" : "#534e4a",
      },
      { position: [0, 0.67, 0], size: [0.48, 0.45, 0.3], color: clothes[v] },
      {
        position: [-0.31, 0.63, 0],
        size: [0.15, 0.42, 0.2],
        color: clothes[v],
      },
      { position: [0.31, 0.63, 0], size: [0.15, 0.42, 0.2], color: clothes[v] },
      {
        position: [-0.14, 0.27, 0],
        size: [0.18, 0.42, 0.24],
        color: "#526270",
      },
      { position: [0.14, 0.27, 0], size: [0.18, 0.42, 0.24], color: "#526270" },
    ]);
    citizens.push(mesh);
    extraGeometries.add(mesh.geometry);
    extraMaterials.add(mesh.material as THREE.Material);
  }
  for (let i = 0; i < 90; i++) {
    const mesh = citizens[i % citizens.length].clone();
    const scale = 0.85 + random() * 0.32;
    mesh.scale.setScalar(scale);
    scene.add(mesh);
    const axis = i < 62 ? "x" : "z";
    const lane =
      axis === "x"
        ? [8.7, -9.5, 32, -50][i % 4] + random() * 1.5
        : [30, -30, -68, 68][i % 4];
    actors.push({
      mesh,
      axis,
      lane,
      speed: (i % 2 ? 1 : -1) * (0.5 + random() * 0.5),
      offset: random() * 150,
      extent: axis === "x" ? 69 : 68,
      height: 0.55,
      pedestrian: true,
    });
  }

  // District view colors the pavement; ordinary city view keeps this hidden.
  for (const district of districts) {
    const material = new THREE.MeshBasicMaterial({
      color: district.color,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    extraMaterials.add(material);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 26), material);
    extraGeometries.add(mesh.geometry);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(district.position[0], 0.67, district.position[2]);
    mesh.visible = false;
    scene.add(mesh);
    overlays.push(mesh);
  }
  const beacon = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: "#edb84b",
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  extraMaterials.add(ringMaterial);
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.4, 48),
      ringMaterial,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.6 + i * 0.04;
    beacon.add(ring);
    extraGeometries.add(ring.geometry);
  }
  beacon.visible = false;
  scene.add(beacon);

  const nightLights: THREE.PointLight[] = [];
  for (const [x, z, color] of [
    [-15, -8, "#f5ce7a"],
    [22, -8, "#a7dfca"],
    [-4, 18, "#a7d4de"],
    [-50, 9, "#e3b4a2"],
    [48, 9, "#c9b9e9"],
  ] as const) {
    const light = new THREE.PointLight(color, 0, 22, 1.5);
    light.position.set(x, 4, z);
    scene.add(light);
    nightLights.push(light);
  }

  geo.finish();
  scene.add(geo.root);
  return {
    geometry: geo,
    actors,
    picks,
    overlays,
    water,
    beacon,
    nightLights,
    nightProps,
    dispose() {
      geo.dispose();
      extraGeometries.forEach((g) => g.dispose());
      extraMaterials.forEach((m) => m.dispose());
      picks.forEach((p) => {
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      });
    },
  };
}
