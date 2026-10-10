import * as THREE from "three";
import type { Resident } from "./explore";

import { characterCanvas } from "./portraits";

export interface CitizenSprite {
  resident: Resident;
  sprite: THREE.Sprite;
  shadow: THREE.Mesh;
  frames: THREE.SpriteMaterial[];
}
export class CharacterArt {
  private materials = new Map<number, THREE.SpriteMaterial[]>();
  private shadowGeometry = new THREE.CircleGeometry(0.65, 16);
  private shadowMaterial = new THREE.MeshBasicMaterial({
    color: "#233c50",
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  private labels = new Set<THREE.SpriteMaterial>();
  create(
    resident: Resident,
    root: THREE.Group,
    x = 0,
    y = 0.55,
    z = 0,
  ): CitizenSprite {
    let frames = this.materials.get(resident.look);
    if (!frames) {
      frames = [0, 1].map((frame) => {
        const map = new THREE.CanvasTexture(
          characterCanvas(resident.look, frame),
        );
        map.colorSpace = THREE.SRGBColorSpace;
        map.magFilter = THREE.NearestFilter;
        map.minFilter = THREE.NearestFilter;
        map.generateMipmaps = false;
        return new THREE.SpriteMaterial({
          map,
          alphaTest: 0.35,
          transparent: false,
          depthWrite: true,
          toneMapped: false,
        });
      });
      this.materials.set(resident.look, frames);
    }
    const sprite = new THREE.Sprite(frames[0]);
    sprite.center.set(0.5, 0);
    sprite.scale.set(1.65, 2.48, 1);
    sprite.position.set(x, y, z);
    sprite.userData = { kind: "resident", id: resident.id };
    root.add(sprite);
    const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1, 0.6, 1);
    shadow.position.set(x, y + 0.005, z);
    root.add(shadow);
    return { resident, sprite, shadow, frames };
  }
  bubble(text: string, root: THREE.Group, x: number, y: number, z: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 110;
    const c = canvas.getContext("2d")!;
    c.font = '500 25px "DM Sans"';
    c.fillStyle = "#263e4c";
    c.beginPath();
    c.roundRect(3, 3, 506, 84, 16);
    c.fill();
    c.fillStyle = "#fff7df";
    c.beginPath();
    c.roundRect(6, 6, 500, 78, 13);
    c.fill();
    c.beginPath();
    c.moveTo(72, 81);
    c.lineTo(72, 106);
    c.lineTo(102, 81);
    c.fill();
    c.fillStyle = "#354a51";
    c.textAlign = "center";
    c.fillText(text, 256, 53, 478);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map,
      depthWrite: false,
      toneMapped: false,
    });
    this.labels.add(material);
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(7, 1.5, 1);
    root.add(sprite);
    return sprite;
  }
  release(root: THREE.Group) {
    const remove: THREE.Sprite[] = [];
    root.traverse((obj) => {
      if (obj instanceof THREE.Sprite && this.labels.has(obj.material))
        remove.push(obj);
    });
    remove.forEach((obj) => {
      obj.material.map?.dispose();
      obj.material.dispose();
      this.labels.delete(obj.material);
      obj.parent?.remove(obj);
    });
  }
  dispose() {
    this.materials.forEach((frames) =>
      frames.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      }),
    );
    this.labels.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
    this.shadowGeometry.dispose();
    this.shadowMaterial.dispose();
  }
}
