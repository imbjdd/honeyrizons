import { describe, expect, test } from "bun:test";
import {
  FLOOR_HEIGHT,
  RoomNavigation,
  type WalkAction,
} from "../apps/web/src/city/RoomController";
const held = (...actions: WalkAction[]) => new Set(actions);
function walk(nav: RoomNavigation, dx: number, dz: number, count: number) {
  for (let i = 0; i < count; i++) nav.step(dx, dz);
}
describe("indoor walking", () => {
  test("walls and furniture stop the player; separate axes slide along furniture", () => {
    const nav = new RoomNavigation({
      floors: 1,
      colliders: [{ x: 0, z: 0, w: 4, d: 2, floor: 0 }],
    });
    nav.position.set(0, 0, 3);
    walk(nav, 0, -0.1, 80);
    expect(nav.position.z).toBeGreaterThanOrEqual(1.32);
    nav.step(0.15, -0.1);
    expect(nav.position.x).toBeCloseTo(0.15);
    walk(nav, 0.1, 0, 200);
    expect(nav.position.x).toBeLessThanOrEqual(12.65);
  });
  test("alternating stairs reach all three floors and return to the ground", () => {
    const nav = new RoomNavigation({ floors: 3, colliders: [] });
    nav.position.set(10.75, 0, 8.4);
    walk(nav, 0, -0.1, 164);
    expect(nav.floor).toBe(1);
    expect(nav.position.y).toBeCloseTo(FLOOR_HEIGHT);
    walk(nav, -0.05, 0, 57);
    walk(nav, 0, 0.1, 164);
    expect(nav.floor).toBe(2);
    expect(nav.position.y).toBeCloseTo(FLOOR_HEIGHT * 2);
    walk(nav, 0, -0.1, 164);
    expect(nav.floor).toBe(1);
    walk(nav, 0.05, 0, 57);
    walk(nav, 0, 0.1, 164);
    expect(nav.floor).toBe(0);
    expect(nav.position.y).toBeCloseTo(0);
  });
  test("the stairwell cannot be entered from the side or fallen into", () => {
    const nav = new RoomNavigation({ floors: 3, colliders: [] });
    nav.position.set(5, 0, 0);
    walk(nav, 0.1, 0, 100);
    expect(nav.position.x).toBeLessThan(6.3);
    expect(nav.position.y).toBe(0);
  });
  test("walking is frame-rate independent and diagonals are normalized", () => {
    const a = new RoomNavigation({ floors: 1, colliders: [] });
    const b = new RoomNavigation({ floors: 1, colliders: [] });
    a.position.set(0, 0, 0);
    b.position.set(0, 0, 0);
    for (let i = 0; i < 60; i++) a.update(1 / 60, held("forward"));
    for (let i = 0; i < 30; i++) b.update(1 / 30, held("forward", "right"));
    expect(a.position.length()).toBeCloseTo(3.5);
    expect(b.position.length()).toBeCloseTo(3.5);
  });
  test("look clamps pitch; only the ground-floor doorway allows exit", () => {
    const nav = new RoomNavigation({ floors: 3, colliders: [] });
    nav.look(1000, 100000);
    expect(nav.pitch).toBe(-1.15);
    nav.look(0, -100000);
    expect(nav.pitch).toBe(1.15);
    expect(nav.surface(0, 10.5)).toBe(0);
    expect(nav.surface(3, 10.5)).toBeNull();
    nav.spawn(1);
    expect(nav.surface(0, 10.5)).toBeNull();
  });
});
