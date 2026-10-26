import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { materialById } from '../domain/catalog';
import { fmtLen } from '../domain/units';
import type { Axis, CabinetConfig, Finish, HandleFinish, Layout, Motion, Part, Unit, Vec3, FrontStyle, HandleType } from '../domain/types';
import { WOOD_TILE, woodTextures } from './textures';

const MM = 0.001;
const DOOR_SWING = THREE.MathUtils.degToRad(100);
const v3 = (p: Vec3) => new THREE.Vector3(p[0] * MM, p[1] * MM, p[2] * MM);

export interface ViewState {
  doorsOpen: boolean;
  drawersOpen: boolean;
  showFronts: boolean;
  showDimensions: boolean;
}

interface MotionGroup {
  group: THREE.Group;
  motion: Motion;
  /** 0 = closed, 1 = open; animated towards the target each frame. */
  t: number;
}

const HANDLE_FINISHES: Record<HandleFinish, THREE.MeshPhysicalMaterialParameters> = {
  chrome: { color: '#e4e4e4', metalness: 1, roughness: 0.18 },
  inox: { color: '#c9ccce', metalness: 1, roughness: 0.45 },
  black: { color: '#1b1b1b', metalness: 0.5, roughness: 0.45 },
  gunmetal: { color: '#4a4d52', metalness: 0.85, roughness: 0.35 },
  brass: { color: '#c19a56', metalness: 1, roughness: 0.3 },
  gold: { color: '#d8b046', metalness: 1, roughness: 0.22 },
  white: { color: '#f2f2f0', metalness: 0, roughness: 0.4 },
};

/**
 * Owns the WebGL scene for one cabinet. React hands it a fresh Layout whenever the config changes;
 * the renderer rebuilds the meshes and animates doors/drawers between closed and open.
 */
export class CabinetRenderer {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
  private controls: OrbitControls;
  private root = new THREE.Group();
  private dims = new THREE.Group();
  private motions = new Map<string, MotionGroup>();
  private materials = new Map<string, THREE.Material>();
  private usedMaterials = new Set<string>();
  /** Parts lit up red because the user clicked a warning about them. */
  private highlighted = new Set<string>();
  private highlightMat = new THREE.MeshStandardMaterial({ color: '#f87171', emissive: '#dc2626', emissiveIntensity: 0.5, roughness: 0.6 });
  /** Parts the user picked by clicking them; shown in blue (warnings win if both apply). */
  private selected = new Set<string>();
  private selectMat = new THREE.MeshStandardMaterial({ color: '#93c5fd', emissive: '#2563eb', emissiveIntensity: 0.35, roughness: 0.5 });
  private raycaster = new THREE.Raycaster();
  private events = new AbortController();
  private pointerDown: { x: number; y: number; t: number } | null = null;
  /** Called with the clicked part / fixture id, or null for a click on empty space. */
  onPick: ((partId: string | null) => void) | null = null;
  private geometries: THREE.BufferGeometry[] = [];
  private view: ViewState = { doorsOpen: false, drawersOpen: false, showFronts: true, showDimensions: true };
  private clock = new THREE.Clock();
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private framedOnce = false;
  private lastSize: Vec3 = [1, 1, 1];
  private keyLight: THREE.DirectionalLight;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    container.appendChild(this.labels.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#c9c2b8', 0.6));
    this.keyLight = new THREE.DirectionalLight('#fff6ea', 1.6);
    this.keyLight.position.set(2.5, 4, 3.5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.01;
    this.scene.add(this.keyLight, this.keyLight.target);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor, this.root, this.dims);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 15;
    this.controls.screenSpacePanning = true;

    // A short click without dragging selects; anything longer is an orbit / pan gesture.
    const canvas = this.renderer.domElement;
    const signal = this.events.signal;
    canvas.addEventListener('pointerdown', (e) => (this.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() }), { signal });
    canvas.addEventListener(
      'pointerup',
      (e) => {
        const d = this.pointerDown;
        this.pointerDown = null;
        if (!d || e.button !== 0) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 || performance.now() - d.t > 500) return;
        this.onPick?.(this.pick(e));
      },
      { signal },
    );
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons) return;
      canvas.style.cursor = this.pick(e) ? 'pointer' : '';
    }, { signal });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.loop();  }

  // --- public API -------------------------------------------------------------

  update(layout: Layout, cfg: CabinetConfig, unit: Unit) {
    const previous = new Map([...this.motions].map(([k, m]) => [k, m.t]));
    this.clear();
    this.usedMaterials.clear();

    for (const part of layout.parts) {
      const finish = part.material === 'front' ? cfg.frontFinish : cfg.carcassFinish;
      const mesh = this.partMesh(part, finish, cfg.frontStyle);
      this.attach(mesh, part.position, part.motion, previous);
    }
    for (const fx of layout.fixtures) {
      const obj = fx.kind === 'rod' ? this.rodMesh(fx.length) : this.handleMesh(cfg.handleType, fx.length, fx.orientation, cfg.handleFinish, fx.side ?? 1);
      const motion = fx.motionKey ? this.motions.get(fx.motionKey)?.motion : undefined;
      obj.userData.partId = fx.id;
      this.attach(obj, fx.position, motion, previous);
    }
    this.applyHighlight();

    this.buildDimensions(cfg, unit);
    this.pruneMaterials();
    this.applyVisibility();
    this.fitShadow(cfg);

    const size: Vec3 = [cfg.width, cfg.height, cfg.depth];
    const changedALot = size.some((s, i) => Math.abs(s - this.lastSize[i]) / this.lastSize[i] > 0.35);
    this.lastSize = size;
    if (!this.framedOnce || changedALot) {
      this.resetCamera();
      this.framedOnce = true;
    }
  }

  setView(view: Partial<ViewState>) {
    this.view = { ...this.view, ...view };
    this.applyVisibility();
  }

  /** Light up these parts / fixtures in pulsing red (empty to clear). */
  setHighlight(ids: string[]) {
    this.highlighted = new Set(ids);
    this.applyHighlight();
  }

  /** Show these parts / fixtures as selected (empty to clear). */
  setSelection(ids: string[]) {
    this.selected = new Set(ids);
    this.applyHighlight();
  }

  /** Id of the nearest visible part or fixture under the pointer. */
  private pick(e: PointerEvent): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    for (const hit of this.raycaster.intersectObject(this.root, true)) {
      if (!(hit.object instanceof THREE.Mesh)) continue;
      let visible = true;
      let owner: THREE.Object3D | null = null;
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        if (!o.visible) visible = false;
        if (!owner && o.userData.partId !== undefined) owner = o;
      }
      // Raycasting ignores `visible`, so skip hits on hidden doors.
      if (visible && owner) return owner.userData.partId;
    }
    return null;
  }

  resetCamera() {
    const [w, h, d] = this.lastSize.map((v) => v * MM);
    // Fit both the vertical and horizontal field of view, with margin for labels and the 3/4 angle.
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const tanH = tanV * this.camera.aspect;
    const dist = Math.max(h / 2 / tanV, (w * 0.95 + d * 0.5) / 2 / tanH) * 1.55 + d / 2;
    const target = new THREE.Vector3(0, h / 2, 0);
    const dir = new THREE.Vector3(0.55, 0.22, 1).normalize();
    this.controls.target.copy(target);
    this.camera.position.copy(target).addScaledVector(dir, dist);
    this.controls.update();
  }

  /** PNG data URL of the current view, used for the PDF report. */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.clear();
    this.materials.forEach((m) => m.dispose());
    this.highlightMat.dispose();
    this.selectMat.dispose();
    this.events.abort();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }

  // --- scene construction -----------------------------------------------------

  private attach(obj: THREE.Object3D, position: Vec3, motion: Motion | undefined, previous: Map<string, number>) {
    if (!motion) {
      obj.position.copy(v3(position));
      this.root.add(obj);
      return;
    }
    let mg = this.motions.get(motion.key);
    if (!mg) {
      const group = new THREE.Group();
      group.name = motion.key;
      if (motion.type === 'hinge') group.position.copy(v3(motion.pivot));
      this.root.add(group);
      mg = { group, motion, t: previous.get(motion.key) ?? 0 };
      this.motions.set(motion.key, mg);
    }
    // Children are placed relative to the group origin (the hinge pivot for doors).
    const origin = motion.type === 'hinge' ? motion.pivot : ([0, 0, 0] as Vec3);
    obj.position.copy(v3([position[0] - origin[0], position[1] - origin[1], position[2] - origin[2]]));
    mg.group.add(obj);
  }

  private partMesh(part: Part, finish: Finish, style: FrontStyle): THREE.Mesh {
    const [sx, sy, sz] = part.size.map((s) => s * MM);
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    worldScaleUVs(geo, part.grain, hashOffset(part.id));
    this.geometries.push(geo);
    const mesh = new THREE.Mesh(geo, this.finishMaterial(finish, part.material === 'back'));
    mesh.castShadow = part.category !== 'back';
    mesh.receiveShadow = true;
    mesh.userData.category = part.category;
    mesh.userData.partId = part.id;
    if (part.category === 'door' || part.category === 'drawerFront') {
      // The real 3 mm gaps are too thin to read on screen; a faint outline shows where fronts split.
      const edges = new THREE.EdgesGeometry(geo);
      this.geometries.push(edges);
      mesh.add(new THREE.LineSegments(edges, this.seamMaterial()));
      this.decorateFront(mesh, part, style);
    }
    return mesh;
  }

  private finishMaterial(finish: Finish, isBack: boolean): THREE.Material {
    const key = `${finish.materialId}|${finish.color}|${finish.gloss}|${isBack}`;
    this.usedMaterials.add(key);
    const cached = this.materials.get(key);
    if (cached) return cached;
    const def = materialById(finish.materialId);
    const gloss = isBack ? 0.05 : finish.gloss;
    const params: THREE.MeshPhysicalMaterialParameters = {
      color: new THREE.Color(finish.color),
      roughness: THREE.MathUtils.lerp(0.9, 0.08, gloss),
      clearcoat: gloss > 0.6 ? gloss : 0,
      clearcoatRoughness: 0.06,
    };
    if (def.kind === 'wood' && !isBack) {
      const tex = woodTextures(def.id, this.renderer.capabilities.getMaxAnisotropy());
      params.map = tex.map;
      params.bumpMap = tex.bump;
      params.bumpScale = 0.4;
    }
    const mat = new THREE.MeshPhysicalMaterial(params);
    this.materials.set(key, mat);
    return mat;
  }

  private handleMaterial(finish: HandleFinish) {
    const key = `handle|${finish}`;
    this.usedMaterials.add(key);
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new THREE.MeshPhysicalMaterial(HANDLE_FINISHES[finish]);
      this.materials.set(key, mat);
    }
    return mat;
  }

  private rodMesh(lengthMm: number): THREE.Object3D {
    const group = new THREE.Group();
    const mat = this.handleMaterial('chrome');
    const rod = new THREE.CylinderGeometry(0.0125, 0.0125, lengthMm * MM, 24);
    rod.rotateZ(Math.PI / 2);
    const mount = new THREE.CylinderGeometry(0.02, 0.02, 0.006, 24);
    mount.rotateZ(Math.PI / 2);
    this.geometries.push(rod, mount);
    const bar = new THREE.Mesh(rod, mat);
    bar.castShadow = true;
    group.add(bar);
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(mount, mat);
      m.position.x = (s * (lengthMm * MM - 0.006)) / 2;
      group.add(m);
    }
    return group;
  }

  /**
   * Handle anchored at its mounting point on the front face, protruding towards +z. Built with
   * its length along y and the front's edge towards +x·side, then turned for horizontal handles.
   */
  private handleMesh(
    type: HandleType,
    lengthMm: number,
    orientation: 'vertical' | 'horizontal',
    finish: HandleFinish,
    side: 1 | -1,
  ): THREE.Object3D {
    const group = new THREE.Group();
    const mat = this.handleMaterial(finish);
    const L = lengthMm * MM;
    const standoff = 0.026;
    const add = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0) => {
      this.geometries.push(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      group.add(m);
    };

    if (type === 'knob' || L <= 0) {
      const stem = new THREE.CylinderGeometry(0.007, 0.009, standoff, 20);
      stem.rotateX(Math.PI / 2);
      add(stem, 0, 0, standoff / 2);
      const head = new THREE.SphereGeometry(0.015, 24, 16);
      head.scale(1, 1, 0.7);
      add(head, 0, 0, standoff + 0.004);
    } else if (type === 'square') {
      add(new THREE.BoxGeometry(0.012, L + 0.03, 0.012), 0, 0, standoff);
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.01, 0.01, standoff), 0, (s * L) / 2, standoff / 2);
    } else if (type === 'edge') {
      // Aluminium pull on the front's edge: a plate on the face plus a lip to hook fingers behind.
      add(new THREE.BoxGeometry(0.022, L, 0.002), -side * 0.011, 0, 0.001);
      add(new THREE.BoxGeometry(0.003, L, 0.024), -side * 0.0015, 0, 0.012);
    } else if (type === 'gola') {
      // Recessed finger channel running along the edge.
      add(new THREE.BoxGeometry(0.026, L, 0.004), -side * 0.013, 0, 0.0005);
    } else {
      // Round bar ('bar') or the longer, slightly thicker 'long' bar.
      const r = type === 'long' ? 0.007 : 0.006;
      add(new THREE.CylinderGeometry(r, r, L + 0.03, 20), 0, 0, standoff);
      for (const s of [-1, 1]) {
        const post = new THREE.CylinderGeometry(0.005, 0.005, standoff, 16);
        post.rotateX(Math.PI / 2);
        add(post, 0, (s * L) / 2, standoff / 2);
      }
    }
    // Rotating +90° about z puts the length along x and the edge side (+x) on top (+y).
    if (orientation === 'horizontal') group.rotation.z = Math.PI / 2;
    group.traverse((o) => (o.castShadow = true));
    return group;
  }

  /** Add the chosen front design to a door or drawer front: frame, flutes, glass or mirror. */
  private decorateFront(mesh: THREE.Mesh, part: Part, style: FrontStyle) {
    if (style === 'flat') return;
    const isDoor = part.category === 'door';
    if ((style === 'glass' || style === 'mirror') && !isDoor) return;
    const [sx, sy, sz] = part.size.map((s) => s * MM);
    const face = sz / 2;
    const mat = mesh.material as THREE.Material;
    const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, outline = false) => {
      this.geometries.push(geo);
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z);
      m.castShadow = material.transparent !== true;
      m.receiveShadow = true;
      if (outline) {
        // Same faint seam as the front's own edges, so a same-colour frame still reads.
        const edges = new THREE.EdgesGeometry(geo);
        this.geometries.push(edges);
        m.add(new THREE.LineSegments(edges, this.seamMaterial()));
      }
      mesh.add(m);
    };
    const frame = (f: number, depth: number, z: number) => {
      for (const s of [-1, 1]) {
        add(new THREE.BoxGeometry(f, sy, depth), mat, s * (sx / 2 - f / 2), 0, z, true);
        add(new THREE.BoxGeometry(sx - 2 * f, f, depth), mat, 0, s * (sy / 2 - f / 2), z, true);
      }
    };

    if (style === 'shaker') {
      frame(Math.min(0.07, 0.16 * Math.min(sx, sy)), 0.006, face + 0.003);
    } else if (style === 'fluted') {
      // Half-round vertical ribs every 3 cm.
      const count = Math.max(1, Math.floor((sx - 0.02) / 0.03));
      const pitch = (sx - 0.02) / count;
      const rib = new THREE.CylinderGeometry(0.009, 0.009, sy - 0.03, 10);
      rib.scale(1, 1, 0.45);
      this.geometries.push(rib);
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(rib, mat);
        m.position.set(-sx / 2 + 0.01 + pitch * (i + 0.5), 0, face);
        mesh.add(m);
      }
    } else if (style === 'glass') {
      // A full-thickness frame around a glass pane: the slab itself becomes the glass.
      mesh.material = this.specialMaterial('glass');
      mesh.castShadow = false;
      frame(Math.min(0.065, 0.16 * Math.min(sx, sy)), sz + 0.001, 0);
    } else if (style === 'mirror') {
      add(new THREE.BoxGeometry(sx - 0.05, sy - 0.05, 0.003), this.specialMaterial('mirror'), 0, 0, face + 0.0015);
    }
  }

  private specialMaterial(kind: 'glass' | 'mirror'): THREE.Material {
    this.usedMaterials.add(kind);
    let mat = this.materials.get(kind);
    if (!mat) {
      mat =
        kind === 'glass'
          ? new THREE.MeshPhysicalMaterial({ color: '#d6e6ea', roughness: 0.08, transparent: true, opacity: 0.32, depthWrite: false })
          : // Reflections of the dim studio scene alone read as smoked glass; a cool glow keeps it a mirror.
            new THREE.MeshPhysicalMaterial({ color: '#eef3f5', metalness: 0.9, roughness: 0.06, emissive: '#8fa3ad', emissiveIntensity: 0.45 });
      this.materials.set(kind, mat);
    }
    return mat;
  }

  private buildDimensions(cfg: CabinetConfig, unit: Unit) {
    const W = cfg.width * MM;
    const H = cfg.height * MM;
    const D = cfg.depth * MM;
    const off = 0.09;
    const lineMat = this.lineMaterial();
    const dim = (a: THREE.Vector3, b: THREE.Vector3, tick: THREE.Vector3, text: string) => {
      const pts = [a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)];
      const geo = new THREE.BufferGeometry().setFromPoints([pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]]);
      geo.setIndex([0, 1, 2, 3, 4, 5]);
      this.geometries.push(geo);
      this.dims.add(new THREE.LineSegments(geo, lineMat));
      const el = document.createElement('div');
      el.className = 'dim-label';
      el.textContent = text;
      const label = new CSS2DObject(el);
      label.position.copy(a).add(b).multiplyScalar(0.5);
      this.dims.add(label);
    };
    const t = 0.025;
    dim(new THREE.Vector3(-W / 2, H + off, D / 2), new THREE.Vector3(W / 2, H + off, D / 2), new THREE.Vector3(0, t, 0), `Gjerësia ${fmtLen(cfg.width, unit)}`);
    dim(new THREE.Vector3(-W / 2 - off, 0, D / 2), new THREE.Vector3(-W / 2 - off, H, D / 2), new THREE.Vector3(t, 0, 0), `Lartësia ${fmtLen(cfg.height, unit)}`);
    dim(new THREE.Vector3(W / 2 + off, H, -D / 2), new THREE.Vector3(W / 2 + off, H, D / 2), new THREE.Vector3(0, t, 0), `Thellësia ${fmtLen(cfg.depth, unit)}`);
  }

  private seamMaterial() {
    this.usedMaterials.add('seam');
    let mat = this.materials.get('seam');
    if (!mat) {
      mat = new THREE.LineBasicMaterial({ color: '#1c1917', transparent: true, opacity: 0.35 });
      this.materials.set('seam', mat);
    }
    return mat;
  }

  private lineMaterial() {
    this.usedMaterials.add('dimline');
    let mat = this.materials.get('dimline');
    if (!mat) {
      mat = new THREE.LineBasicMaterial({ color: '#57534e' });
      this.materials.set('dimline', mat);
    }
    return mat;
  }

  /** Swap highlighted meshes to the red material, restoring the original on the rest. */
  private applyHighlight() {
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      let owner: THREE.Object3D | null = o;
      while (owner && owner.userData.partId === undefined) owner = owner.parent;
      const id = owner?.userData.partId;
      const target = this.highlighted.has(id) ? this.highlightMat : this.selected.has(id) ? this.selectMat : null;
      if (target) {
        o.userData.baseMaterial ??= o.material;
        o.material = target;
      } else if (o.userData.baseMaterial) {
        o.material = o.userData.baseMaterial;
        delete o.userData.baseMaterial;
      }
    });
  }

  /** Colour-picker drags create a material per colour; drop the ones no longer on screen. */
  private pruneMaterials() {
    for (const [key, mat] of this.materials) {
      if (!this.usedMaterials.has(key)) {
        mat.dispose();
        this.materials.delete(key);
      }
    }
  }

  private fitShadow(cfg: CabinetConfig) {
    const r = (Math.max(cfg.width, cfg.height, cfg.depth) * MM) / 2 + 0.6;
    const cam = this.keyLight.shadow.camera;
    cam.left = cam.bottom = -r;
    cam.right = cam.top = r;
    cam.near = 0.1;
    cam.far = 20;
    cam.updateProjectionMatrix();
    this.keyLight.target.position.set(0, (cfg.height * MM) / 2, 0);
  }

  private applyVisibility() {
    this.dims.visible = this.view.showDimensions;
    for (const { group, motion } of this.motions.values()) {
      if (motion.type !== 'drawer') group.visible = this.view.showFronts;
    }
  }

  private clear() {
    const removeAll = (g: THREE.Object3D) => {
      // CSS2DObjects remove their DOM element on the 'removed' event.
      [...g.children].forEach((c) => {
        removeAll(c);
        c.removeFromParent();
      });
    };
    removeAll(this.root);
    removeAll(this.dims);
    this.geometries.forEach((g) => g.dispose());
    this.geometries = [];
    this.motions.clear();
  }

  // --- frame loop ---------------------------------------------------------------

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop);
    const k = Math.min(1, this.clock.getDelta() * 5);
    for (const mg of this.motions.values()) {
      const target = mg.motion.type === 'drawer' ? +this.view.drawersOpen : +this.view.doorsOpen;
      mg.t += (target - mg.t) * k;
      if (Math.abs(target - mg.t) < 1e-4) mg.t = target;
      const m = mg.motion;
      if (m.type === 'hinge') mg.group.rotation.y = m.dir * mg.t * DOOR_SWING;
      else if (m.type === 'slide') mg.group.position.x = m.travel * MM * mg.t;
      else mg.group.position.z = m.travel * MM * mg.t;
    }
    if (this.highlighted.size) this.highlightMat.emissiveIntensity = 0.35 + 0.3 * Math.sin(this.clock.elapsedTime * 5);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };
}

/** Deterministic per-part texture offset so neighbouring panels don't show identical grain. */
function hashOffset(id: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return [((h >>> 0) % 997) / 997, ((h >>> 10) % 991) / 991];
}

/**
 * Replace BoxGeometry's per-face 0–1 UVs with world-scale ones so the wood texture keeps a
 * constant physical size on every panel, and rotate each face so the grain follows `grain`.
 */
function worldScaleUVs(geo: THREE.BoxGeometry, grain: Axis, [ou, ov]: [number, number]) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const idx: Record<Axis, number> = { x: 0, y: 1, z: 2 };
  // BoxGeometry face order: +x, −x, +y, −y, +z, −z; each face's two in-plane axes.
  const faceAxes: [Axis, Axis][] = [['z', 'y'], ['z', 'y'], ['x', 'z'], ['x', 'z'], ['x', 'y'], ['x', 'y']];
  const perFace = uv.count / 6;
  for (let f = 0; f < 6; f++) {
    let [ua, va] = faceAxes[f];
    if (ua === grain) [ua, va] = [va, ua];
    for (let k = 0; k < perFace; k++) {
      const i = f * perFace + k;
      const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      uv.setXY(i, p[idx[ua]] / WOOD_TILE.across + ou, p[idx[va]] / WOOD_TILE.along + ov);
    }
  }
  uv.needsUpdate = true;
}
