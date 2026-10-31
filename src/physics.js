import * as CANNON from "cannon-es";

export const FIXED_STEP = 1 / 60;
export const DEFAULTS = Object.freeze({ wind: 160, radius: 8, fastening: 55 });
export const PRESETS = Object.freeze({ suave: 85, fuerte: 160, extremo: 250 });
const PANEL_MASS = 0.8;

// An illustrative pressure field, in metres, seconds, kilograms and newtons.
// It is deliberately separate from rendering so physical behavior is testable.
export function windAt(position, center, config, area = 1) {
  const dx = position.x - center.x;
  const dz = position.z - center.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= config.radius || config.wind <= 0) return new CANNON.Vec3();
  const attenuation = (1 - distance / config.radius) ** 1.15;
  const pressure = 0.5 * 1.225 * (config.wind / 3.6) ** 2;
  const load = pressure * area * attenuation;
  const inverse = 1 / Math.max(distance, 0.25);
  return new CANNON.Vec3(
    (-dz * inverse * 0.025 - dx * inverse * 0.008) * load,
    load * 0.07,
    (dx * inverse * 0.025 - dz * inverse * 0.008) * load,
  );
}

export class Simulation {
  constructor(config = {}) {
    this.config = { ...DEFAULTS, ...config };
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
      allowSleep: true,
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.solver.iterations = 15;
    this.world.defaultContactMaterial.friction = 0.65;
    this.world.defaultContactMaterial.restitution = 0.02;
    this.center = new CANNON.Vec3();
    this.elapsed = 0;
    this.pieces = [];
    const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);
    this.createHouse();
    this.updateCenter();
  }

  createHouse() {
    const wallSpecs = [
      { size: [6.64, 3, 0.24], position: [0, 1.5, 3.2], front: true },
      { size: [6.64, 3, 0.24], position: [0, 1.5, -3.2] },
      { size: [0.24, 3, 6.16], position: [-3.2, 1.5, 0] },
      { size: [0.24, 3, 6.16], position: [3.2, 1.5, 0], side: true },
    ];
    wallSpecs.forEach((spec) =>
      this.addPiece("wall", 800, spec.size, spec.position, 0, spec),
    );
    const pitch = 0.34;
    for (const side of [-1, 1]) {
      for (let column = 0; column < 2; column++) {
        for (let row = 0; row < 4; row++) {
          const x = side * (column + 0.5) * 1.84;
          const y = 4.36 - Math.abs(x) * Math.tan(pitch);
          const z = (row - 1.5) * 1.89;
          this.addPiece(
            "roof",
            0,
            [1.94, 0.055, 1.87],
            [x, y, z],
            side * pitch,
          );
        }
      }
    }
  }

  addPiece(kind, mass, size, position, tilt, details = {}) {
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(...size.map((v) => v / 2))),
      position: new CANNON.Vec3(...position),
      linearDamping: kind === "roof" ? 0.18 : 0.65,
      angularDamping: kind === "roof" ? 0.35 : 0.8,
      sleepSpeedLimit: 0.06,
      sleepTimeLimit: 1,
    });
    body.quaternion.setFromEuler(0, 0, -tilt);
    this.world.addBody(body);
    this.pieces.push({
      kind,
      body,
      size,
      origin: body.position.clone(),
      orientation: body.quaternion.clone(),
      detached: false,
      stress: 0,
      details,
    });
  }

  updateCenter() {
    const angle = this.elapsed * 0.17 + 0.6;
    this.center.set(Math.cos(angle) * 5.5, 0, Math.sin(angle) * 4.4);
  }

  step(dt = FIXED_STEP) {
    this.elapsed += dt;
    this.updateCenter();
    const ramp = Math.min(this.elapsed / 1.8, 1);
    for (const piece of this.pieces) {
      const { body, kind } = piece;
      const area = kind === "roof" ? piece.size[0] * piece.size[2] : 1;
      const force = windAt(body.position, this.center, this.config, area);
      force.scale(ramp, force);
      if (kind === "roof" && !piece.detached) {
        // Requiring sustained overload prevents a single-frame release.
        const resistance =
          this.config.fastening * (0.92 + (piece.origin.z + 3) * 0.025);
        piece.stress =
          force.y > resistance + PANEL_MASS * 9.82
            ? piece.stress + dt
            : Math.max(0, piece.stress - dt * 2);
        if (piece.stress >= 0.12) {
          piece.detached = true;
          body.mass = PANEL_MASS;
          body.type = CANNON.Body.DYNAMIC;
          body.updateMassProperties();
          body.updateSolveMassProperties();
          body.wakeUp();
        }
      }
      if (kind === "wall") {
        // Walls are dynamic, but receive a much smaller effective load.
        force.scale(0.16, force);
        body.applyForce(force);
      } else if (piece.detached) {
        // Apply at a body-relative point, not a world-space position.
        body.applyForce(force, new CANNON.Vec3(0.16, 0, 0.12));
      }
    }
    this.world.step(dt);
  }

  reset() {
    this.elapsed = 0;
    this.world.time = 0;
    this.world.stepnumber = 0;
    this.world.accumulator = 0;
    for (const piece of this.pieces) {
      const { body } = piece;
      body.position.copy(piece.origin);
      body.previousPosition.copy(piece.origin);
      body.interpolatedPosition.copy(piece.origin);
      body.quaternion.copy(piece.orientation);
      body.previousQuaternion.copy(piece.orientation);
      body.interpolatedQuaternion.copy(piece.orientation);
      body.velocity.setZero();
      body.angularVelocity.setZero();
      body.force.setZero();
      body.torque.setZero();
      if (piece.kind === "roof") {
        body.mass = 0;
        body.type = CANNON.Body.STATIC;
        body.updateMassProperties();
        body.updateSolveMassProperties();
      }
      body.aabbNeedsUpdate = true;
      body.wakeUp();
      piece.detached = false;
      piece.stress = 0;
    }
    // Discard old contacts and warm-start data when rebuilding the scenario.
    this.world.contacts.length = 0;
    this.world.frictionEquations.length = 0;
    this.world.collisionMatrix.reset();
    this.world.collisionMatrixPrevious.reset();
    this.world.broadphase.dirty = true;
    this.updateCenter();
  }

  get stats() {
    const roof = this.pieces.filter((p) => p.kind === "roof");
    const walls = this.pieces.filter((p) => p.kind === "wall");
    const stable = walls.filter(({ body, origin }) => {
      const up = body.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
      return (
        up.y > Math.cos((5 * Math.PI) / 180) &&
        Math.hypot(body.position.x - origin.x, body.position.z - origin.z) <
          0.05
      );
    }).length;
    return {
      detached: roof.filter((p) => p.detached).length,
      total: roof.length,
      stable,
      elapsed: this.elapsed,
    };
  }
}
