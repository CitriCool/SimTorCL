import * as CANNON from "cannon-es";
import { dynamicPressure } from "./aerodynamics.js";
import { DebrisImpacts } from "./impacts.js";
import { applyFragmentAir, equivalentAir } from "./fragment-flight.js";
import {
  groundedWalls,
  createLoadNetwork,
  connectionLoads,
} from "./load-path.js";
import {
  ENCLOSURE_MODEL,
  openingState,
  roomPressure,
  addRoomLoad,
} from "./enclosure.js";
import {
  DEFAULTS,
  PRESETS,
  PROFILES,
  ROOFS,
  HOUSE,
  roofHeightAt,
  validateConfig,
} from "./catalog.js";
export { DEFAULTS, PRESETS };
export const FIXED_STEP = 1 / 120;
export const RULES = Object.freeze({
  stableDisplacement: 0.05,
  stableTilt: 5,
  collapseTilt: 45,
  collapseDrop: 0.8,
  collapseFraction: 0.5,
  overloadSeconds: 0.12,
});
const UP = new CANNON.Vec3(0, 1, 0);

export function createWorld() {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
    allowSleep: true,
  });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 15;
  world.defaultContactMaterial.friction = 0.65;
  world.defaultContactMaterial.restitution = 0.03;
  const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);
  return world;
}

// Altitude-limited illustrative field. Forces scale with v² (m, s, kg, N).
export function windAt(position, center, config, area = 1) {
  const dx = position.x - center.x,
    dz = position.z - center.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= config.radius || config.wind === 0) return new CANNON.Vec3();
  const attenuation =
    (1 - distance / config.radius) ** 1.15 *
    Math.max(0, 1 - Math.max(0, position.y ?? 0) / 32);
  const load = dynamicPressure(config.wind / 3.6) * area * attenuation;
  const inverse = 1 / Math.max(distance, 0.25);
  return new CANNON.Vec3(
    (-dz * 0.85 - dx * 0.18) * inverse * load,
    load * 0.7,
    (dx * 0.85 - dz * 0.18) * inverse * load,
  );
}

export class Simulation {
  constructor(config = {}) {
    this.revision = 0;
    this.reset(config);
  }
  reset(config = {}) {
    this.config = validateConfig({ ...this.config, ...config });
    this.profile = PROFILES[this.config.profile];
    this.roof = ROOFS[this.config.roof];
    this.world = createWorld();
    this.events = [];
    this.pieces = [];
    this.connections = [];
    this.facades = [];
    this.elapsed = 0;
    this.center = new CANNON.Vec3();
    this.peakDisplacement = 0;
    this.peakTilt = 0;
    this.createHouse();
    this.frontOpening =
      this.config.enclosure === "front-opening"
        ? this.facades[0].walls[1]
        : null;
    this.indoorPressure = 0;
    this.indoorOpeningArea = this.frontOpening
      ? ENCLOSURE_MODEL.initialOpeningArea
      : 0;
    if (this.config.enclosure !== "off") {
      this.pressureAreas = this.pieces.map((piece) =>
        piece.kind === "wall" && piece.details.framed ? 0 : piece.area,
      );
      let frontFace = this.frontOpening;
      for (const piece of this.pieces) {
        if (piece.kind !== "cladding") continue;
        const wall = piece.connections[0].b;
        if (piece.details.secondary) this.pressureAreas[wall.id] -= piece.area;
        if (wall === this.frontOpening && wall.details.framed)
          frontFace = piece;
      }
      if (frontFace)
        this.pressureAreas[frontFace.id] -= ENCLOSURE_MODEL.initialOpeningArea;
    }
    this.impacts = null;
    this.loadNetwork = null;
    this.updateCenter();
    this.revision++;
  }
  addPiece(kind, size, position, rotation, mass, details = {}) {
    this.loadNetwork = null;
    // Intact bonds are ideal rigid attachments. This graph does not solve
    // elastic strain or stress redistribution. Released pieces become dynamic.
    const body = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(...position),
      shape: new CANNON.Box(new CANNON.Vec3(...size.map((v) => v / 2))),
      linearDamping: 0.1,
      angularDamping: 0.4,
    });
    body.quaternion.setFromEuler(...rotation);
    this.world.addBody(body);
    const piece = {
      id: this.pieces.length,
      kind,
      body,
      size,
      mass,
      area: kind === "roof" ? size[0] * size[2] : size[0] * size[1],
      origin: body.position.clone(),
      orientation: body.quaternion.clone(),
      details,
      connections: [],
      detached: false,
      damage: 0,
      demand: 0,
      load: new CANNON.Vec3(),
    };
    this.pieces.push(piece);
    return piece;
  }
  connect(kind, a, b, capacity) {
    this.loadNetwork = null;
    const connection = {
      id: this.connections.length,
      kind,
      a,
      b,
      capacity,
      stress: 0,
      broken: false,
    };
    this.connections.push(connection);
    a.connections.push(connection);
    b?.connections.push(connection);
    return connection;
  }
  createHouse() {
    const { width, depth, height, bays } = HOUSE;
    const thickness = this.profile.thickness;
    const specs = [
      {
        name: "Frente",
        center: [0, height / 2, depth / 2],
        angle: 0,
        length: width + thickness,
      },
      {
        name: "Derecha",
        center: [width / 2, height / 2, 0],
        angle: Math.PI / 2,
        length: depth - thickness,
      },
      {
        name: "Fondo",
        center: [0, height / 2, -depth / 2],
        angle: Math.PI,
        length: width + thickness,
      },
      {
        name: "Izquierda",
        center: [-width / 2, height / 2, 0],
        angle: -Math.PI / 2,
        length: depth - thickness,
      },
    ];
    specs.forEach((spec, facade) => {
      const walls = [],
        span = spec.length / bays;
      for (let bay = 0; bay < bays; bay++) {
        const offset = (bay - (bays - 1) / 2) * span;
        const position = [
          spec.center[0] + Math.cos(spec.angle) * offset,
          height / 2,
          spec.center[2] - Math.sin(spec.angle) * offset,
        ];
        const details = {
          facade,
          bay,
          angle: spec.angle,
          front: facade === 0,
          framed: this.profile.family === "Estructura liviana",
        };
        const size = [span - 0.015, height, thickness];
        const wall = this.addPiece(
          "wall",
          size,
          position,
          [0, spec.angle, 0],
          size[0] * height * this.profile.arealMass,
          details,
        );
        walls.push(wall);
        this.connect(
          "base",
          wall,
          null,
          wall.area * this.profile.jointPressure,
        );
        if (bay > 0)
          this.connect(
            "wall",
            walls[bay - 1],
            wall,
            wall.area * this.profile.jointPressure * 0.7,
          );
        if (
          this.profile.claddingPressure &&
          !(this.profile.id === "concrete" && facade === 0 && bay === 1)
        ) {
          const secondary = this.profile.id === "concrete";
          const faceSize = secondary
            ? [1.25, 1.05, 0.045]
            : [size[0] - 0.025, height - 0.04, 0.035];
          const distance = thickness / 2 + faceSize[2] / 2 + 0.025;
          const clad = this.addPiece(
            "cladding",
            faceSize,
            [
              position[0] + Math.sin(spec.angle) * distance,
              height / 2 + (secondary ? 0.2 : 0),
              position[2] + Math.cos(spec.angle) * distance,
            ],
            [0, spec.angle, 0],
            faceSize[0] * faceSize[1] * this.profile.claddingMass,
            { ...details, secondary },
          );
          this.connect(
            "cladding",
            clad,
            wall,
            clad.area * this.profile.claddingPressure,
          );
        }
      }
      this.facades.push({ name: spec.name, walls });
    });
    for (let facade = 0; facade < 4; facade++) {
      const a = this.facades[facade].walls[bays - 1],
        b = this.facades[(facade + 1) % 4].walls[0];
      this.connect(
        "corner",
        a,
        b,
        Math.min(a.area, b.area) * this.profile.jointPressure * 0.9,
      );
    }
    if (this.roof.id === "slab") {
      const side = width + 2 * HOUSE.eave;
      const roof = this.addPiece(
        "roof",
        [side, this.roof.thickness, side],
        [0, height + this.roof.thickness / 2 + 0.015, 0],
        [0, 0, 0],
        side * side * this.roof.arealMass,
        { slab: true },
      );
      this.facades.forEach(({ walls }) =>
        this.connect(
          "roof",
          roof,
          walls[1],
          (roof.area * this.roof.fixingPressure) / 4,
        ),
      );
    } else {
      const half = width / 2 + HOUSE.eave,
        panelX = half / this.roof.columns,
        panelZ = (depth + 2 * HOUSE.eave) / this.roof.rows;
      for (const side of [-1, 1])
        for (let column = 0; column < this.roof.columns; column++)
          for (let row = 0; row < this.roof.rows; row++) {
            const x = side * (column + 0.5) * panelX,
              z = (row - (this.roof.rows - 1) / 2) * panelZ;
            const size = [
              panelX / Math.cos(HOUSE.pitch) - 0.012,
              this.roof.thickness,
              panelZ - 0.012,
            ];
            const roof = this.addPiece(
              "roof",
              size,
              [x, roofHeightAt(x), z],
              [0, 0, -side * HOUSE.pitch],
              size[0] * size[2] * this.roof.arealMass,
              { side, row, column },
            );
            const nearest = this.pieces
              .filter((p) => p.kind === "wall")
              .sort(
                (a, b) =>
                  Math.hypot(a.origin.x - x, a.origin.z - z) -
                  Math.hypot(b.origin.x - x, b.origin.z - z),
              )
              .slice(0, 2);
            nearest.forEach((wall) =>
              this.connect(
                "roof",
                roof,
                wall,
                (roof.area * this.roof.fixingPressure) / 2,
              ),
            );
          }
    }
  }
  updateCenter() {
    const angle = this.elapsed * 0.17 + 0.6;
    this.center.set(Math.cos(angle) * 5.5, 0, Math.sin(angle) * 4.4);
  }
  logEvent(data) {
    const event = { id: this.events.length + 1, time: this.elapsed, ...data };
    this.events.push(event);
    return event.id;
  }
  breakConnection(connection, cause, demand = 0, impact) {
    if (connection.broken) return;
    connection.broken = true;
    this.loadNetwork = null;
    connection.cause = cause;
    const parents = [
      connection.b?.releaseEventId,
      ...connection.a.connections
        .filter((c) => c !== connection && c.broken)
        .map((c) => c.eventId),
    ].filter(Boolean);
    connection.eventId = this.logEvent({
      type: "connection",
      connectionId: connection.id,
      kind: connection.kind,
      pieceId: connection.a.id,
      otherPieceId: connection.b?.id ?? null,
      cause,
      demand,
      capacity: (connection.capacity * this.config.reinforcement) / 100,
      parents: [...new Set(parents)],
      ...(impact ? { impact } : {}),
    });
  }
  breakImpact(connection, demand, impact) {
    this.breakConnection(connection, "impact", demand, impact);
  }
  release(piece) {
    if (piece.detached) return;
    const parents = piece.connections
      .filter((c) => c.broken)
      .map((c) => c.eventId)
      .filter(Boolean);
    if (piece.kind === "wall" && !parents.length)
      parents.push(
        ...this.connections
          .filter(
            (c) => c.broken && ["base", "wall", "corner"].includes(c.kind),
          )
          .map((c) => c.eventId)
          .filter(Boolean),
      );
    piece.releaseEventId = this.logEvent({
      type: "release",
      pieceId: piece.id,
      kind: piece.kind,
      cause: "support",
      mass: piece.mass,
      parents: [...new Set(parents)],
    });
    piece.detached = true;
    this.loadNetwork = null;
    piece.body.mass = piece.mass;
    piece.body.type = CANNON.Body.DYNAMIC;
    piece.body.updateMassProperties();
    piece.body.updateSolveMassProperties();
    piece.body.aabbNeedsUpdate = true;
    piece.body.wakeUp();
  }
  resolveSupports() {
    const anchored = groundedWalls(this.pieces, this.connections);
    // Resolve structural supports first, then their roof and cladding dependents.
    for (const piece of this.pieces)
      if (piece.kind === "wall" && !anchored.has(piece.id)) this.release(piece);
    for (const piece of this.pieces) {
      if (piece.kind === "cladding") {
        const mount = piece.connections.find((c) => c.kind === "cladding");
        if (mount.b.detached) {
          this.breakConnection(mount, "support");
        }
        if (mount.broken) this.release(piece);
      } else if (piece.kind === "roof") {
        const mounts = piece.connections.filter((c) => c.kind === "roof");
        for (const mount of mounts)
          if (mount.b.detached) {
            this.breakConnection(mount, "support");
          }
        const supported = mounts.filter((c) => !c.broken).length;
        if (supported < (piece.details.slab ? 3 : 1)) {
          for (const mount of mounts) {
            this.breakConnection(mount, "support");
          }
          this.release(piece);
        }
      }
      piece.damage = piece.connections.filter(
        (c) =>
          c.broken &&
          (piece.kind !== "wall" ||
            ["base", "wall", "corner"].includes(c.kind)),
      ).length;
    }
    // Unbroken bonds in a released cluster remain rigid physical connections.
    for (const connection of this.connections) {
      if (connection.broken && connection.constraint) {
        this.world.removeConstraint(connection.constraint);
        connection.constraint = null;
      } else if (
        !connection.broken &&
        connection.b &&
        connection.a.detached &&
        connection.b.detached &&
        !connection.constraint
      ) {
        connection.constraint = new CANNON.LockConstraint(
          connection.a.body,
          connection.b.body,
          { maxForce: 1e7 },
        );
        connection.constraint.collideConnected = false;
        this.world.addConstraint(connection.constraint);
      }
    }
  }
  step() {
    this.prepareStep();
    if (this.config.impact !== "off") {
      this.impacts ??= new DebrisImpacts(
        [{ label: "C01", simulation: this }],
        this.config.impact,
      );
      this.impacts.step(this.world, FIXED_STEP);
    } else this.world.step(FIXED_STEP);
    this.finishStep();
  }
  prepareStep(field = null, time = null) {
    this.config = validateConfig(this.config);
    this.elapsed += FIXED_STEP;
    this.updateCenter();
    if (field) this.center.copy(field);
    if (time !== null) this.elapsed = time;
    const ramp = Math.min(this.elapsed / 1.8, 1);
    if (this.config.enclosure !== "off") {
      const openings = openingState(this.pieces, this.frontOpening);
      this.indoorOpeningArea = openings.reduce(
        (sum, opening) => sum + opening.area,
        0,
      );
      this.indoorPressure = roomPressure(openings, (position) =>
        windAt(position, this.center, this.config).scale(ramp),
      );
    }
    for (const piece of this.pieces) {
      const { body } = piece;
      const force = windAt(body.position, this.center, this.config, piece.area);
      force.scale(ramp, force);
      if (piece.kind !== "roof") {
        const normal = body.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
        const normalLoad = force.x * normal.x + force.z * normal.z;
        force.x = normal.x * normalLoad + force.x * 0.12;
        force.z = normal.z * normalLoad + force.z * 0.12;
        force.y *= 0.12;
      }
      if (!piece.detached && this.indoorPressure !== 0)
        addRoomLoad(
          force,
          piece,
          this.indoorPressure,
          this.pressureAreas[piece.id] ?? piece.area,
        );
      piece.demand =
        piece.kind === "roof"
          ? Math.max(0, force.y - piece.mass * 9.82)
          : Math.hypot(force.x, force.z);
      piece.load.copy(force);
    }
    let routed;
    if (this.config.loadPath !== "off") {
      this.loadNetwork ??= createLoadNetwork(this.pieces, this.connections);
      routed = connectionLoads(this.loadNetwork);
    }
    let changed = false;
    for (const connection of this.connections) {
      if (connection.broken) continue;
      const { a, b, kind } = connection;
      let demand;
      if (routed) {
        demand = routed.get(connection)?.length() ?? 0;
        connection.demand = demand;
      } else {
        const sharing = a.connections.filter(
          (c) => c.kind === kind && !c.broken,
        ).length;
        demand = kind === "roof" ? a.demand / sharing : a.demand;
        if (kind === "wall" || kind === "corner")
          demand = Math.max(a.demand, b.demand) * 0.75;
      }
      connection.stress =
        demand > (connection.capacity * this.config.reinforcement) / 100
          ? connection.stress + FIXED_STEP
          : Math.max(0, connection.stress - FIXED_STEP * 2);
      if (connection.stress + 1e-9 >= RULES.overloadSeconds) {
        this.breakConnection(connection, "overload", demand);
        changed = true;
      }
    }
    if (changed) this.resolveSupports();
    for (const piece of this.pieces) {
      if (!piece.detached) continue;
      const { body } = piece;
      if (this.config.fragmentFlight === "projected-v1") {
        applyFragmentAir(
          body,
          piece.size,
          equivalentAir(windAt(body.position, this.center, this.config), ramp),
          FIXED_STEP,
        );
        continue;
      }
      const velocity = body.velocity.length();
      const drag = body.velocity.scale(
        -0.5 * 1.225 * piece.area * 0.7 * velocity,
      );
      body.applyForce(
        piece.load.vadd(drag),
        new CANNON.Vec3(piece.kind === "roof" ? 0.1 : 0, 0.1, 0),
      );
    }
  }
  finishStep() {
    for (const piece of this.pieces) {
      if (piece.detached) {
        // Floor-only penetration correction for thin fragments, not general CCD.
        piece.body.updateAABB();
        const bottom = piece.body.aabb.lowerBound.y;
        if (bottom < -0.01) {
          piece.body.position.y -= bottom;
          if (piece.body.velocity.y < 0) piece.body.velocity.y *= -0.03;
          piece.body.aabbNeedsUpdate = true;
        }
      }
      if (piece.kind === "wall") {
        const displacement = piece.body.position.distanceTo(piece.origin);
        const tilt =
          (Math.acos(
            Math.max(-1, Math.min(1, piece.body.quaternion.vmult(UP).y)),
          ) *
            180) /
          Math.PI;
        this.peakDisplacement = Math.max(this.peakDisplacement, displacement);
        this.peakTilt = Math.max(this.peakTilt, tilt);
      }
    }
  }
  get stats() {
    const walls = this.pieces.filter((p) => p.kind === "wall"),
      roof = this.pieces.filter((p) => p.kind === "roof"),
      secondary = this.pieces.filter((p) => p.kind === "cladding");
    const stable = this.facades.filter((f) =>
      f.walls.every(
        (p) =>
          !p.detached &&
          p.body.position.distanceTo(p.origin) < RULES.stableDisplacement &&
          p.body.quaternion.vmult(UP).y >
            Math.cos((RULES.stableTilt * Math.PI) / 180),
      ),
    ).length;
    const fallen = walls.filter(
      (p) =>
        p.body.quaternion.vmult(UP).y <
          Math.cos((RULES.collapseTilt * Math.PI) / 180) ||
        p.origin.y - p.body.position.y > RULES.collapseDrop,
    ).length;
    const structuralBroken = this.connections.filter(
      (c) => c.broken && ["base", "wall", "corner"].includes(c.kind),
    ).length;
    const wallDetached = walls.filter((p) => p.detached).length;
    const state =
      fallen / walls.length >= RULES.collapseFraction
        ? "Colapso del modelo"
        : stable <= 2
          ? "Pérdida de soporte"
          : wallDetached || structuralBroken
            ? "Daño localizado"
            : "Estable";
    return {
      detached: roof.filter((p) => p.detached).length,
      total: roof.length,
      wallDetached,
      wallTotal: walls.length,
      wallDamaged: walls.filter((p) => p.damage > 0).length,
      secondaryDetached: secondary.filter((p) => p.detached).length,
      secondaryTotal: secondary.length,
      stable,
      facadeTotal: this.facades.length,
      fallen,
      state,
      broken: this.connections.filter((c) => c.broken).length,
      connectionTotal: this.connections.length,
      structuralBroken,
      maxDisplacement: this.peakDisplacement,
      maxTilt: this.peakTilt,
      elapsed: this.elapsed,
      ...(this.config.enclosure !== "off"
        ? {
            enclosure: {
              pressure: this.indoorPressure,
              openingArea: this.indoorOpeningArea,
            },
          }
        : {}),
    };
  }
}
