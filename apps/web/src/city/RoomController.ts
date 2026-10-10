import * as THREE from "three";

export const FLOOR_HEIGHT = 4.8;
export const EYE_HEIGHT = 1.68;
export type WalkAction =
  | "forward"
  | "backward"
  | "left"
  | "right"
  | "turnLeft"
  | "turnRight"
  | "faster";
export interface RoomCollider {
  x: number;
  z: number;
  w: number;
  d: number;
  floor: number;
}
export interface RoomPlan {
  floors: number;
  colliders: RoomCollider[];
}
const bindings: Record<string, WalkAction | "interact"> = {
  w: "forward",
  z: "forward",
  ArrowUp: "forward",
  s: "backward",
  ArrowDown: "backward",
  a: "left",
  q: "left",
  d: "right",
  ArrowLeft: "turnLeft",
  ArrowRight: "turnRight",
  Shift: "faster",
  e: "interact",
  Enter: "interact",
};

/** Walking on floors and alternating stair flights. Every proposed step needs a reachable surface. */
export class RoomNavigation {
  position = new THREE.Vector3(0, 0, 8.4);
  yaw = 0;
  pitch = 0;
  floor = 0;
  constructor(public plan: RoomPlan) {}
  spawn(floor: number) {
    this.floor = floor;
    this.position.set(0, floor * FLOOR_HEIGHT, 8.4);
    this.yaw = 0;
    this.pitch = 0;
  }
  surface(x: number, z: number): number | null {
    if (Math.abs(x) > 12.65 || z < -9.65 || z > 10.8) return null;
    if (z > 9.65 && (this.floor !== 0 || Math.abs(x) > 1.8)) return null;
    const heights: number[] = [];
    if (this.plan.floors === 1 || x < 6.25 || Math.abs(z) >= 7.4)
      for (let i = 0; i < this.plan.floors; i++) heights.push(i * FLOOR_HEIGHT);
    for (let i = 0; i < this.plan.floors - 1; i++) {
      const center = i % 2 === 0 ? 10.75 : 7.9;
      if (Math.abs(x - center) > 1.25 || Math.abs(z) > 7.4) continue;
      const t = THREE.MathUtils.clamp(
        (i % 2 === 0 ? 7.4 - z : z + 7.4) / 14.8,
        0,
        1,
      );
      heights.push((i + t) * FLOOR_HEIGHT);
    }
    heights.sort(
      (a, b) => Math.abs(a - this.position.y) - Math.abs(b - this.position.y),
    );
    const height = heights[0];
    if (height === undefined || Math.abs(height - this.position.y) > 0.24)
      return null;
    const floor = Math.round(height / FLOOR_HEIGHT);
    const radius = 0.32;
    if (
      this.plan.colliders.some(
        (c) =>
          c.floor === floor &&
          Math.abs(x - c.x) < c.w / 2 + radius &&
          Math.abs(z - c.z) < c.d / 2 + radius,
      )
    )
      return null;
    return height;
  }
  step(dx: number, dz: number) {
    // Separate axes allow sliding along counters and walls.
    const xHeight = this.surface(this.position.x + dx, this.position.z);
    if (xHeight !== null) {
      this.position.x += dx;
      this.position.y = xHeight;
    }
    const zHeight = this.surface(this.position.x, this.position.z + dz);
    if (zHeight !== null) {
      this.position.z += dz;
      this.position.y = zHeight;
    }
    const nearest = Math.round(this.position.y / FLOOR_HEIGHT);
    if (Math.abs(this.position.y - nearest * FLOOR_HEIGHT) < 0.08)
      this.floor = nearest;
  }
  update(dt: number, actions: ReadonlySet<WalkAction>) {
    this.yaw +=
      ((actions.has("turnLeft") ? 1 : 0) - (actions.has("turnRight") ? 1 : 0)) *
      dt *
      1.55;
    let forward =
      Number(actions.has("forward")) - Number(actions.has("backward"));
    let sideways = Number(actions.has("right")) - Number(actions.has("left"));
    const length = Math.hypot(forward, sideways);
    if (!length) return;
    const speed = actions.has("faster") ? 5.2 : 3.5;
    forward *= (speed * dt) / length;
    sideways *= (speed * dt) / length;
    this.step(
      sideways * Math.cos(this.yaw) - forward * Math.sin(this.yaw),
      -forward * Math.cos(this.yaw) - sideways * Math.sin(this.yaw),
    );
  }
  look(dx: number, dy: number) {
    this.yaw -= dx * 0.0034;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0034, -1.15, 1.15);
  }
}

export class RoomController {
  camera = new THREE.PerspectiveCamera(68, 1, 0.07, 180);
  navigation: RoomNavigation;
  private actions = new Set<WalkAction>();
  enabled = false;
  constructor(
    plan: RoomPlan,
    private interact: () => void,
  ) {
    this.navigation = new RoomNavigation(plan);
    this.camera.rotation.order = "YXZ";
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.release);
    document.addEventListener("visibilitychange", this.release);
  }
  spawn(floor: number) {
    this.navigation.spawn(floor);
    this.release();
    this.update(0);
  }
  action(action: WalkAction, pressed: boolean) {
    if (pressed && this.enabled) this.actions.add(action);
    else this.actions.delete(action);
  }
  look(dx: number, dy: number) {
    if (this.enabled) this.navigation.look(dx, dy);
  }
  update(dt: number) {
    const x = this.camera.position.x,
      y = this.camera.position.y,
      z = this.camera.position.z,
      yaw = this.camera.rotation.y,
      pitch = this.camera.rotation.x;
    if (this.enabled) this.navigation.update(dt, this.actions);
    else this.release();
    this.camera.position.copy(this.navigation.position);
    this.camera.position.y += EYE_HEIGHT + 0.1;
    this.camera.rotation.set(this.navigation.pitch, this.navigation.yaw, 0);
    return (
      x !== this.camera.position.x ||
      y !== this.camera.position.y ||
      z !== this.camera.position.z ||
      yaw !== this.camera.rotation.y ||
      pitch !== this.camera.rotation.x
    );
  }
  release = () => {
    this.actions.clear();
  };
  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (
      target instanceof HTMLElement &&
      target.closest("input, textarea, select, button, [contenteditable=true]")
    )
      return;
    const action =
      bindings[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!action) return;
    event.preventDefault();
    if (action === "interact") {
      if (!event.repeat) this.interact();
    } else this.actions.add(action);
  };
  private onKeyUp = (event: KeyboardEvent) => {
    const action =
      bindings[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (action && action !== "interact") this.actions.delete(action);
  };
  dispose() {
    this.release();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.release);
    document.removeEventListener("visibilitychange", this.release);
  }
}
