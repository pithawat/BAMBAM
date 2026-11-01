import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FloorPlan, PlanRoom } from "../../../types";
import { buildFloorPlan, type BuiltPlan, type PlanLabel } from "./floor-plan";
import { createTextures, disposeTree, ease, mesh, type Textures } from "./kit";
import type { BuildingModel, BuildingSize, FloorEntry } from "./model";
import { loadModel } from "./registry";
import { buildSite, simplifyForSite, type BuiltSite, type SiteBlockSpec } from "./site";

// S29 3D engine (D-082, CR-017, CR-027): campus site view → one building model → floor-plan cutaway, in
// one WebGL canvas. Floors and footprint come from #27; floor colours and ticket pins follow the ticket
// step (S11 rules). Entering a floor plays the repair-map transition: the floors above lift and fade, the
// camera dives to the floor, a short crossfade swaps to the plan; going back reverses it.
// Budget (D-124, CR-028): renders on demand only (no idle frames); the site view shows one side: its boxes
// as one merged mesh without shadows, อาคาร 1 / 2 as light versions of their real models (merged per material, no
// surroundings or leaves; ≤ ~20k triangles / 60 draw calls per side); a building's shape is a lazy chunk; the opened building's own scene (geometry,
// materials, environment and shadow maps) is disposed when it is left, and the shared canvas textures
// (drawn once) free their GPU copies, re-uploaded on the next use.

export type EngineEvents = {
  onFloorHover: (level: number | null, clientX: number, clientY: number) => void;
  onFloorClick: (level: number) => void;
  onBlockHover: (id: string | null, clientX: number, clientY: number) => void;
  onBlockClick: (id: string) => void;
};

/** Open-ticket steps shown on the model (closed tickets are not shown). `in_repair` includes reworking. */
export type ModelStep = "awaiting_assessment" | "in_repair" | "awaiting_rating";
/** `critical` = a ฉุกเฉิน ticket: a red halo around the pin head (CR-018). */
export type TicketPin = { id: string; x: number; z: number; step: ModelStep; critical: boolean };

/** What `stats()` reports for the budget check (AC3). */
export type EngineStats = { mode: string; frames: number; calls: number; triangles: number; geometries: number; textures: number };

type Tween = { t0: number; dur: number; fn: (k: number) => void; done?: () => void; camera?: boolean };
type Liftable = { level: number; group: THREE.Group };

/** The building on screen: its own scene, textures and environment, disposed together. */
type Loaded = {
  key: string;
  model: BuildingModel;
  size: BuildingSize;
  scene: THREE.Scene;
  env: THREE.WebGLRenderTarget;
  floors: FloorEntry[];
  liftables: Liftable[];
};

const VIEW_DIR = new THREE.Vector3(0.42, 0.3, 0.8).normalize();
const SITE_DIR = new THREE.Vector3(0.3, 0.62, 0.75).normalize();
const LIFT = 16; // metres the floors above the picked one rise (repair-map)
const LIFT_MS = 650;
const FADE_MS = 230;

const LABEL_CLASS: Record<PlanLabel["kind"], string> = {
  room: "flex flex-col items-center rounded-md bg-card/90 px-2 py-0.5 text-xs font-semibold text-foreground shadow-card",
  core: "rounded-sm bg-card/80 px-1.5 text-xs font-medium text-muted-foreground",
  dim: "text-xs text-muted-foreground",
  note: "rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-card",
};

const STEP_TOKEN: Record<ModelStep, string> = {
  awaiting_assessment: "--status-new",
  in_repair: "--status-in-progress",
  awaiting_rating: "--status-resolved",
};

/** Fade a floor (or the roof) — the repair-map `setOpacity`; shells keep their own opacity. */
function setOpacity(group: THREE.Object3D, a: number) {
  group.visible = a > 0.002;
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.noFade) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (mat.userData.baseT === undefined) mat.userData.baseT = mat.transparent;
      mat.transparent = mat.userData.baseT || a < 0.999;
      mat.opacity = a;
      mat.depthWrite = a > 0.6;
    }
  });
}

export class BuildingEngine {
  mode: "site" | "building" | "transition" | "plan" = "site";
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private siteScene = new THREE.Scene();
  private site: BuiltSite | null = null;
  private siteSeq = 0; // cancels real models still loading for a replaced site
  /** Environment of the site scene while it shows real models (CR-028). */
  private siteEnv: THREE.WebGLRenderTarget | null = null;
  private hoverBlock: string | null = null;
  private b: Loaded | null = null;
  /** The generated canvas textures, drawn once; leaving a building frees their GPU copies only. */
  private texSet: Textures | null = null;
  private planScene = new THREE.Scene();
  private plan: BuiltPlan | null = null;
  private pinsGroup = new THREE.Group();
  private planSun: THREE.DirectionalLight;
  private labelsEl: HTMLDivElement;
  private fadeEl: HTMLDivElement;
  private labels: { el: HTMLElement; pos: THREE.Vector3 }[] = [];
  private anchors = new Map<HTMLElement, THREE.Vector3>();
  private floorColors = new Map<number, THREE.Color>();
  private stepColor: Record<ModelStep, THREE.Color>;
  private critical: THREE.Color;
  private hoverLevel: number | null = null;
  private currentLevel: number | null = null;
  private lifted: { level: number; done: Promise<void> } | null = null;
  private seq = 0; // cancels stale transitions
  private tweens: Tween[] = [];
  private frame = 0;
  private frames = 0;
  private resizeObserver: ResizeObserver;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private accent: THREE.Color;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private down: [number, number] | null = null;
  private v = new THREE.Vector3();
  private disposed = false;

  constructor(private host: HTMLElement, overlay: HTMLElement, private events: EngineEvents) {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => new THREE.Color(css.getPropertyValue(name).trim() || "#2741FA");
    this.accent = token("--primary");
    // The UI tokens are dark enough for text; on the lit model they are lifted so the glow stays clear.
    const vivid = (c: THREE.Color) => {
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      return c.setHSL(hsl.h, Math.min(1, hsl.s * 1.1), Math.max(hsl.l, 0.5));
    };
    this.stepColor = {
      awaiting_assessment: vivid(token(STEP_TOKEN.awaiting_assessment)),
      in_repair: vivid(token(STEP_TOKEN.in_repair)),
      awaiting_rating: vivid(token(STEP_TOKEN.awaiting_rating)),
    };
    this.critical = token("--priority-critical");

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false; // static shadows: re-rendered only after a change
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const canvas = this.renderer.domElement;
    canvas.className = "absolute inset-0 block size-full touch-none";
    host.prepend(canvas);

    // crossfade between views (repair-map `fadeSwap`)
    this.fadeEl = document.createElement("div");
    this.fadeEl.className = "pointer-events-none absolute inset-0 bg-muted opacity-0 transition-opacity duration-200 motion-reduce:transition-none";
    host.append(this.fadeEl);

    this.labelsEl = document.createElement("div");
    this.labelsEl.className = "pointer-events-none absolute inset-0";
    this.labelsEl.setAttribute("aria-hidden", "true");
    overlay.prepend(this.labelsEl);

    this.camera = new THREE.PerspectiveCamera(34, 1, 1, 1600);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.addEventListener("change", this.requestRender);

    // site: flat colours, hemisphere + sun, no shadows, no textures
    this.siteScene.background = new THREE.Color(0xe4eaee);
    this.siteScene.fog = new THREE.Fog(0xe4eaee, 500, 1100);
    this.siteScene.add(new THREE.HemisphereLight(0xf2f6fb, 0x8a8577, 1.6));
    const siteSun = new THREE.DirectionalLight(0xfff0d8, 1.6);
    siteSun.position.set(120, 260, 160);
    this.siteScene.add(siteSun);
    this.planSun = this.addLights(this.planScene, 24, 2048);
    this.planScene.add(this.pinsGroup);

    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.setControls("site");
    this.requestRender();
  }

  // ---- public API ----

  /**
   * Builds the site view of one side: the boxes as one merged mesh, then the real model of every block
   * with a shape (CR-028: without its surroundings, pick shells hidden). The camera frames every block.
   */
  setSite(blocks: SiteBlockSpec[], side: 1 | 2) {
    const seq = ++this.siteSeq;
    if (this.site) {
      this.siteScene.remove(this.site.group);
      disposeTree(this.site.group);
    }
    const site = buildSite(blocks, side);
    this.site = site;
    this.siteScene.add(site.group);
    for (const b of blocks) {
      if (!b.modelKey) continue;
      void loadModel(b.modelKey).then((model) => {
        if (seq !== this.siteSeq || this.disposed) return;
        const built = model.build(this.textures(), { floors: b.storeys, width: b.width, depth: b.depth }, { surroundings: false });
        for (const f of built.floors) f.shell.visible = false;
        built.root.position.set(b.x, 0, b.z);
        built.root.rotation.y = (-b.rotDeg * Math.PI) / 180;
        simplifyForSite(built.root); // light version on the site; the opened building is full
        site.group.add(built.root);
        this.siteScene.environment = this.environment();
        this.requestRender();
      }).catch(() => {}); // the block simply stays empty
    }
    this.hoverBlock = null;
    if (this.mode === "site") {
      const p = this.sitePose();
      this.camera.position.copy(p.pos);
      this.controls.target.copy(p.target);
    }
    this.requestRender();
  }

  /**
   * Site → building (or building → another building): loads the shape chunk, crossfades, disposes the
   * previous building and builds this one. Resolves false when a later call replaced it.
   */
  async openBuilding(key: string, size: BuildingSize): Promise<boolean> {
    const seq = ++this.seq;
    const fade = this.fade(true);
    let model: BuildingModel;
    try {
      model = await loadModel(key);
    } catch {
      if (seq === this.seq) await this.fade(false);
      return false;
    }
    await fade;
    if (seq !== this.seq || this.disposed) return false;
    this.unloadBuilding();
    const tex = this.textures();
    const env = this.envFromSky(tex);
    const scene = new THREE.Scene();
    scene.background = tex.sky;
    scene.environment = env.texture;
    scene.fog = new THREE.Fog(0xd9e3ea, 220, 650);
    this.addLights(scene, 60, 2048);
    const built = model.build(tex, size);
    scene.add(built.root);
    this.planScene.environment = env.texture;
    this.b = {
      key, model, size, scene, env, floors: built.floors,
      liftables: [...built.floors.map((f) => ({ level: f.level, group: f.group })), { level: size.floors + 1, group: built.roof }],
    };
    this.mode = "building";
    this.currentLevel = null;
    this.lifted = null;
    this.tweens = [];
    this.setHoverBlock(null);
    this.setControls("building");
    const p = this.buildingPose();
    this.camera.position.copy(p.pos);
    this.controls.target.copy(p.target);
    this.paintFloors();
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
    await this.fade(false);
    return seq === this.seq;
  }

  /** Back to the site view: the building (and its plan) leaves memory. */
  async showSite() {
    const seq = ++this.seq;
    if (this.mode === "site" && !this.b) {
      this.fadeEl.classList.replace("opacity-100", "opacity-0"); // a cancelled building load may have faded out
      return;
    }
    await this.fade(true);
    if (seq !== this.seq || this.disposed) return;
    this.unloadBuilding();
    this.mode = "site";
    this.tweens = [];
    this.setControls("site");
    const p = this.sitePose();
    this.camera.position.copy(p.pos);
    this.controls.target.copy(p.target);
    this.requestRender();
    await this.fade(false);
  }

  /** Draw calls / triangles of the last frame, live GPU objects and frames rendered so far (AC3). */
  stats(): EngineStats {
    const i = this.renderer.info;
    return { mode: this.mode, frames: this.frames, calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures };
  }

  /** Floor colours from #27 steps: the earliest step with open tickets (รับเรื่อง → กำลังดำเนินการ → รอประเมินตรวจงาน). */
  setFloorSteps(list: { level: number; step: ModelStep | null }[]) {
    this.floorColors.clear();
    for (const f of list) if (f.step) this.floorColors.set(f.level, this.stepColor[f.step]);
    this.paintFloors();
    this.requestRender();
  }

  /** Starts the lift + camera dive to `level` (call on click, before the plan data arrives). */
  enterFloor(level: number) {
    const b = this.b;
    if (this.mode !== "building" || !b) return;
    this.mode = "transition";
    this.currentLevel = level;
    this.hoverLevel = null;
    this.paintFloors();
    for (const o of b.liftables) {
      if (o.level <= level) continue;
      this.tween(LIFT_MS, (k) => {
        const e = ease(k);
        o.group.position.y = e * LIFT;
        setOpacity(o.group, 1 - e);
      });
    }
    const target = new THREE.Vector3(0, (level - 1) * b.model.floorHeight + 0.5, 0);
    this.tweenCamera(target.clone().add(new THREE.Vector3(0, 30, 24)), target, 750);
    this.lifted = { level, done: this.wait(LIFT_MS - 10) };
  }

  /** Shows the plan of one floor: after the lift when coming from the building, else a crossfade. */
  async showPlan(plan: FloorPlan, center: (room: PlanRoom) => [number, number] | null) {
    const b = this.b;
    if (!b || this.mode === "site") return;
    const seq = ++this.seq;
    const level = plan.floor.level;
    if (this.mode === "building") this.enterFloor(level);
    if (this.lifted) await this.lifted.done;
    if (seq !== this.seq || this.disposed || this.b !== b) return;
    await this.fade(true);
    if (seq !== this.seq || this.disposed || this.b !== b) return;
    this.clearPlan();
    this.plan = buildFloorPlan(plan, this.texSet!, center, { width: b.size.width, depth: b.size.depth }, b.model.plan);
    this.planScene.add(this.plan.group);
    for (const l of this.plan.labels) this.addLabel(l);
    const s = Math.max(this.plan.width, this.plan.depth) / 2 + 6;
    Object.assign(this.planSun.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
    this.planSun.shadow.camera.updateProjectionMatrix();
    const fromBuilding = this.mode === "transition";
    this.mode = "plan";
    this.currentLevel = level;
    this.setControls("plan");
    const p = this.planPose();
    if (fromBuilding) {
      this.camera.position.copy(p.pos).add(new THREE.Vector3(0, 6, 5));
      this.controls.target.copy(p.target);
      this.tweenCamera(p.pos, p.target, 600);
    } // switching floors keeps the current view
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
    await this.fade(false);
  }

  /** Back to the building: crossfade, then the lifted floors come down and the camera pulls out. */
  async showBuilding() {
    const b = this.b;
    if (!b || this.mode === "site") return;
    const seq = ++this.seq;
    if (this.mode === "building") {
      this.paintFloors();
      this.requestRender();
      return;
    }
    const level = this.currentLevel ?? 1;
    if (this.mode === "plan") {
      await this.fade(true);
      if (seq !== this.seq || this.disposed || this.b !== b) return;
    }
    this.clearPlan();
    this.setTicketPins([]);
    this.mode = "building";
    this.setControls("building");
    const target = new THREE.Vector3(0, (level - 1) * b.model.floorHeight + 0.5, 0);
    this.camera.position.copy(target).add(new THREE.Vector3(0, 30, 24));
    this.controls.target.copy(target);
    this.tweens = [];
    for (const o of b.liftables) {
      if (o.level <= level) {
        o.group.position.y = 0;
        setOpacity(o.group, 1);
        continue;
      }
      o.group.position.y = LIFT;
      setOpacity(o.group, 0);
      this.tween(LIFT_MS, (k) => {
        const e = ease(k);
        o.group.position.y = (1 - e) * LIFT;
        setOpacity(o.group, e);
      });
    }
    const p = this.buildingPose();
    this.tweenCamera(p.pos, p.target, 850);
    this.lifted = null;
    this.currentLevel = null;
    this.paintFloors();
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
    await this.fade(false);
  }

  /** One 3D pin per open ticket on the current plan (repair-map pins: stem, glowing head, ground ring). */
  setTicketPins(pins: TicketPin[]) {
    for (const child of [...this.pinsGroup.children]) {
      this.pinsGroup.remove(child);
      disposeTree(child);
    }
    if (!this.plan) {
      this.requestRender();
      return;
    }
    const W = this.plan.width, D = this.plan.depth;
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x6b747c, metalness: 0.4, roughness: 0.5 });
    for (const pin of pins) {
      const col = this.stepColor[pin.step];
      const g = new THREE.Group();
      g.position.set(pin.x - W / 2, 0.06, pin.z - D / 2);
      g.add(
        mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8).translate(0, 0.95, 0), stemMat),
        mesh(new THREE.SphereGeometry(0.36, 20, 14).translate(0, 2.2, 0),
          new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, roughness: 0.35 })),
        new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 40).rotateX(-Math.PI / 2).translate(0, 0.09, 0),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })),
      );
      if (pin.critical) {
        // ฉุกเฉิน: a red halo around the head and a wider red ring on the floor
        g.add(
          mesh(new THREE.TorusGeometry(0.58, 0.07, 10, 40).rotateX(Math.PI / 2).translate(0, 2.2, 0),
            new THREE.MeshStandardMaterial({ color: this.critical, emissive: this.critical, emissiveIntensity: 0.6, roughness: 0.4 }), false, false),
          new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 40).rotateX(-Math.PI / 2).translate(0, 0.08, 0),
            new THREE.MeshBasicMaterial({ color: this.critical, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })),
        );
      }
      g.userData.ticketId = pin.id;
      this.pinsGroup.add(g);
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.requestRender();
  }

  zoomBy(factor: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.tweenCamera(this.controls.target.clone().add(offset.setLength(len)), this.controls.target.clone(), 250);
  }

  resetView() {
    const p = this.mode === "plan" ? this.planPose() : this.mode === "site" ? this.sitePose() : this.buildingPose();
    this.tweenCamera(p.pos, p.target, 450);
  }

  /** Keeps an HTML element over a world point (pins, equipment chips, site markers). Returns the untrack function. */
  track(el: HTMLElement, x: number, y: number, z: number) {
    this.anchors.set(el, new THREE.Vector3(x, y, z));
    this.requestRender();
    return () => {
      this.anchors.delete(el);
    };
  }

  /** World point beside floor `level` of the building (floor badge). */
  floorAnchor(level: number): [number, number, number] {
    if (!this.b) return [0, 0, 0];
    const { model: m, size: s } = this.b;
    return [s.width / 2 + m.overhang + 0.7, (level - 1) * m.floorHeight + m.floorHeight * 0.55, s.depth / 2 + m.overhang];
  }

  /** World point over a plan coordinate (metres from the plan's top-left) at height `y`. */
  planAnchor(x: number, z: number, y: number): [number, number, number] {
    const W = this.plan?.width ?? this.b?.size.width ?? 0, D = this.plan?.depth ?? this.b?.size.depth ?? 0;
    return [x - W / 2, y, z - D / 2];
  }

  /** Plan coordinate under the pointer (floor plane), or null outside the plan view. */
  planPointAt(clientX: number, clientY: number): [number, number] | null {
    if (this.mode !== "plan" || !this.plan) return null;
    this.setRay(clientX, clientY);
    const hit = this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), this.v);
    if (!hit) return null;
    return [hit.x + this.plan.width / 2, hit.z + this.plan.depth / 2];
  }

  /** Drag feedback: highlight the room under the pointer, or the red floor outline when refused. */
  highlightRoom(roomId: string | null, refused = false) {
    if (!this.plan) return;
    for (const [id, m] of this.plan.highlights) m.visible = id === roomId;
    this.plan.outline.visible = refused;
    this.requestRender();
  }

  /** Disables orbiting while equipment is dragged. */
  setOrbit(enabled: boolean) {
    this.controls.enabled = enabled;
  }

  requestRender = () => {
    if (!this.frame && !this.disposed) this.frame = requestAnimationFrame(this.tick);
  };

  dispose() {
    this.disposed = true;
    this.seq++;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    this.controls.removeEventListener("change", this.requestRender);
    this.controls.dispose();
    this.unloadBuilding();
    disposeTree(this.siteScene);
    disposeTree(this.planScene);
    this.siteEnv?.dispose();
    for (const t of Object.values(this.texSet ?? {})) t.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
    this.fadeEl.remove();
    this.labelsEl.remove();
    this.anchors.clear();
  }

  // ---- internals ----

  /** The generated canvas textures, drawn once per engine. */
  private textures() {
    return (this.texSet ??= createTextures());
  }

  private envFromSky(tex: Textures) {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromEquirectangular(tex.sky);
    pmrem.dispose();
    return env;
  }

  private environment() {
    return (this.siteEnv ??= this.envFromSky(this.textures())).texture;
  }

  /** Disposes the building on screen: plan, pins, model geometry / materials, its textures, env map and shadow map. */
  private unloadBuilding() {
    this.clearPlan();
    this.setTicketPins([]);
    const b = this.b;
    if (!b) return;
    this.b = null;
    disposeTree(b.scene);
    b.scene.traverse((o) => { if ((o as THREE.Light).isLight) (o as THREE.Light).dispose(); });
    for (const t of Object.values(this.texSet ?? {})) t.dispose(); // GPU copy only: re-uploaded when used again
    b.env.dispose();
    this.planScene.environment = null;
    this.hoverLevel = null;
    this.currentLevel = null;
    this.lifted = null;
  }

  private addLights(scene: THREE.Scene, size: number, mapSize: number) {
    scene.add(new THREE.HemisphereLight(0xdde9f5, 0x6d685d, 0.35));
    const sun = new THREE.DirectionalLight(0xfff0d8, 3.0);
    sun.position.set(size * 0.75, size * 1.15, size * 0.95);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mapSize, mapSize);
    Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: size * 4 });
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.04;
    scene.add(sun);
    return sun;
  }

  private wait(ms: number) {
    return new Promise<void>((r) => setTimeout(r, this.reduceMotion ? 0 : ms));
  }

  private async fade(on: boolean) {
    if (on) this.fadeEl.classList.replace("opacity-0", "opacity-100");
    else this.fadeEl.classList.replace("opacity-100", "opacity-0");
    await this.wait(FADE_MS);
  }

  private tween(dur: number, fn: (k: number) => void, opts: { camera?: boolean; done?: () => void } = {}) {
    this.tweens.push({ t0: performance.now(), dur: this.reduceMotion ? 1 : dur, fn, ...opts });
    this.requestRender();
  }

  private tick = (now: number) => {
    this.frame = 0;
    this.frames++;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const t = this.tweens[i];
      const k = Math.min(1, (now - t.t0) / t.dur);
      t.fn(k);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        t.done?.();
      }
    }
    this.controls.update(); // dispatches "change" while damping → schedules the next frame
    if (this.tweens.length) this.renderer.shadowMap.needsUpdate = true;
    const scene = this.mode === "plan" ? this.planScene : this.mode === "site" || !this.b ? this.siteScene : this.b.scene;
    this.renderer.render(scene, this.camera);
    this.placeOverlays();
    if (this.tweens.length) this.requestRender();
  };

  private placeOverlays() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const place = (el: HTMLElement, pos: THREE.Vector3) => {
      this.v.copy(pos).project(this.camera);
      const off = this.v.z > 1 || Math.abs(this.v.x) > 1.2 || Math.abs(this.v.y) > 1.2;
      el.style.visibility = off ? "hidden" : "visible";
      if (off) return;
      el.style.left = `${((this.v.x * 0.5 + 0.5) * w).toFixed(1)}px`;
      el.style.top = `${((-this.v.y * 0.5 + 0.5) * h).toFixed(1)}px`;
    };
    for (const l of this.labels) place(l.el, l.pos);
    for (const [el, pos] of this.anchors) place(el, pos);
  }

  private addLabel(l: PlanLabel) {
    const el = document.createElement("div");
    el.className = `absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap ${LABEL_CLASS[l.kind]}`;
    el.textContent = l.text;
    if (l.sub) {
      const s = document.createElement("small");
      s.className = "text-xs font-normal text-muted-foreground";
      s.textContent = l.sub;
      el.appendChild(s);
    }
    this.labelsEl.appendChild(el);
    this.labels.push({ el, pos: l.pos });
  }

  private clearPlan() {
    if (!this.plan) return;
    this.planScene.remove(this.plan.group);
    disposeTree(this.plan.group);
    this.plan = null;
    for (const l of this.labels) l.el.remove();
    this.labels = [];
  }

  private paintFloors() {
    for (const f of this.b?.floors ?? []) {
      const color = this.floorColors.get(f.level);
      const hover = this.mode === "building" && this.hoverLevel === f.level;
      const c = color ?? this.accent;
      f.shell.material.color.copy(c);
      f.edges.material.color.copy(c);
      f.shell.material.opacity = color ? (hover ? 0.2 : 0.1) : hover ? 0.08 : 0;
      f.edges.material.opacity = color ? (hover ? 1 : 0.75) : hover ? 0.9 : 0;
      f.edges.visible = f.edges.material.opacity > 0;
      f.glowMat.emissive.copy(color ?? new THREE.Color(0));
      f.glowMat.emissiveIntensity = color ? (hover ? 0.4 : 0.22) : 0;
    }
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private setControls(kind: "plan" | "building" | "site") {
    if (kind === "plan") Object.assign(this.controls, { minDistance: 8, maxDistance: 90, maxPolarAngle: 1.2, minPolarAngle: 0 });
    else if (kind === "site") Object.assign(this.controls, { minDistance: 60, maxDistance: 1100, maxPolarAngle: 1.3, minPolarAngle: 0.12 });
    else Object.assign(this.controls, { minDistance: 18, maxDistance: 220, maxPolarAngle: 1.45, minPolarAngle: 0.12 });
  }

  private fitSphere(sphere: THREE.Sphere, dir: THREE.Vector3, k = 1) {
    const vf = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const hf = Math.atan(Math.tan(vf) * this.camera.aspect);
    const dist = (sphere.radius / Math.sin(Math.min(vf, hf))) * k;
    return { pos: sphere.center.clone().addScaledVector(dir, dist), target: sphere.center.clone() };
  }

  private sitePose() {
    const sphere = this.site?.bounds.clone() ?? new THREE.Sphere(new THREE.Vector3(), 80);
    return this.fitSphere(sphere, SITE_DIR, 0.78);
  }

  private buildingPose() {
    // from the resting floors (lifted ones would enlarge the box mid-transition)
    if (!this.b) return this.sitePose();
    const { model: m, size: s } = this.b;
    const box = new THREE.Box3(
      new THREE.Vector3(-s.width / 2 - m.overhang, 0, -s.depth / 2 - m.overhang),
      new THREE.Vector3(s.width / 2 + m.overhang, s.floors * m.floorHeight + 4, s.depth / 2 + m.overhang),
    );
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    sphere.center.y *= 0.8;
    return this.fitSphere(sphere, VIEW_DIR, 0.92);
  }

  private planPose() {
    const W = this.plan?.width ?? this.b?.size.width ?? 0, D = this.plan?.depth ?? this.b?.size.depth ?? 0;
    const target = new THREE.Vector3(0, 0, 0.8);
    const vf = THREE.MathUtils.degToRad(this.camera.fov) / 2, hf = Math.atan(Math.tan(vf) * this.camera.aspect);
    const dist = Math.max((W / 2 + 5) / Math.tan(hf), (D / 2 + 4) / Math.tan(vf));
    return { pos: target.clone().addScaledVector(new THREE.Vector3(0, 0.8, 0.6).normalize(), dist), target };
  }

  private tweenCamera(pos: THREE.Vector3, target: THREE.Vector3, dur: number) {
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
    this.tweens = this.tweens.filter((t) => !t.camera); // a new camera move replaces the running one
    this.controls.enabled = false;
    this.tween(dur, (k) => {
      const e = ease(k);
      this.camera.position.lerpVectors(p0, pos, e);
      this.controls.target.lerpVectors(t0, target, e);
    }, { camera: true, done: () => { this.controls.enabled = true; } });
  }

  private setRay(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  private pickFloor(clientX: number, clientY: number): number | null {
    if (this.mode !== "building" || !this.b) return null;
    this.setRay(clientX, clientY);
    const hit = this.ray.intersectObjects(this.b.floors.map((f) => f.shell), false)[0];
    return hit ? (hit.object.userData.level as number) : null;
  }

  private pickBlock(clientX: number, clientY: number): string | null {
    if (this.mode !== "site" || !this.site) return null;
    this.setRay(clientX, clientY);
    return this.site.pick(this.ray.ray);
  }

  private setHoverBlock(id: string | null) {
    if (id === this.hoverBlock) return;
    this.hoverBlock = id;
    this.site?.outline(id);
    this.requestRender();
  }

  private onPointerMove = (ev: PointerEvent) => {
    if (ev.pointerType === "touch" || ev.buttons) return;
    if (this.mode === "site") {
      const id = this.pickBlock(ev.clientX, ev.clientY);
      this.setHoverBlock(id);
      this.renderer.domElement.style.cursor = id ? "pointer" : "";
      this.events.onBlockHover(id, ev.clientX, ev.clientY);
      return;
    }
    const level = this.pickFloor(ev.clientX, ev.clientY);
    if (level !== this.hoverLevel) {
      this.hoverLevel = level;
      this.paintFloors();
      this.requestRender();
    }
    this.renderer.domElement.style.cursor = level ? "pointer" : "";
    this.events.onFloorHover(level, ev.clientX, ev.clientY);
  };

  private onPointerLeave = () => {
    this.setHoverBlock(null);
    this.events.onBlockHover(null, 0, 0);
    if (this.hoverLevel !== null) {
      this.hoverLevel = null;
      this.paintFloors();
      this.requestRender();
    }
    this.events.onFloorHover(null, 0, 0);
  };

  private onPointerDown = (ev: PointerEvent) => {
    this.down = [ev.clientX, ev.clientY];
  };

  private onPointerUp = (ev: PointerEvent) => {
    if (!this.down || Math.hypot(ev.clientX - this.down[0], ev.clientY - this.down[1]) > 6) return;
    this.down = null;
    const block = this.pickBlock(ev.clientX, ev.clientY);
    if (block) return this.events.onBlockClick(block);
    const level = this.pickFloor(ev.clientX, ev.clientY);
    if (level) this.events.onFloorClick(level);
  };
}
