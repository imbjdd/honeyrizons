import * as THREE from "three";
import type { Resident } from "./explore";
import { Figure, FigureFactory, styleForLook } from "./figure";

/** A resident in the 3D world: a voxel figure, its ground shadow, and the pick box that makes it clickable. */
export interface Citizen {
  resident: Resident;
  /** Position and heading live here; `userData` carries the pick data ({ kind, id, floor }). */
  body: THREE.Group;
  figure: Figure;
  shadow: THREE.Mesh;
}

export class CharacterArt {
  readonly figures = new FigureFactory();
  private shadowGeometry = new THREE.CircleGeometry(0.65, 16);
  private shadowMaterial = new THREE.MeshBasicMaterial({
    color: "#000000",
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  private labels = new Set<THREE.SpriteMaterial>();
  create(resident: Resident, root: THREE.Group, x = 0, y = 0.55, z = 0, scale = 1.2): Citizen {
    const figure = this.figures.create(styleForLook(resident.look), scale);
    const body = figure.root;
    body.position.set(x, y, z);
    body.rotation.y = Math.PI / 4;
    // The pick box and the body share one userData object, so `floor` set on either is visible to both.
    body.userData = { kind: "resident", id: resident.id };
    figure.hit.userData = body.userData;
    root.add(body);
    const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(scale * 0.8, scale * 0.6, 1);
    shadow.position.set(x, y + 0.005, z);
    root.add(shadow);
    return { resident, body, figure, shadow };
  }
  bubble(text: string, root: THREE.Group, x: number, y: number, z: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 110;
    const c = canvas.getContext("2d")!;
    c.font = '500 25px "Inter", sans-serif';
    c.fillStyle = "#1d4165";
    c.beginPath();
    c.roundRect(3, 3, 506, 84, 16);
    c.fill();
    c.fillStyle = "#edf6ff";
    c.beginPath();
    c.roundRect(6, 6, 500, 78, 13);
    c.fill();
    c.beginPath();
    c.moveTo(72, 81);
    c.lineTo(72, 106);
    c.lineTo(102, 81);
    c.fill();
    c.fillStyle = "#263e5a";
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
    this.figures.dispose();
    this.labels.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
    this.shadowGeometry.dispose();
    this.shadowMaterial.dispose();
  }
}
