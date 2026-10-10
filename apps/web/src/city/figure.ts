// Voxel people for the city: blocky 3D figures that match the architecture, with jointed arms and legs for walking.
// Geometry is merged per look (vertex colors, one shared material) so a hundred people stay cheap to draw.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MAYOR_LOOK } from "./portraits";

export type FigureKind = "person" | "bot" | "hood" | "agent";

export interface FigureStyle {
  kind: FigureKind;
  outfit: string;
  skin: string;
  hair: string;
  pants: string;
  shoes: string;
  cap?: boolean;
  glasses?: boolean;
  backpack?: boolean;
  /** White shirt and tie over the jacket instead of the side stripe. */
  suit?: boolean;
  /** Glowing eyes or visor for attackers, in their severity color. */
  glow?: string;
}

// Same palette as the residents' pixel portraits, so a person looks like their portrait in the inspector.
const OUTFITS = ["#ffcc00", "#ff278d", "#a345ff", "#00cbff", "#74ef24", "#ff6320", "#00e6b5", "#ff3155", "#326bff", "#15efff", "#fc4cf1", "#adf52c"];
const SKINS = ["#edc29a", "#b47d59", "#efd1b7", "#cc9b76", "#9b674d", "#ddb08b"];
const HAIR = ["#4a3837", "#263e4d", "#e0cfb4", "#5d4840"];
const BOT_LOOKS = new Set([13, 15, 19, 25]);

export function styleForLook(look: number): FigureStyle {
  if (look === MAYOR_LOOK) {
    return { kind: "person", outfit: "#1d2a44", skin: "#e6c09a", hair: "#3a2e28", pants: "#1d2a44", shoes: "#111418", suit: true };
  }
  return {
    kind: BOT_LOOKS.has(look) ? "bot" : "person",
    outfit: OUTFITS[look % OUTFITS.length],
    skin: SKINS[look % SKINS.length],
    hair: HAIR[look % HAIR.length],
    pants: "#283d50",
    shoes: "#1c2530",
    cap: look % 3 === 0,
    glasses: look % 4 === 1,
    backpack: look === 1 || look === 8,
  };
}

export function attackerStyle(agent: boolean, glow: string): FigureStyle {
  return agent
    ? { kind: "agent", outfit: "#3a4654", skin: "#c9d2dc", hair: "#c9d2dc", pants: "#2a333d", shoes: "#14191f", glow }
    : { kind: "hood", outfit: "#22282f", skin: "#3a2f2a", hair: "#22282f", pants: "#161a1f", shoes: "#0b0d10", glow };
}

/** Height of a figure at scale 1, feet at y = 0. */
export const FIGURE_HEIGHT = 2.25;

type Part = { size: [number, number, number]; at: [number, number, number]; color: string };

function bake(parts: Part[]) {
  const color = new THREE.Color();
  const geometries = parts.map(({ size, at, color: hex }) => {
    const geometry = new THREE.BoxGeometry(...size).toNonIndexed();
    geometry.translate(...at);
    color.set(hex).convertSRGBToLinear();
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([color.r, color.g, color.b], i);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  });
  const merged = mergeGeometries(geometries)!;
  geometries.forEach((g) => g.dispose());
  return merged;
}

interface FigureGeometry {
  body: THREE.BufferGeometry;
  arm: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
  glow: THREE.BufferGeometry | null;
}

// Joint heights.
const HIP = 0.62;
const SHOULDER = 1.3;

function buildGeometry(style: FigureStyle): FigureGeometry {
  const { outfit, skin, hair, pants, shoes } = style;
  const ink = "#141a20";
  const robot = style.kind === "bot" || style.kind === "agent";
  const parts: Part[] = [
    // Torso with a front stripe, like the jacket in the pixel art.
    { size: [0.78, 0.72, 0.44], at: [0, 0.98, 0], color: outfit },
    // Attackers wear their severity on the hoodie's zip; residents get the jacket's white stripe, the mayor a shirt and tie.
    ...(style.suit
      ? [
          { size: [0.28, 0.6, 0.02], at: [0, 1.04, 0.225], color: "#f2f4f7" } satisfies Part,
          { size: [0.09, 0.46, 0.025], at: [0, 1.02, 0.235], color: "#b3262e" } satisfies Part,
        ]
      : [{ size: [0.1, 0.5, 0.02], at: [-0.18, 1.0, 0.225], color: style.kind === "hood" ? (style.glow ?? "#30363e") : "#ffffff" } satisfies Part]),
    { size: [0.8, 0.08, 0.46], at: [0, 0.64, 0], color: pants },
  ];

  if (robot) {
    parts.push(
      { size: [0.8, 0.72, 0.72], at: [0, 1.72, 0], color: skin },
      { size: [0.64, 0.3, 0.02], at: [0, 1.74, 0.365], color: ink },
      { size: [0.06, 0.24, 0.06], at: [0, 2.2, 0], color: skin },
      { size: [0.14, 0.1, 0.14], at: [0, 2.34, 0], color: style.glow ?? outfit },
      { size: [0.08, 0.26, 0.26], at: [-0.44, 1.72, 0], color: outfit },
      { size: [0.08, 0.26, 0.26], at: [0.44, 1.72, 0], color: outfit },
    );
    if (style.kind === "bot") parts.push({ size: [0.12, 0.1, 0.02], at: [-0.14, 1.75, 0.378], color: "#00edff" }, { size: [0.12, 0.1, 0.02], at: [0.14, 1.75, 0.378], color: "#00edff" });
  } else if (style.kind === "hood") {
    parts.push(
      { size: [0.84, 0.8, 0.76], at: [0, 1.74, -0.02], color: outfit },
      { size: [0.56, 0.48, 0.03], at: [0, 1.7, 0.36], color: "#07090b" },
      { size: [0.3, 0.2, 0.3], at: [0, 1.4, -0.42], color: outfit },
    );
  } else {
    parts.push(
      { size: [0.74, 0.7, 0.68], at: [0, 1.72, 0], color: skin },
      { size: [0.1, 0.13, 0.02], at: [-0.16, 1.74, 0.345], color: ink },
      { size: [0.1, 0.13, 0.02], at: [0.16, 1.74, 0.345], color: ink },
      { size: [0.18, 0.04, 0.02], at: [0, 1.55, 0.345], color: "#b57a6f" },
      // Hair: top, back and a fringe.
      { size: [0.78, 0.18, 0.72], at: [0, 2.1, 0], color: hair },
      { size: [0.78, 0.66, 0.14], at: [0, 1.78, -0.3], color: hair },
      { size: [0.78, 0.12, 0.1], at: [0, 1.99, 0.31], color: hair },
    );
    if (style.cap) parts.push({ size: [0.8, 0.16, 0.76], at: [0, 2.16, 0], color: outfit }, { size: [0.52, 0.06, 0.3], at: [0, 2.08, 0.46], color: outfit });
    if (style.glasses)
      parts.push(
        { size: [0.66, 0.06, 0.03], at: [0, 1.78, 0.355], color: ink },
        { size: [0.2, 0.14, 0.03], at: [-0.16, 1.74, 0.36], color: "#00eaff" },
        { size: [0.2, 0.14, 0.03], at: [0.16, 1.74, 0.36], color: "#00eaff" },
      );
  }
  if (style.backpack) parts.push({ size: [0.52, 0.56, 0.2], at: [0, 1.02, -0.32], color: "#e4bd72" });

  // Limbs are built hanging from their joint at the origin, so rotating them swings them.
  const arm = bake([
    { size: [0.22, 0.5, 0.24], at: [0, -0.25, 0], color: outfit },
    { size: [0.2, 0.16, 0.22], at: [0, -0.58, 0], color: robot ? skin : style.kind === "hood" ? skin : skin },
  ]);
  const leg = bake([
    { size: [0.3, 0.5, 0.32], at: [0, -0.25, 0], color: pants },
    { size: [0.32, 0.13, 0.42], at: [0, -0.56, 0.04], color: shoes },
  ]);

  // Attacker eyes and visors glow with their severity, so they get their own unlit mesh.
  let glow: THREE.BufferGeometry | null = null;
  if (style.glow && style.kind === "hood") {
    glow = bake([
      { size: [0.12, 0.08, 0.02], at: [-0.13, 1.74, 0.38], color: "#ffffff" },
      { size: [0.12, 0.08, 0.02], at: [0.13, 1.74, 0.38], color: "#ffffff" },
    ]);
  } else if (style.glow && style.kind === "agent") {
    glow = bake([{ size: [0.54, 0.12, 0.02], at: [0, 1.75, 0.378], color: "#ffffff" }]);
  }

  return { body: bake(parts), arm, leg, glow };
}

export class Figure {
  readonly root = new THREE.Group();
  /** Invisible box for picking: thin limbs are hard to click on. */
  readonly hit: THREE.Mesh;
  private inner = new THREE.Group();
  private arms: THREE.Mesh[];
  private legs: THREE.Mesh[];

  constructor(geometry: FigureGeometry, material: THREE.Material, glowMaterial: THREE.Material | null, pickMaterial: THREE.Material, hitGeometry: THREE.BufferGeometry) {
    const body = new THREE.Mesh(geometry.body, material);
    body.castShadow = true;
    this.inner.add(body);
    this.arms = [-0.5, 0.5].map((x) => {
      const arm = new THREE.Mesh(geometry.arm, material);
      arm.position.set(x, SHOULDER, 0);
      this.inner.add(arm);
      return arm;
    });
    this.legs = [-0.17, 0.17].map((x) => {
      const leg = new THREE.Mesh(geometry.leg, material);
      leg.position.set(x, HIP, 0);
      this.inner.add(leg);
      return leg;
    });
    if (geometry.glow && glowMaterial) this.inner.add(new THREE.Mesh(geometry.glow, glowMaterial));
    this.root.add(this.inner);
    this.hit = new THREE.Mesh(hitGeometry, pickMaterial);
    this.hit.position.y = FIGURE_HEIGHT / 2;
    this.root.add(this.hit);
  }

  /** Walk cycle driven by a phase in radians; standing still relaxes the limbs. */
  pose(phase: number, walking: boolean) {
    const swing = walking ? Math.sin(phase) * 0.6 : 0;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = -swing * 0.8;
    this.arms[1].rotation.x = swing * 0.8;
    this.inner.position.y = walking ? Math.abs(Math.cos(phase)) * 0.05 : 0;
  }

  /** Turns to face a horizontal direction (figures face +z by default). */
  face(dx: number, dz: number) {
    if (dx || dz) this.root.rotation.y = Math.atan2(dx, dz);
  }
}

export class FigureFactory {
  // Slightly over-bright base color so people read against the night-lit streets.
  private material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02, color: new THREE.Color(1.35, 1.35, 1.35) });
  private glowMaterials = new Map<string, THREE.MeshBasicMaterial>();
  // Invisible but raycastable: drawn with no color or depth writes.
  private pickMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  private hitGeometry = new THREE.BoxGeometry(0.95, FIGURE_HEIGHT, 0.95);
  private geometries = new Map<string, FigureGeometry>();

  create(style: FigureStyle, scale = 1) {
    const key = JSON.stringify(style);
    let geometry = this.geometries.get(key);
    if (!geometry) {
      geometry = buildGeometry(style);
      this.geometries.set(key, geometry);
    }
    const figure = new Figure(geometry, this.material, style.glow ? this.glow(style.glow) : null, this.pickMaterial, this.hitGeometry);
    figure.root.scale.setScalar(scale);
    return figure;
  }

  dispose() {
    this.geometries.forEach((g) => [g.body, g.arm, g.leg, g.glow].forEach((geometry) => geometry?.dispose()));
    this.glowMaterials.forEach((m) => m.dispose());
    this.material.dispose();
    this.pickMaterial.dispose();
    this.hitGeometry.dispose();
  }

  private glow(color: string) {
    let material = this.glowMaterials.get(color);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      this.glowMaterials.set(color, material);
    }
    return material;
  }
}
