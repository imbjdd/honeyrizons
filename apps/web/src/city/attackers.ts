// Attackers as people in the city: every recent honeypot session walks the streets to the building of the service it
// targets, loiters at the door, leaves, and comes back later. New sessions arrive straight away.
import * as THREE from "three";
import { getBuilding, type BuildingId } from "./explore";
import { attackerStyle, FIGURE_HEIGHT, type Figure, type FigureFactory } from "./figure";

export type AttackerSeverity = "low" | "medium" | "high" | "critical";

export interface AttackerSpec {
  /** Session key; clicking the attacker opens this session. */
  id: string;
  building: BuildingId;
  severity: AttackerSeverity;
  /** AI agents (MCP sessions) are drawn as bots. */
  agent: boolean;
  /** Hover text. */
  label: string;
  /** Arrived in the last few minutes: skip the queue and walk in now. */
  fresh: boolean;
}

export const SEVERITY_GLOW: Record<AttackerSeverity, string> = {
  low: "#9aa3ad",
  medium: "#f2b54a",
  high: "#ff8a5b",
  critical: "#ff4f57",
};

/** Horizontal streets (constant z) and how far they run, matching the pedestrian lanes in world.ts. */
const STREETS_Z = [-48, -10, 2, 29, 41, 73];
const STREET_EXTENT = 86;
const SPEED = 2.4;
const HEIGHT = 0.65;
/** A touch larger than residents (1.2), so attackers stand out in the crowd. */
const SCALE = 1.35;
/** Marker size in world units at zoom 1 (about 20 px when the whole city is in view). */
const MARKER_SIZE = 3.2;

type Phase = "away" | "walk" | "loiter";

interface Attacker {
  spec: AttackerSpec;
  figure: Figure;
  halo: THREE.Mesh;
  /** Floating severity marker, so threats read from across the city (medium and above). */
  marker: THREE.Sprite | null;
  /** Shared by the pick box and the marker: { kind: "attacker", id, label }. */
  pick: { kind: "attacker"; id: string; label: string };
  path: THREE.Vector3[];
  leg: number;
  phase: Phase;
  /** Seconds left in the current away/loiter phase. */
  timer: number;
  /** Walking towards the door (true) or back out (false). */
  inbound: boolean;
  seed: number;
}

const hash = (text: string) => {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967295;
};

export class AttackerCrowd {
  readonly group = new THREE.Group();
  private attackers = new Map<string, Attacker>();
  private haloGeometry = new THREE.CircleGeometry(0.65, 20);
  private halos = new Map<AttackerSeverity, THREE.MeshBasicMaterial>();
  private markers = new Map<AttackerSeverity, THREE.SpriteMaterial>();
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.15, 32),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, depthWrite: false }),
  );
  private highlighted: string | null = null;

  constructor(
    root: THREE.Group,
    private figures: FigureFactory,
  ) {
    root.add(this.group);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.group.add(this.ring);
  }

  /** Pickable boxes around each attacker, for hover and click. */
  get picks(): THREE.Object3D[] {
    return [...this.attackers.values()].map((a) => a.figure.hit);
  }

  /** Markers float above the buildings, so they're picked before anything else. */
  get markerPicks(): THREE.Object3D[] {
    return [...this.attackers.values()].flatMap((a) => (a.marker?.visible ? [a.marker] : []));
  }

  sync(specs: AttackerSpec[]) {
    const wanted = new Map(specs.map((s) => [s.id, s]));
    for (const [id, attacker] of this.attackers) {
      if (!wanted.has(id)) this.remove(id, attacker);
    }
    specs.forEach((spec, index) => {
      const existing = this.attackers.get(spec.id);
      if (!existing) return this.add(spec, index);
      if (existing.spec.severity !== spec.severity || existing.spec.agent !== spec.agent) this.restyle(existing, spec);
      existing.spec = spec;
      existing.pick.label = spec.label;
    });
  }

  highlight(id: string | null) {
    this.highlighted = id;
  }

  /** `zoom` is the camera zoom: markers are scaled against it to keep a constant size on screen. */
  update(elapsed: number, dt: number, moving: boolean, zoom = 1) {
    const markerSize = MARKER_SIZE / zoom;
    if (!moving) dt = 0;
    for (const a of this.attackers.values()) {
      const body = a.figure.root;
      if (a.phase === "away") {
        a.timer -= dt;
        if (a.timer <= 0) this.depart(a, true);
      } else if (a.phase === "loiter") {
        a.timer -= dt;
        // Small pacing in front of the door, turning at each end.
        const door = a.path[a.path.length - 1];
        const t = elapsed * 0.9 + a.seed * 10;
        body.position.x = door.x + Math.sin(t) * 1.3;
        a.figure.face(Math.cos(t), 0);
        if (a.timer <= 0) this.depart(a, false);
      } else {
        this.walk(a, SPEED * dt);
      }
      a.figure.pose(elapsed * 9 + a.seed * 7, moving && a.phase !== "away");
      a.halo.position.set(body.position.x, HEIGHT + 0.01, body.position.z);
      // Serious threats breathe: the halo pulses and the marker bobs above the head.
      const serious = a.spec.severity === "high" || a.spec.severity === "critical";
      const beat = moving ? Math.sin(elapsed * 3 + a.seed * 6) : 0;
      a.halo.scale.set(1.6 + (serious ? beat * 0.25 : 0), 1 + (serious ? beat * 0.16 : 0), 1);
      if (a.marker) {
        a.marker.visible = body.visible;
        a.marker.position.set(body.position.x, HEIGHT + FIGURE_HEIGHT * SCALE + 1.2 + beat * 0.15, body.position.z);
        a.marker.scale.set(markerSize, markerSize, 1);
      }
    }
    const target = this.highlighted ? this.attackers.get(this.highlighted) : undefined;
    this.ring.visible = !!target && target.figure.root.visible;
    if (target) {
      this.ring.position.set(target.figure.root.position.x, HEIGHT + 0.02, target.figure.root.position.z);
      (this.ring.material as THREE.MeshBasicMaterial).color.set(SEVERITY_GLOW[target.spec.severity]);
      this.ring.scale.setScalar(1.2 + Math.sin(elapsed * 4) * 0.08);
    }
  }

  dispose() {
    for (const [id, a] of this.attackers) this.remove(id, a);
    this.markers.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
    this.haloGeometry.dispose();
    this.halos.forEach((m) => m.dispose());
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }

  private add(spec: AttackerSpec, index: number) {
    const pick = { kind: "attacker" as const, id: spec.id, label: spec.label };
    const figure = this.figure(spec, pick);
    const halo = new THREE.Mesh(this.haloGeometry, this.halo(spec.severity));
    halo.rotation.x = -Math.PI / 2;
    this.group.add(figure.root, halo);
    const marker = this.marker(spec.severity, pick);
    if (marker) this.group.add(marker);
    const seed = hash(spec.id);
    const attacker: Attacker = { spec, figure, halo, marker, pick, path: [], leg: 0, phase: "away", timer: 0, inbound: true, seed };
    this.attackers.set(spec.id, attacker);
    if (spec.fresh) {
      // A new session walks in from the edge right now.
      this.hide(attacker);
      return;
    }
    // Everyone else starts somewhere along their way, so the city is already busy when the page opens.
    this.depart(attacker, true);
    const start = figure.root.position.clone();
    const length = attacker.path.reduce((sum, point, i) => sum + point.distanceTo(i === 0 ? start : attacker.path[i - 1]), 0);
    this.walk(attacker, length * ((index * 0.618 + seed) % 1.25));
  }

  /** Severity or kind changed: swap the figure, halo and marker, keeping position and heading. */
  private restyle(a: Attacker, spec: AttackerSpec) {
    const previous = a.figure.root;
    a.figure = this.figure(spec, a.pick);
    a.figure.root.position.copy(previous.position);
    a.figure.root.rotation.copy(previous.rotation);
    a.figure.root.visible = previous.visible;
    previous.removeFromParent();
    this.group.add(a.figure.root);
    a.halo.material = this.halo(spec.severity);
    a.marker?.removeFromParent();
    a.marker = this.marker(spec.severity, a.pick);
    if (a.marker) this.group.add(a.marker);
  }

  private figure(spec: AttackerSpec, pick: Attacker["pick"]) {
    const figure = this.figures.create(attackerStyle(spec.agent, SEVERITY_GLOW[spec.severity]), SCALE);
    figure.root.userData = pick;
    figure.hit.userData = pick;
    return figure;
  }

  private hide(a: Attacker) {
    a.figure.root.visible = a.halo.visible = false;
  }

  /** Moves along the current path, facing the way it goes; arriving at the door starts loitering. */
  private walk(a: Attacker, distance: number) {
    const body = a.figure.root;
    let remaining = distance;
    while (remaining > 0 && a.leg < a.path.length) {
      const target = a.path[a.leg];
      const toTarget = target.clone().sub(body.position).setY(0);
      const length = toTarget.length();
      if (length > 1e-4) a.figure.face(toTarget.x, toTarget.z);
      if (length <= remaining) {
        body.position.set(target.x, HEIGHT, target.z);
        remaining -= length;
        a.leg++;
      } else {
        body.position.addScaledVector(toTarget.normalize(), remaining);
        remaining = 0;
      }
    }
    if (a.leg < a.path.length) return;
    if (a.inbound) {
      a.phase = "loiter";
      a.timer = 6 + a.seed * 6;
    } else {
      a.phase = "away";
      a.timer = 4 + a.seed * 10;
      this.hide(a);
    }
  }

  private remove(id: string, a: Attacker) {
    a.figure.root.removeFromParent();
    a.halo.removeFromParent();
    a.marker?.removeFromParent();
    this.attackers.delete(id);
    if (this.highlighted === id) this.highlighted = null;
  }

  /** Builds the next walk: from a street end to the door, or from the door back out the other way. */
  private depart(a: Attacker, inbound: boolean) {
    const building = getBuilding(a.spec.building);
    const [bx, , bz] = building.position;
    const front = bz + building.exterior.depth / 2;
    const door = new THREE.Vector3(bx + (a.seed - 0.5) * 2.4, HEIGHT, front + 1.6);
    // The street running in front of the door.
    const street = STREETS_Z.reduce((best, z) => (Math.abs(z - front) < Math.abs(best - front) ? z : best), STREETS_Z[0]);
    const corner = new THREE.Vector3(door.x, HEIGHT, street);
    const side = (inbound ? a.seed : 1 - a.seed) < 0.5 ? -1 : 1;
    const edge = new THREE.Vector3(side * STREET_EXTENT, HEIGHT, street + (a.seed - 0.5) * 1.5);
    a.path = inbound ? [corner, door] : [corner, edge];
    if (inbound) a.figure.root.position.copy(edge);
    a.leg = 0;
    a.inbound = inbound;
    a.phase = "walk";
    a.seed = (a.seed + 0.37) % 1;
    a.figure.root.visible = a.halo.visible = true;
  }

  /** A small glowing diamond in the severity color; low-severity noise gets none. */
  private marker(severity: AttackerSeverity, pick: Attacker["pick"]) {
    if (severity === "low") return null;
    let material = this.markers.get(severity);
    if (!material) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      const c = canvas.getContext("2d")!;
      c.fillStyle = SEVERITY_GLOW[severity];
      c.beginPath();
      c.moveTo(16, 3);
      c.lineTo(28, 16);
      c.lineTo(16, 29);
      c.lineTo(4, 16);
      c.closePath();
      c.fill();
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      // Drawn over the buildings, like a quest marker: streets are narrow canyons and attackers often stand behind towers.
      material = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
      this.markers.set(severity, material);
    }
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 10;
    sprite.visible = false;
    sprite.userData = pick;
    return sprite;
  }

  private halo(severity: AttackerSeverity) {
    let material = this.halos.get(severity);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: SEVERITY_GLOW[severity], transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
      this.halos.set(severity, material);
    }
    return material;
  }
}
