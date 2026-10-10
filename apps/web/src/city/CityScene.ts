import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildWorld, type CityWorld } from "./world";
import {
  districts,
  type CityHandle,
  type CityOptions,
  type Protocol,
} from "./model";

export class CityScene implements CityHandle {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-50, 50, 35, -35, 0.1, 500);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private world: CityWorld;
  private sun = new THREE.DirectionalLight(0xfff1d5, 2.6);
  private ambient = new THREE.HemisphereLight(0xe8eff4, 0xa99a79, 2);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private observer: ResizeObserver;
  private options: CityOptions;
  private target: THREE.Vector3 | null = null;
  private targetZoom: number | null = null;
  private angle: number | null = null;
  private touring = false;
  private elapsed = 0;
  private lastTime = 0;
  private pointerDown = { x: 0, y: 0 };
  private disposed = false;
  private pulseTime = -100;
  private frame = 0;
  private dirty = true;

  constructor(
    private canvas: HTMLCanvasElement,
    options: CityOptions,
  ) {
    this.options = options;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.camera.position.set(82, 92, 104);
    this.camera.lookAt(-3, 13, 0);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(-3, 13, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.45;
    this.controls.zoomSpeed = 0.65;
    this.controls.panSpeed = 0.65;
    this.controls.minZoom = 0.5;
    this.controls.maxZoom = 3.5;
    this.controls.minPolarAngle = Math.PI / 7;
    this.controls.maxPolarAngle = Math.PI / 2.5;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    };
    this.controls.addEventListener("start", this.cancelTransition);
    this.sun.position.set(-45, 85, 45);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -105,
      right: 105,
      top: 105,
      bottom: -105,
      near: 1,
      far: 240,
    });
    this.sun.shadow.normalBias = 0.08;
    this.sun.shadow.bias = -0.0002;
    this.scene.add(this.sun, this.ambient);
    this.scene.fog = new THREE.Fog(0xdde3e1, 175, 330);
    this.world = buildWorld(this.scene);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(1280, 800),
      0.28,
      0.4,
      1.1,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas.parentElement!);
    this.resize();
    this.update(options);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.renderer.setAnimationLoop(this.animate);
  }

  update(options: CityOptions) {
    const changed = this.options.theme !== options.theme;
    this.options = options;
    this.dirty = true;
    const night = options.theme === "night";
    this.scene.background = new THREE.Color(night ? "#1b253c" : "#dfe5e2");
    (this.scene.fog as THREE.Fog).color.copy(this.scene.background);
    this.ambient.color.set(night ? "#9cb1e5" : "#e8eff4");
    this.ambient.groundColor.set(night ? "#666d8c" : "#a99a79");
    this.ambient.intensity = night ? 0.95 : 1.5;
    this.sun.color.set(night ? "#b3c5ea" : "#fff1d5");
    this.sun.intensity = night ? 0.55 : 2.2;
    this.renderer.toneMappingExposure = night ? 1.2 : 1.08;
    this.world.geometry.windows.forEach((m) => {
      m.emissiveIntensity = night ? 0.75 : 0.13;
    });
    this.world.nightLights.forEach((light) => {
      light.intensity = night ? 18 : 0;
    });
    this.world.nightProps.visible = night;
    this.world.overlays.forEach((overlay) => {
      overlay.visible =
        options.view === "protocols" || options.view === "threats";
      (overlay.material as THREE.MeshBasicMaterial).opacity =
        options.view === "threats" ? 0.13 : 0.3;
    });
    this.world.actors.forEach((actor) => {
      actor.mesh.visible = options.view !== "traffic" || !actor.pedestrian;
    });
    if (options.reducedMotion) this.touring = false;
    if (changed) this.renderer.shadowMap.needsUpdate = true;
  }

  zoom(direction: number) {
    this.targetZoom = THREE.MathUtils.clamp(
      (this.targetZoom ?? this.camera.zoom) * (direction > 0 ? 1.22 : 0.82),
      0.5,
      3.5,
    );
  }
  rotate(direction: number) {
    this.touring = false;
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.angle = Math.atan2(offset.x, offset.z) + (direction * Math.PI) / 4;
  }
  home() {
    this.touring = false;
    this.target = new THREE.Vector3(-3, 13, 0);
    this.targetZoom = 1;
    this.angle = Math.atan2(85, 104);
  }
  focus(protocol: Protocol) {
    const district = districts.find((d) => d.id === protocol)!;
    this.touring = false;
    this.target = new THREE.Vector3(
      district.position[0],
      4,
      district.position[2],
    );
    this.targetZoom = 1.55;
    this.pulse(protocol);
  }
  tour(enabled: boolean) {
    this.touring = enabled && !this.options.reducedMotion;
    if (this.touring) {
      this.targetZoom = 0.86;
      this.target = new THREE.Vector3(-3, 9, 0);
    }
  }
  pulse(protocol: Protocol) {
    const district = districts.find((d) => d.id === protocol)!;
    this.world.beacon.position.set(
      district.position[0],
      0,
      district.position[2] + 9,
    );
    (
      this.world.beacon.children[0] as THREE.Mesh<
        THREE.RingGeometry,
        THREE.MeshBasicMaterial
      >
    ).material.color.set(district.color);
    this.pulseTime = this.elapsed;
  }

  capture() {
    try {
      this.render();
      const photo = document.createElement("canvas");
      photo.width = this.canvas.width;
      photo.height = this.canvas.height;
      const context = photo.getContext("2d")!;
      context.filter = getComputedStyle(this.canvas.parentElement!).filter;
      context.drawImage(this.canvas, 0, 0);
      photo.toBlob((blob) => {
        if (!blob || this.disposed) {
          this.options.onError(
            "The image could not be saved. Try taking another photo.",
          );
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `honeyrizons-${this.options.theme}-${Date.now()}.png`;
        link.click();
        this.options.onPhotoSaved();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    } catch {
      this.options.onError(
        "The image could not be saved. Try taking another photo.",
      );
    }
  }

  private cancelTransition = () => {
    this.target = null;
    this.targetZoom = null;
    this.angle = null;
    this.touring = false;
    this.options.onInteraction();
  };
  private onPointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };
  private onPointerUp = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      Math.hypot(
        event.clientX - this.pointerDown.x,
        event.clientY - this.pointerDown.y,
      ) > 5
    )
      return;
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hit = raycaster.intersectObjects(this.world.picks)[0];
    if (hit) this.options.onSelect(hit.object.userData.protocol as Protocol);
  };
  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.renderer.setAnimationLoop(null);
    this.options.onError(
      "The 3D view was interrupted. Reload the city to continue.",
    );
  };
  private onVisibility = () => {
    this.lastTime = 0;
    this.renderer.setAnimationLoop(document.hidden ? null : this.animate);
  };

  private resize = () => {
    if (this.disposed) return;
    const { width, height } =
      this.canvas.parentElement!.getBoundingClientRect();
    const aspect = width / Math.max(height, 1);
    // Wider framing on portrait screens keeps the landmark in view.
    const halfHeight = aspect < 0.8 ? 48 : 35;
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.dirty = true;
  };

  private animate = (time: number) => {
    if (this.disposed) return;
    const dt = this.lastTime
      ? Math.min((time - this.lastTime) / 1000, 0.05)
      : 0;
    this.lastTime = time;
    const moving = !this.options.paused && !this.options.reducedMotion;
    if (moving) this.elapsed += dt;
    const lerp = this.options.reducedMotion ? 1 : 1 - Math.exp(-dt * 5);
    if (this.target) {
      const movement = this.target
        .clone()
        .sub(this.controls.target)
        .multiplyScalar(lerp);
      this.controls.target.add(movement);
      this.camera.position.add(movement);
      if (this.controls.target.distanceTo(this.target) < 0.02)
        this.target = null;
    }
    if (this.targetZoom !== null) {
      this.camera.zoom = THREE.MathUtils.lerp(
        this.camera.zoom,
        this.targetZoom,
        lerp,
      );
      this.camera.updateProjectionMatrix();
      if (Math.abs(this.camera.zoom - this.targetZoom) < 0.001)
        this.targetZoom = null;
    }
    if (this.angle !== null || (this.touring && moving)) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      const radius = Math.hypot(offset.x, offset.z);
      const current = Math.atan2(offset.x, offset.z);
      if (this.touring && moving) this.angle = current + dt * 0.06;
      const diff =
        THREE.MathUtils.euclideanModulo(
          this.angle! - current + Math.PI,
          Math.PI * 2,
        ) - Math.PI;
      const next = current + diff * (this.touring ? 1 : lerp);
      this.camera.position.x = this.controls.target.x + Math.sin(next) * radius;
      this.camera.position.z = this.controls.target.z + Math.cos(next) * radius;
      if (!this.touring && Math.abs(diff) < 0.001) this.angle = null;
    }
    for (const actor of this.world.actors) {
      const position =
        THREE.MathUtils.euclideanModulo(
          this.elapsed * actor.speed + actor.offset + actor.extent,
          actor.extent * 2,
        ) - actor.extent;
      actor.mesh.position.set(
        actor.axis === "x" ? position : actor.lane,
        actor.height +
          (actor.pedestrian && moving
            ? Math.sin(this.elapsed * 9 + actor.offset) * 0.026
            : 0),
        actor.axis === "z" ? position : actor.lane,
      );
      actor.mesh.rotation.y =
        actor.axis === "x"
          ? actor.speed > 0
            ? 0
            : Math.PI
          : actor.speed > 0
            ? -Math.PI / 2
            : Math.PI / 2;
    }
    const pulseAge = this.elapsed - this.pulseTime;
    this.world.beacon.visible =
      pulseAge >= 0 && pulseAge < 3 && !this.options.reducedMotion;
    this.world.beacon.children.forEach((ring, index) => {
      const phase = (pulseAge * 0.8 + index * 0.5) % 1;
      ring.scale.setScalar(1 + phase * 2);
      (
        ring as THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
      ).material.opacity = (1 - phase) * 0.65;
    });
    this.world.water.rotation.y = this.elapsed * 0.06;
    const cameraChanged = this.controls.update();
    if (
      moving ||
      cameraChanged ||
      this.dirty ||
      this.target ||
      this.targetZoom !== null ||
      this.angle !== null ||
      this.frame < 3
    )
      this.render();
    this.dirty = false;
    if (this.frame++ === 2) this.options.onReady();
  };

  private render() {
    if (this.options.theme === "night") this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.controls.removeEventListener("start", this.cancelTransition);
    this.controls.dispose();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.world.dispose();
    this.sun.shadow.dispose();
    this.composer.passes.forEach((pass) => pass.dispose());
    this.composer.dispose();
    this.renderer.dispose();
  }
}
