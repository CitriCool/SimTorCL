import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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
    this.scene.add(sun);
    this.createTerrain();
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
    const brick = this.material("#e6d5ba", {
      map: this.createBrickTexture(),
      roughness: 0.95,
    });
    const metal = this.material("#8daba8", { metalness: 0.55, roughness: 0.5 });
    const ribs = this.material("#b4c5b8", { metalness: 0.55, roughness: 0.4 });
    const trim = this.material("#d9d3b7");
    const window = this.material("#9ba996", {
      metalness: 0.35,
      roughness: 0.3,
      emissive: "#8d7a47",
      emissiveIntensity: 0.2,
    });
    for (const piece of this.simulation.pieces) {
      const group = new THREE.Group();
      this.box(
        piece.size,
        [0, 0, 0],
        piece.kind === "wall" ? brick : metal,
        group,
      );
      if (piece.kind === "roof") {
        for (let i = 0; i < 9; i++) {
          this.box(
            [piece.size[0], 0.035, 0.026],
            [0, 0.037, (i - 4) * 0.208],
            ribs,
            group,
          );
        }
      } else if (piece.details.front) {
        this.box([1.03, 2.17, 0.065], [0.65, -0.41, 0.16], trim, group);
        this.box(
          [0.87, 2.03, 0.075],
          [0.65, -0.45, 0.195],
          this.material("#405e59"),
          group,
        );
        this.box(
          [0.05, 0.12, 0.04],
          [0.96, -0.4, 0.25],
          this.material("#c6af72"),
          group,
        );
        this.addWindow(group, -1.55, 0.25, 0.17, trim, window);
        this.box(
          [1.3, 0.16, 0.7],
          [0.65, -1.43, 0.4],
          this.material("#9a9e89"),
          group,
        );
      } else if (piece.details.side) {
        // Rotate a window unit onto the east facade.
        for (const z of [-1.5, 1.5]) {
          const windowGroup = new THREE.Group();
          windowGroup.rotation.y = Math.PI / 2;
          windowGroup.position.set(0.18, 0.2, z);
          this.addWindow(windowGroup, 0, 0, 0, trim, window);
          group.add(windowGroup);
        }
      }
      this.meshes.set(piece, group);
      this.scene.add(group);
    }
    // Gables and ridge cap are decorative parts of the roof structure.
    const shape = new THREE.Shape();
    shape.moveTo(-3.3, 3.03);
    shape.lineTo(3.3, 3.03);
    shape.lineTo(0, 4.27);
    shape.closePath();
    for (const z of [-3.22, 3.22]) {
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        this.material("#bcb499", { side: THREE.DoubleSide }),
      );
      mesh.position.z = z;
      mesh.castShadow = true;
      this.scene.add(mesh);
      for (let x = -2.5; x <= 2.5; x += 0.25) {
        const height = 1.21 - Math.abs(x) * 0.36;
        this.box(
          [0.024, height, 0.03],
          [x, 3.03 + height / 2, z + Math.sign(z) * 0.01],
          trim,
        );
      }
    }
    this.box([0.11, 0.07, 7.7], [0, 4.38, 0], trim);
    this.box([0.12, 0.12, 7.5], [-3.55, 3.06, 0], trim);
    this.box([0.12, 0.12, 7.5], [3.55, 3.06, 0], trim);
    // Survey corners identify the subject of the experiment.
    const marking = this.material("#b1c7ab", {
      emissive: "#5b7d68",
      emissiveIntensity: 0.3,
    });
    for (const x of [-5.1, 5.1])
      for (const z of [-5.1, 5.1]) {
        this.box(
          [0.8, 0.02, 0.045],
          [x - Math.sign(x) * 0.35, 0.035, z],
          marking,
        );
        this.box(
          [0.045, 0.02, 0.8],
          [x, 0.035, z - Math.sign(z) * 0.35],
          marking,
        );
      }
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
    for (const [piece, mesh] of this.meshes) {
      mesh.position.copy(piece.body.position);
      mesh.quaternion.copy(piece.body.quaternion);
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
