import { ENV_LABELS } from "./environment.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HOUSE, roofHeightAt } from "./catalog.js";

function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

export class SceneView {
  constructor(canvas, simulation) {
    this.simulation = simulation;
    this.canvas = canvas;
    this.random = randomGenerator(42);
    this.meshes = new Map();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#293c36");
    this.scene.fog = new THREE.FogExp2("#293c36", 0.016);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 60;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06;
    this.setView("perspective");
    this.scene.add(new THREE.HemisphereLight("#c4d8d3", "#344536", 2.5));
    const sun = new THREE.DirectionalLight("#e4e5cd", 3.2);
    sun.position.set(-10, 23, 13);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.camera.far = 70;
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.0002;
    this.sun = sun;
    this.scene.add(sun);
    const beforeTerrain = new Set(this.scene.children);
    this.createTerrain();
    this.terrainObjects = this.scene.children.filter(
      (o) => !beforeTerrain.has(o),
    );
    this.createHouse();
    this.createVortex();
    this.createRain();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
    this.sync();
  }

  material(color, properties = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      ...properties,
    });
  }

  box(size, position, material, parent = this.scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  createTerrain() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      this.material("#24362e"),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.7;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.box([30, 0.6, 26], [0, -0.4, 0], this.material("#374b38"));
    this.box([29.8, 0.07, 25.8], [0, -0.065, 0], this.material("#566449"));
    this.box([9.8, 0.05, 9.8], [0, -0.015, 0], this.material("#7a7e6a"));
    this.box([3, 0.04, 6], [0, -0.005, 7.5], this.material("#898d75"));
    const seam = this.material("#5f6b57");
    for (let i = 0; i < 6; i++)
      this.box([3, 0.045, 0.025], [0, 0, 5 + i], seam);
    this.box([29.8, 0.025, 3.2], [0, -0.01, -10.5], this.material("#414e47"));
    const roadPaint = this.material("#9fa78d");
    for (let x = -14; x < 15; x += 3)
      this.box([1.4, 0.026, 0.065], [x, 0.01, -10.5], roadPaint);
    this.box([29.8, 0.08, 0.18], [0, 0, -8.8], this.material("#89917a"));
    // Thin survey grid makes scale and motion readable without obscuring the scene.
    const grid = new THREE.GridHelper(30, 30, "#b6b89b", "#a9b09a");
    grid.position.y = -0.016;
    grid.material.transparent = true;
    grid.material.opacity = 0.09;
    this.scene.add(grid);
    const grassMaterial = this.material("#657550", { side: THREE.DoubleSide });
    const grassGeometry = new THREE.ConeGeometry(0.055, 0.3, 3);
    const grass = new THREE.InstancedMesh(grassGeometry, grassMaterial, 650);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 650; i++) {
      let x, z;
      do {
        x = (this.random() - 0.5) * 28;
        z = (this.random() - 0.5) * 24;
      } while (
        (Math.abs(x) < 5.1 && Math.abs(z) < 5.1) ||
        z < -8.5 ||
        (Math.abs(x) < 1.7 && z > 4)
      );
      dummy.position.set(x, 0.03, z);
      dummy.rotation.set(
        0,
        this.random() * Math.PI,
        (this.random() - 0.5) * 0.4,
      );
      dummy.scale.setScalar(0.7 + this.random() * 1.1);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(grass);
    this.createFence();
    [
      [-10, -5, 1.1],
      [-11, 1, 0.85],
      [11, -6, 1.1],
      [12, 9, 0.8],
    ].forEach(([x, z, scale]) => this.createTree(x, z, scale));
    // Gravel and shrubs around the perimeter, all generated locally.
    const stoneGeometry = new THREE.DodecahedronGeometry(0.25, 0);
    const stoneMaterial = this.material("#858975");
    for (let i = 0; i < 24; i++) {
      const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
      const side = i % 2 ? 1 : -1;
      stone.position.set(
        side * (7 + this.random() * 6),
        0.03,
        this.random() * 15 - 7,
      );
      stone.scale.set(
        1 + this.random(),
        0.3 + this.random() * 0.6,
        1 + this.random(),
      );
      stone.rotation.y = this.random() * 6;
      stone.castShadow = true;
      this.scene.add(stone);
    }
    const poleMaterial = this.material("#696552");
    [-13, 13].forEach((x) => {
      this.box([0.14, 6.4, 0.14], [x, 3.2, -8.2], poleMaterial);
      this.box([1.3, 0.12, 0.12], [x, 6.1, -8.2], poleMaterial);
    });
    for (const offset of [-0.45, 0.45]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-13 + offset, 6.2, -8.2),
        new THREE.Vector3(0, 4.9, -8.2),
        new THREE.Vector3(13 + offset, 6.2, -8.2),
      );
      this.scene.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve, 24, 0.018, 4, false),
          this.material("#252f2a"),
        ),
      );
    }
  }

  createFence() {
    const wood = this.material("#a09a79");
    for (let x = -11; x <= 11; x += 1.1) {
      if (Math.abs(x) < 2) continue;
      this.box([0.12, 1.1, 0.13], [x, 0.55, 10.3], wood);
    }
    [-1, 1].forEach((side) => {
      for (const y of [0.4, 0.85])
        this.box([9, 0.1, 0.09], [side * 6.8, y, 10.3], wood);
    });
    for (let z = -7; z < 11; z += 1.1)
      this.box([0.13, 1.1, 0.12], [-11.3, 0.55, z], wood);
    for (const y of [0.4, 0.85])
      this.box([0.09, 0.1, 18], [-11.3, y, 1.5], wood);
  }

  createTree(x, z, scale) {
    const group = new THREE.Group();
    this.box([0.24, 2, 0.24], [0, 1, 0], this.material("#625c45"), group);
    for (let layer = 0; layer < 3; layer++) {
      const foliage = new THREE.Mesh(
        new THREE.ConeGeometry(1.15 - layer * 0.22, 2.1, 7),
        this.material(["#41553d", "#4c6042", "#566c47"][layer]),
      );
      foliage.position.y = 2.2 + layer * 0.75;
      foliage.castShadow = true;
      group.add(foliage);
    }
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    this.scene.add(group);
  }

  createBrickTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    context.fillStyle = "#b6a68a";
    context.fillRect(0, 0, 512, 256);
    for (let row = 0; row < 10; row++) {
      for (let col = -1; col < 10; col++) {
        const shades = ["#b17b5b", "#aa7354", "#b58160", "#a77559", "#b78a68"];
        context.fillStyle = shades[Math.floor(this.random() * shades.length)];
        context.fillRect(
          col * 57 + (row % 2) * 28.5 + 1,
          row * 25.6 + 1,
          55,
          23.6,
        );
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1.8);
    texture.anisotropy = Math.min(
      8,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    return texture;
  }

  createHouse() {
    if (this.houseRoot) {
      this.scene.remove(this.houseRoot);
      this.disposeObject(this.houseRoot);
    }
    if (this.districtTerrain) {
      this.scene.remove(this.districtTerrain);
      this.disposeObject(this.districtTerrain);
      this.districtTerrain = null;
    }
    const experiment = this.simulation;
    this.districtMode = !!experiment.houses;
    this.terrainObjects?.forEach((o) => {
      o.visible = !this.districtMode;
    });
    const root = new THREE.Group(),
      meshes = new Map();
    this.districtMarkers = [];
    this.parcelTiles = new Map();
    if (this.districtMode) {
      this.districtTerrain = new THREE.Group();
      this.scene.add(this.districtTerrain);
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        this.material("#293c36"),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.06;
      ground.receiveShadow = true;
      this.districtTerrain.add(ground);
      if (experiment.active.layout)
        this.createNeighborhoodTerrain(experiment.active.layout);
      else {
        const extent = experiment.active.extent + 5;
        this.box(
          [extent * 2, 0.3, extent * 2],
          [0, -0.18, 0],
          this.material("#485c43"),
          this.districtTerrain,
        );
        const road = this.material("#3a4844"),
          curb = this.material("#a0a58c");
        for (let i = 0; i <= experiment.active.side; i++) {
          const q =
            (i - experiment.active.side / 2) * experiment.config.spacing;
          this.box(
            [3, 0.04, extent * 2],
            [q, -0.005, 0],
            road,
            this.districtTerrain,
          );
          this.box(
            [extent * 2, 0.04, 3],
            [0, -0.005, q],
            road,
            this.districtTerrain,
          );
        }
      }
      for (const house of experiment.houses) {
        const tile =
          this.parcelTiles?.get(house.parcelId) ?? this.material("#75836a");
        if (!experiment.active.layout)
          this.box(
            [8.4, 0.035, 8.4],
            [house.offset.x, -0.005, house.offset.z],
            tile,
            this.districtTerrain,
          );
        this.addParcelLabel(
          house.parcelId ? `${house.label} / ${house.parcelId}` : house.label,
          house.offset.x,
          6,
          house.offset.z,
          this.districtTerrain,
          experiment.active.layout ? 9 : 3.7,
        );
        this.districtMarkers.push({ house, tile });
      }
      const a = experiment.active.path.start,
        b = experiment.active.path.end;
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(a[0], 0.08, a[1]),
          new THREE.Vector3(b[0], 0.08, b[1]),
        ]),
        new THREE.LineDashedMaterial({
          color: "#e4b28a",
          dashSize: 1,
          gapSize: 0.7,
        }),
      );
      line.computeLineDistances();
      this.districtTerrain.add(line);
    }
    for (const house of experiment.houses ?? [{ simulation: experiment }]) {
      this.simulation = house.simulation;
      this.houseRoot = null;
      this.meshes = new Map();
      this.createOneHouse();
      root.add(this.houseRoot);
      for (const entry of this.meshes) meshes.set(...entry);
    }
    for (const piece of experiment.environment?.pieces ?? []) {
      const material = this.material(
        piece.kind === "crown"
          ? "#7a9d67"
          : piece.kind === "core"
            ? "#77867f"
            : piece.kind === "facade"
              ? "#c0b79a"
              : piece.kind === "window"
                ? "#719d9f"
                : "#947451",
      );
      const group = new THREE.Group();
      let mesh;
      if (piece.shape === "cylinder")
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(
            piece.size[0] / 2,
            piece.size[0] / 2,
            piece.size[1],
            8,
          ),
          material,
        );
      else if (piece.shape === "crown") {
        mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), material);
        mesh.scale.set(1, piece.size[1] / 1.5, 1);
      } else
        mesh = new THREE.Mesh(new THREE.BoxGeometry(...piece.size), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      root.add(group);
      meshes.set(piece, group);
    }
    for (const e of experiment.environment?.entities ?? []) {
      if (e.type !== "building") continue;
      const p = experiment.active.layout.parcels.find(
        (p) => p.id === e.parcelId,
      );
      this.addParcelLabel(
        e.id,
        p.world.x,
        experiment.config.buildingFloors * 3 + 1,
        p.world.z,
        this.districtTerrain,
        9,
      );
    }
    this.simulation = experiment;
    this.houseRoot = root;
    this.meshes = meshes;
    this.scene.add(root);
    this.houseRevision = experiment.revision;
    const key = experiment.config.mode + ":" + experiment.config.spacing;
    this.scene.fog.density = experiment.active.layout
      ? 0.0018
      : this.districtMode
        ? 0.006
        : 0.016;
    this.camera.far = Math.max(400, (experiment.active.extent ?? 22) * 8);
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = this.districtMode
      ? Math.max(220, experiment.active.extent * 4 + 20)
      : 60;
    const shadowSize = this.districtMode ? experiment.active.extent + 10 : 22;
    Object.assign(this.sun.shadow.camera, {
      left: -shadowSize,
      right: shadowSize,
      top: shadowSize,
      bottom: -shadowSize,
      far: 150,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    if (this.layoutKey !== key) {
      this.layoutKey = key;
      this.setView("perspective");
    }
  }

  addParcelLabel(text, x, y, z, parent, width = 9) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#142f29";
    ctx.fillRect(0, 0, 256, 80);
    ctx.font = `bold ${text.length > 10 ? 40 : 48}px sans-serif`;
    ctx.fillStyle = "#e1ede0";
    ctx.textAlign = "center";
    ctx.fillText(text, 128, 57);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        depthTest: false,
      }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(width, (width * 80) / 256, 1);
    parent.add(sprite);
  }

  createNeighborhoodTerrain(layout) {
    const root = new THREE.Group();
    root.rotation.y = layout.yaw;
    this.districtTerrain.add(root);
    this.box(
      [layout.width + 1, 0.3, layout.depth + 1],
      [0, -0.18, 0],
      this.material("#485c43"),
      root,
    );
    const pavement = this.material("#939780"),
      road = this.material("#35433f"),
      paint = this.material("#bcb7a2");
    for (const r of layout.roads) {
      this.box([r.width, 0.025, r.depth], [r.x, -0.006, r.z], road, root);
      if (r.id.startsWith("V"))
        for (let z = -layout.depth / 2 + 1; z < layout.depth / 2; z += 3) {
          if (
            layout.roads.some(
              (c) =>
                c.id.startsWith("H") && Math.abs(z - c.z) < c.depth / 2 + 1.2,
            )
          )
            continue;
          this.box([0.09, 0.008, 1.1], [r.x, 0.012, z], paint, root);
        }
      else
        for (let x = -layout.width / 2 + 1; x < layout.width / 2; x += 3) {
          if (
            layout.roads.some(
              (c) =>
                c.id.startsWith("V") && Math.abs(x - c.x) < c.width / 2 + 1.2,
            )
          )
            continue;
          this.box([1.1, 0.008, 0.09], [x, 0.012, r.z], paint, root);
        }
    }
    const colors = {
      house: "#75836a",
      green: "#4c7950",
      building: "#647d82",
      vacant: "#716e55",
    };
    for (const p of layout.parcels) {
      const tile = this.material(colors[p.type]);
      this.parcelTiles.set(p.id, tile);
      this.box(
        [p.size + 2 * layout.sidewalk, 0.04, p.size + 2 * layout.sidewalk],
        [p.x, -0.01, p.z],
        pavement,
        root,
      );
      this.box([p.size, 0.045, p.size], [p.x, -0.005, p.z], tile, root);
      if (p.type === "house") {
        const front = p.row % 2 ? -1 : 1,
          length = (p.size - 7.4) / 2;
        this.box(
          [1.3, 0.012, length],
          [p.x, 0.026, p.z + front * (3.7 + length / 2)],
          pavement,
          root,
        );
      } else if (p.type === "building") {
        const slab = this.material("#879d9c");
        for (const sign of [-1, 1]) {
          this.box([8, 0.015, 0.13], [p.x, 0.027, p.z + sign * 4], slab, root);
          this.box([0.13, 0.015, 8], [p.x + sign * 4, 0.027, p.z], slab, root);
        }
      } else if (p.type === "green") {
        this.box([p.size, 0.014, 1.2], [p.x, 0.028, p.z], pavement, root);
        this.box([1.2, 0.014, p.size], [p.x, 0.028, p.z], pavement, root);
        if (!this.simulation.environment)
          for (const sign of [-1, 1]) {
            const x = p.x + sign * p.size * 0.28,
              z = p.z + sign * p.size * 0.27;
            const trunk = new THREE.Mesh(
              new THREE.CylinderGeometry(0.12, 0.19, 1.7, 6),
              this.material("#695844"),
            );
            trunk.position.set(x, 0.85, z);
            trunk.castShadow = true;
            root.add(trunk);
            const crown = new THREE.Mesh(
              new THREE.IcosahedronGeometry(1.25, 0),
              this.material(sign === 1 ? "#83a46e" : "#5b8b5e"),
            );
            crown.position.set(x, 2.15, z);
            crown.scale.y = 1.3;
            crown.castShadow = true;
            root.add(crown);
          }
        if (!this.simulation.environment)
          for (const sign of [-1, 1]) {
            this.box(
              [1.8, 0.18, 0.55],
              [p.x + sign * 2.5, 0.45, p.z + sign * 1.5],
              this.material("#b29971"),
              root,
            );
            this.box(
              [1.8, 0.65, 0.1],
              [p.x + sign * 2.5, 0.7, p.z + sign * 1.8],
              this.material("#b29971"),
              root,
            );
          }
      }
      if (
        p.type !== "house" &&
        !(p.type === "building" && this.simulation.environment)
      )
        this.addParcelLabel(
          `${p.id} / ${p.type === "green" ? "VERDE" : p.type === "building" ? "RESERVA" : "LIBRE"}`,
          p.x,
          p.type === "green" ? 4 : 1.4,
          p.z,
          root,
        );
    }
  }

  createOneHouse() {
    if (this.houseRoot) {
      this.scene.remove(this.houseRoot);
      this.disposeObject(this.houseRoot);
    }
    this.meshes.clear();
    this.houseRoot = new THREE.Group();
    this.houseRevision = this.simulation.revision;
    this.scene.add(this.houseRoot);
    const { profile, roof } = this.simulation;
    const wallMaterial = this.material(
      profile.color,
      profile.id === "masonry" ? { map: this.createBrickTexture() } : {},
    );
    const roofMaterial = this.material(roof.color, {
      metalness: roof.id === "metal" ? 0.55 : 0.05,
      roughness: 0.7,
    });
    const ribs = this.material(roof.id === "tile" ? "#bf8961" : "#b4c5b8", {
      metalness: roof.id === "metal" ? 0.5 : 0,
    });
    const trim = this.material("#d9d3b7");
    const glass = this.material("#819e98", {
      metalness: 0.35,
      roughness: 0.3,
      emissive: "#716342",
      emissiveIntensity: 0.2,
    });
    const dark = this.material("#405e59");
    for (const piece of this.simulation.pieces) {
      const group = new THREE.Group();
      const [w, h, d] = piece.size;
      if (piece.kind === "roof") {
        this.box(piece.size, [0, 0, 0], roofMaterial, group);
        if (roof.id === "metal" || roof.id === "fiber") {
          const count = this.districtMode ? 0 : roof.id === "metal" ? 8 : 5;
          for (let i = 0; i < count; i++)
            this.box(
              [w, 0.03, 0.026],
              [0, h / 2 + 0.015, ((i - (count - 1) / 2) * d) / count],
              ribs,
              group,
            );
        } else if (roof.id === "tile") {
          for (let i = 0; i < 3; i++)
            this.box(
              [w, 0.025, 0.035],
              [0, h / 2 + 0.015, ((i - 1) * d) / 3],
              ribs,
              group,
            );
          this.box([0.03, 0.02, d], [0, h / 2 + 0.02, 0], ribs, group);
        } else {
          this.box([w, 0.15, 0.07], [0, h / 2 + 0.075, d / 2], trim, group);
          this.box([w, 0.15, 0.07], [0, h / 2 + 0.075, -d / 2], trim, group);
          this.box([0.07, 0.15, d], [-w / 2, h / 2 + 0.075, 0], trim, group);
          this.box([0.07, 0.15, d], [w / 2, h / 2 + 0.075, 0], trim, group);
        }
      } else if (piece.kind === "wall" && piece.details.framed) {
        // Open visual frame, coarse box collider documented in the model notes.
        for (const x of [-w / 2 + 0.045, 0, w / 2 - 0.045])
          this.box([0.09, h, 0.09], [x, 0, 0], wallMaterial, group);
        for (const y of [-h / 2 + 0.045, h / 2 - 0.045])
          this.box([w, 0.09, 0.09], [0, y, 0], wallMaterial, group);
        const brace = this.box(
          [0.07, Math.hypot(h - 0.15, w - 0.15), 0.07],
          [0, 0, 0],
          wallMaterial,
          group,
        );
        brace.rotation.z = Math.atan2(w - 0.15, h - 0.15);
      } else if (piece.kind === "cladding" && piece.details.secondary) {
        this.box(piece.size, [0, 0, 0], glass, group);
        for (const x of [-w / 2, w / 2])
          this.box([0.06, h + 0.1, 0.07], [x, 0, 0.02], trim, group);
        for (const y of [-h / 2, h / 2])
          this.box([w, 0.06, 0.07], [0, y, 0.02], trim, group);
        this.box([0.04, h, 0.06], [0, 0, 0.04], trim, group);
      } else {
        this.box(piece.size, [0, 0, 0], wallMaterial, group);
        if (piece.kind === "cladding" && !this.districtMode) {
          const groove = this.material(
            profile.id === "timber" ? "#756d51" : "#889c99",
          );
          for (let y = -h / 2 + 0.2; y < h / 2; y += 0.24)
            this.box([w, 0.012, 0.009], [0, y, d / 2 + 0.005], groove, group);
        }
      }
      const decorated =
        (piece.kind === "wall" &&
          !piece.details.framed &&
          profile.id !== "concrete") ||
        (piece.kind === "cladding" && !piece.details.secondary);
      const door = piece.details.front && piece.details.bay === 1;
      if (
        decorated ||
        (piece.kind === "wall" && profile.id === "concrete" && door)
      ) {
        if (door) {
          this.box([1.04, 2.18, 0.055], [0, -0.4, d / 2 + 0.035], trim, group);
          this.box([0.89, 2.04, 0.06], [0, -0.44, d / 2 + 0.07], dark, group);
          this.box([0.05, 0.1, 0.04], [0.32, -0.35, d / 2 + 0.12], trim, group);
        } else if (!this.districtMode || piece.details.front)
          this.addWindow(group, 0, 0.2, d / 2 + 0.035, trim, glass);
      }
      if (piece.kind === "wall") {
        const points = [];
        for (let i = 0; i < 10; i++)
          points.push(
            new THREE.Vector3(
              (i % 2 ? 0.1 : -0.08) + w * 0.35,
              -h / 2 + (i * h) / 9,
              d / 2 + 0.025,
            ),
          );
        const crack = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: "#3c2d23" }),
        );
        crack.visible = false;
        group.add(crack);
        group.userData.damageLine = crack;
        if (roof.id !== "slab" && [0, 2].includes(piece.details.facade)) {
          const worldX = (local) =>
            (piece.localOrigin ?? piece.origin).x +
            Math.cos(piece.details.angle) * local;
          const top = (local) => roofHeightAt(worldX(local)) - piece.origin.y;
          const shape = new THREE.Shape();
          shape.moveTo(-w / 2, h / 2);
          shape.lineTo(w / 2, h / 2);
          shape.lineTo(w / 2, top(w / 2));
          // Include the ridge in the middle bay.
          if (piece.details.bay === 1) shape.lineTo(0, top(0));
          shape.lineTo(-w / 2, top(-w / 2));
          shape.closePath();
          const gable = new THREE.Mesh(
            new THREE.ShapeGeometry(shape),
            this.material("#bcb499", { side: THREE.DoubleSide }),
          );
          gable.position.z = d / 2;
          gable.castShadow = true;
          group.add(gable);
        }
      }
      this.meshes.set(piece, group);
      this.houseRoot.add(group);
    }
    const marking = this.material("#b1c7ab", {
      emissive: "#5b7d68",
      emissiveIntensity: 0.3,
    });
    for (const x of this.districtMode ? [] : [-5.1, 5.1])
      for (const z of [-5.1, 5.1]) {
        this.box(
          [0.8, 0.02, 0.045],
          [x - Math.sign(x) * 0.35, 0.035, z],
          marking,
          this.houseRoot,
        );
        this.box(
          [0.045, 0.02, 0.8],
          [x, 0.035, z - Math.sign(z) * 0.35],
          marking,
          this.houseRoot,
        );
      }
  }

  disposeObject(root) {
    const geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of [object.material].flat().filter(Boolean)) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach((value) => value.dispose());
    materials.forEach((value) => value.dispose());
    textures.forEach((value) => value.dispose());
  }

  addWindow(parent, x, y, z, trim, glass) {
    this.box([1.45, 1.25, 0.055], [x, y, z], trim, parent);
    this.box([1.25, 1.05, 0.07], [x, y, z + 0.03], glass, parent);
    this.box([0.055, 1.08, 0.04], [x, y, z + 0.08], trim, parent);
    this.box([1.28, 0.055, 0.04], [x, y, z + 0.08], trim, parent);
    this.box([1.6, 0.08, 0.2], [x, y - 0.65, z + 0.02], trim, parent);
  }

  createVortex() {
    this.vortex = new THREE.Group();
    this.vortexParticles = 2200;
    this.particleData = [];
    const positions = new Float32Array(this.vortexParticles * 3);
    const colors = new Float32Array(this.vortexParticles * 3);
    for (let i = 0; i < this.vortexParticles; i++) {
      const height = this.random();
      this.particleData.push({
        height,
        angle: this.random() * Math.PI * 2,
        spread: this.random(),
        speed: 0.5 + this.random(),
      });
      const color = new THREE.Color().lerpColors(
        new THREE.Color("#beab83"),
        new THREE.Color("#a2b5a5"),
        height,
      );
      color.toArray(colors, i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = spriteCanvas.height = 32;
    const context = spriteCanvas.getContext("2d");
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.4, "#ffffff90");
    gradient.addColorStop(1, "#ffffff00");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    const material = new THREE.PointsMaterial({
      size: 0.42,
      map: new THREE.CanvasTexture(spriteCanvas),
      transparent: true,
      opacity: 0.4,
      vertexColors: true,
      depthWrite: false,
    });
    this.vortexPoints = new THREE.Points(geometry, material);
    this.vortexPoints.frustumCulled = false;
    this.vortex.add(this.vortexPoints);
    // Thin spiral streamlines clarify the rotating flow.
    this.spirals = [];
    for (let strand = 0; strand < 4; strand++) {
      const points = [];
      for (let i = 0; i <= 150; i++) {
        const t = i / 150;
        const radius = 0.25 + t ** 1.6 * 3;
        const angle = t * Math.PI * 9 + (strand * Math.PI) / 2;
        points.push(
          new THREE.Vector3(
            Math.cos(angle) * radius,
            t * 12.5,
            Math.sin(angle) * radius,
          ),
        );
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: "#c6cbb1",
          transparent: true,
          opacity: 0.15,
          depthWrite: false,
        }),
      );
      this.vortex.add(line);
      this.spirals.push(line);
    }
    this.scene.add(this.vortex);
    const circlePoints = [];
    for (let i = 0; i <= 160; i++) {
      const theta = (i / 160) * Math.PI * 2;
      circlePoints.push(
        new THREE.Vector3(Math.cos(theta), 0.035, Math.sin(theta)),
      );
    }
    this.influence = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(circlePoints),
      new THREE.LineDashedMaterial({
        color: "#e3b58b",
        transparent: true,
        opacity: 0.65,
        dashSize: 0.045,
        gapSize: 0.025,
      }),
    );
    this.influence.computeLineDistances();
    this.scene.add(this.influence);
    const centerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.36, 40),
      new THREE.MeshBasicMaterial({
        color: "#ddb38a",
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    centerRing.rotation.x = -Math.PI / 2;
    centerRing.position.y = 0.05;
    this.vortex.add(centerRing);
  }

  createRain() {
    const positions = new Float32Array(500 * 6);
    this.rainSeeds = [];
    for (let i = 0; i < 500; i++)
      this.rainSeeds.push([
        this.random() * 55 - 27,
        this.random() * 22,
        this.random() * 45 - 22,
      ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.rain = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: "#c4d8ce",
        transparent: true,
        opacity: 0.11,
        depthWrite: false,
      }),
    );
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  setView(view) {
    const positions = {
      perspective: [23, 19, 27],
      top: [0.5, 38, 0.1],
      front: [0, 10, 34],
    };
    if (this.simulation.houses) {
      const e = this.simulation.active.extent + 6;
      Object.assign(positions, {
        perspective: [e * 1.6, e * 1.5, e * 1.9],
        top: [0.5, e * 3, 0.1],
        front: [0, e, e * 3],
      });
    }
    if (this.simulation.active?.layout) {
      const e = this.simulation.active.extent + 6;
      positions.perspective = [e * 1.25, e * 1.35, e * 1.45];
    }
    this.camera.position.set(...positions[view]);
    this.controls.target.set(0.5, 2.5, 0);
    this.controls.update();
  }

  resize() {
    const { width, height } = this.canvas.parentElement.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  sync() {
    if (this.houseRevision !== this.simulation.revision) this.createHouse();
    for (const [piece, mesh] of this.meshes) {
      mesh.position.copy(piece.body.position);
      mesh.quaternion.copy(piece.body.quaternion);
      if (mesh.userData.damageLine)
        mesh.userData.damageLine.visible = piece.damage > 0;
    }
    for (const { house, tile } of this.districtMarkers ?? []) {
      const s = house.simulation.stats;
      tile.color.set(
        s.state === "Colapso del modelo"
          ? "#985b45"
          : s.structuralBroken
            ? "#a27e4b"
            : s.broken
              ? "#8c8d57"
              : "#75836a",
      );
    }
    const center = this.simulation.center;
    this.vortex.position.set(center.x, 0, center.z);
    this.influence.position.set(center.x, 0, center.z);
    this.influence.scale.set(
      this.simulation.config.radius,
      1,
      this.simulation.config.radius,
    );
    const time = this.simulation.elapsed;
    const speed = this.simulation.config.wind / 160;
    const positions = this.vortexPoints.geometry.attributes.position;
    for (let i = 0; i < this.vortexParticles; i++) {
      const data = this.particleData[i];
      const t = (data.height + time * 0.045 * speed) % 1;
      const radius = (0.25 + t ** 1.6 * 3) * (0.75 + data.spread * 0.5);
      const angle = data.angle + time * data.speed * 2.5 * speed - t * 8;
      positions.setXYZ(
        i,
        Math.cos(angle) * radius,
        t * 12.5,
        Math.sin(angle) * radius,
      );
    }
    positions.needsUpdate = true;
    this.spirals.forEach((line, i) => {
      line.rotation.y = time * speed * (1.5 + i * 0.1);
    });
    const rainPositions = this.rain.geometry.attributes.position;
    for (let i = 0; i < this.rainSeeds.length; i++) {
      const [x, seedY, z] = this.rainSeeds[i];
      const y = (((seedY - time * 12) % 22) + 22) % 22;
      rainPositions.setXYZ(i * 2, x, y, z);
      rainPositions.setXYZ(i * 2 + 1, x - 0.12, y - 0.6, z + 0.05);
    }
    rainPositions.needsUpdate = true;
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.controls.dispose();
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    this.scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of [object.material].flat().filter(Boolean)) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    this.renderer.dispose();
  }
}
