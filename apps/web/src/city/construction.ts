// Construction sites: a building whose lure the city planner has decided to open, but which the honeypot does not serve
// yet, wears scaffolding and a crane until it does.
import * as THREE from "three";
import { getBuilding, type BuildingId } from "./explore";

const SCAFFOLD = "#ff9f1c";
const STEEL = "#3b4a5c";
/** Scaffold deck spacing, in world units. */
const LEVEL = 6;

interface Site {
  group: THREE.Group;
  jib: THREE.Group;
  beacon: THREE.Mesh;
  seed: number;
}

export class ConstructionSites {
  readonly group = new THREE.Group();
  private sites = new Map<BuildingId, Site>();
  private box = new THREE.BoxGeometry(1, 1, 1);
  private scaffold = new THREE.MeshStandardMaterial({ color: SCAFFOLD, emissive: SCAFFOLD, emissiveIntensity: 0.35, roughness: 0.6 });
  private steel = new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.5, metalness: 0.4 });
  private light = new THREE.MeshBasicMaterial({ color: "#ffcf4a", transparent: true });

  constructor(root: THREE.Group) {
    root.add(this.group);
  }

  sync(ids: BuildingId[]) {
    for (const [id, site] of this.sites) {
      if (ids.includes(id)) continue;
      this.group.remove(site.group);
      site.beacon.geometry.dispose();
      this.sites.delete(id);
    }
    for (const id of ids) if (!this.sites.has(id)) this.sites.set(id, this.build(id));
  }

  update(elapsed: number, moving: boolean) {
    for (const site of this.sites.values()) {
      if (moving) site.jib.rotation.y = Math.sin(elapsed * 0.25 + site.seed) * 1.2;
      // Blinks even when paused would be a lie about time passing; it holds steady instead.
      this.light.opacity = moving ? (Math.sin(elapsed * 5) > 0 ? 1 : 0.15) : 1;
    }
  }

  dispose() {
    this.sync([]);
    this.group.removeFromParent();
    this.box.dispose();
    this.scaffold.dispose();
    this.steel.dispose();
    this.light.dispose();
  }

  private bar(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const mesh = new THREE.Mesh(this.box, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private build(id: BuildingId): Site {
    const building = getBuilding(id);
    const [x, , z] = building.position;
    const { width, depth, height } = building.exterior;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const w = width + 2.4;
    const d = depth + 2.4;
    const top = height + 3;

    // Poles at the corners and along the long faces, decks every few metres.
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) this.bar(group, this.scaffold, (sx * w) / 2, top / 2, (sz * d) / 2, 0.3, top, 0.3);
    for (const sz of [-1, 1]) for (const fx of [-1 / 6, 1 / 6]) this.bar(group, this.scaffold, fx * w, top / 2, (sz * d) / 2, 0.22, top, 0.22);
    for (let y = LEVEL; y < top; y += LEVEL) {
      for (const sz of [-1, 1]) this.bar(group, this.scaffold, 0, y, (sz * d) / 2, w, 0.22, 0.6);
      for (const sx of [-1, 1]) this.bar(group, this.scaffold, (sx * w) / 2, y, 0, 0.6, 0.22, d);
    }

    // A tower crane beside the building, its jib turning over the roof.
    const mastX = w / 2 + 3;
    const mastH = top + 10;
    this.bar(group, this.steel, mastX, mastH / 2, -d / 4, 1, mastH, 1);
    const jib = new THREE.Group();
    jib.position.set(mastX, mastH, -d / 4);
    this.bar(jib, this.scaffold, -(w * 0.45), 0.5, 0, w * 1.2, 0.7, 0.9);
    this.bar(jib, this.steel, w * 0.2, 0.5, 0, 3, 1.4, 1.4);
    this.bar(jib, this.steel, -(w * 0.85), -3, 0, 0.08, 6, 0.08);
    group.add(jib);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), this.light);
    beacon.position.set(mastX, mastH + 1.8, -d / 4);
    group.add(beacon);

    // Barriers along the front door.
    const front = d / 2 + 2.2;
    for (let i = -2; i <= 2; i++) this.bar(group, i % 2 ? this.steel : this.scaffold, i * 2.2, 0.9, front, 2, 0.5, 0.2);

    this.group.add(group);
    return { group, jib, beacon, seed: id.length * 1.7 };
  }
}
