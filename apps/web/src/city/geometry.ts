import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Primitive = "box" | "leaf" | "cylinder";
interface Batch {
  geometry: Primitive;
  material: THREE.MeshStandardMaterial;
  matrices: THREE.Matrix4[];
}

/** Static props share geometry and material and are merged into one draw per batch. */
export class CityGeometry {
  readonly root = new THREE.Group();
  readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  readonly textures = new Set<THREE.Texture>();
  readonly windows: THREE.MeshStandardMaterial[] = [];
  private batches = new Map<string, Batch>();
  private transform = new THREE.Object3D();
  private primitives = {
    box: new THREE.BoxGeometry(1, 1, 1),
    leaf: new THREE.IcosahedronGeometry(1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 24),
  };

  material(color: string, glow = false) {
    const key = `${color}-${glow}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.86,
        metalness: 0.02,
        ...(glow ? { emissive: color, emissiveIntensity: 0.15 } : {}),
      });
      this.materials.set(key, material);
      if (glow) this.windows.push(material);
    }
    return material;
  }

  prop(
    kind: Primitive,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    rotation = 0,
    glow = false,
  ) {
    const material = this.material(color, glow);
    const key = `${kind}-${material.uuid}`;
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { geometry: kind, material, matrices: [] };
      this.batches.set(key, batch);
    }
    this.transform.position.set(x, y, z);
    this.transform.scale.set(w, h, d);
    this.transform.rotation.set(0, rotation, 0);
    this.transform.updateMatrix();
    batch.matrices.push(this.transform.matrix.clone());
  }

  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    rotation = 0,
    glow = false,
  ) {
    this.prop("box", x, y, z, w, h, d, color, rotation, glow);
  }

  sign(
    text: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    background: string,
    color = "#fff2cd",
    rotation = 0,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = Math.max(64, Math.round((512 * height) / width));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
    const lines = text.split("\n");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = canvas.height / (lines.length * 1.7);
    ctx.font = `600 ${size}px "JetBrains Mono", monospace`;
    while (
      Math.max(...lines.map((line) => ctx.measureText(line).width)) > 470 &&
      size > 8
    ) {
      size -= 1;
      ctx.font = `600 ${size}px "JetBrains Mono", monospace`;
    }
    ctx.fillStyle = color;
    lines.forEach((line, i) =>
      ctx.fillText(line, 256, (canvas.height * (i + 0.5)) / lines.length),
    );
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.textures.add(texture);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      emissiveMap: texture,
      emissive: 0xffffff,
      emissiveIntensity: 0.18,
    });
    this.materials.set(material.uuid, material);
    this.windows.push(material);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    this.root.add(mesh);
    return mesh;
  }

  finish() {
    for (const batch of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(
        this.primitives[batch.geometry],
        batch.material,
        batch.matrices.length,
      );
      batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.root.add(mesh);
    }
    this.batches.clear();
  }

  dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) geometries.add(obj.geometry);
    });
    Object.values(this.primitives).forEach((g) => geometries.add(g));
    geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}

/** Merge a moving prop's colored parts to avoid one draw call for every voxel. */
export function movingMesh(
  parts: {
    position: [number, number, number];
    size: [number, number, number];
    color: string;
  }[],
) {
  const geometries = parts.map((part) => {
    const geometry = new THREE.BoxGeometry(...part.size);
    geometry.translate(...part.position);
    const color = new THREE.Color(part.color);
    const values = new Float32Array(
      geometry.getAttribute("position").count * 3,
    );
    for (let i = 0; i < values.length; i += 3) {
      values[i] = color.r;
      values[i + 1] = color.g;
      values[i + 2] = color.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
    return geometry;
  });
  const geometry = mergeGeometries(geometries)!;
  geometries.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
  );
  mesh.castShadow = true;
  return mesh;
}

export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
