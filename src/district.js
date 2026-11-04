import { UrbanEnvironment } from "./environment.js";
import { generateNeighborhood, housePlacements } from "./urban.js";
import * as CANNON from "cannon-es";
import { Simulation, FIXED_STEP, createWorld } from "./physics.js";
import { RunRecorder, cleanConfig } from "./records.js";
import { PROFILES, ROOFS, validateConfig } from "./catalog.js";
import { routePoints, alongRoute } from "./route.js";
import { DebrisImpacts } from "./impacts.js";

export class District {
  constructor(config) {
    this.config = cleanConfig(config);
    config = this.config;
    if (!["block9", "block16", "neighborhood"].includes(config.mode))
      throw new RangeError("Escenario urbano desconocido.");
    const { mode, distribution, spacing } = config;
    this.layout = mode === "neighborhood" ? generateNeighborhood(config) : null;
    this.side = mode === "block9" ? 3 : 4;
    this.extent = this.layout
      ? Math.max(this.layout.bounds.width, this.layout.bounds.depth) / 2 + 2
      : ((this.side - 1) * spacing) / 2 + 6;
    const halfX = this.layout
      ? this.layout.bounds.width / 2 + 6
      : this.extent + 6;
    const halfZ = this.layout
      ? this.layout.bounds.depth / 2 + 6
      : this.extent + 6;
    this.path = {
      start:
        config.trajectory === "horizontal"
          ? [-halfX, 0]
          : config.trajectory === "vertical"
            ? [0, -halfZ]
            : [-halfX, -halfZ],
    };
    this.path.end = this.path.start.map((v) => -v);
    this.path.points = routePoints(config, this.layout) ?? [
      this.path.start,
      this.path.end,
    ];
    if (config.route) {
      this.path.start = this.path.points[0];
      this.path.end = this.path.points.at(-1);
    }
    this.houses = [];
    this.elapsed = 0;
    this.center = new CANNON.Vec3();
    const profiles = Object.keys(PROFILES),
      base = profiles.indexOf(config.profile);
    for (const [index, plan] of housePlacements(
      config,
      this.layout,
    ).entries()) {
      const profile =
        distribution === "mixed"
          ? profiles[(base + plan.profileOffset) % profiles.length]
          : config.profile;
      const simulation = new Simulation({
        ...config,
        profile: plan.profile ?? profile,
        roof: plan.roof ?? config.roof,
      });
      const offset = new CANNON.Vec3(plan.x, 0, plan.z);
      const yaw = plan.yaw,
        rotation = new CANNON.Quaternion();
      rotation.setFromEuler(0, yaw, 0);
      for (const piece of simulation.pieces) {
        piece.localOrigin = piece.origin.clone();
        piece.houseId = index;
        if (plan.objectId) {
          piece.objectId = plan.objectId;
          piece.parcelId = plan.parcelId;
        }
        rotation.vmult(piece.origin, piece.body.position);
        piece.body.position.vadd(offset, piece.body.position);
        rotation.mult(piece.body.quaternion, piece.body.quaternion);
        piece.origin.copy(piece.body.position);
        piece.orientation.copy(piece.body.quaternion);
        piece.body.previousPosition.copy(piece.origin);
        piece.body.interpolatedPosition.copy(piece.origin);
        piece.body.aabbNeedsUpdate = true;
      }
      if (!this.world) this.world = simulation.world;
      else {
        for (const piece of simulation.pieces) {
          simulation.world.removeBody(piece.body);
          this.world.addBody(piece.body);
        }
        simulation.world = this.world;
      }
      this.houses.push({
        id: index,
        ...(plan.parcelId ? { parcelId: plan.parcelId } : {}),
        ...(plan.objectId ? { objectId: plan.objectId } : {}),
        label: `C${String(index + 1).padStart(2, "0")}`,
        simulation,
        offset,
        yaw,
      });
    }
    this.world ??= createWorld();
    this.environment =
      this.layout && config.environment === "physical"
        ? new UrbanEnvironment(config, this.layout, this.world)
        : null;
    this.world.broadphase.dirty = true;
    this.impacts =
      config.impact !== "off"
        ? new DebrisImpacts(
            [
              ...this.houses,
              ...(this.environment
                ? [{ label: "ENV", simulation: this.environment }]
                : []),
            ],
            config.impact,
          )
        : null;
    this.updateCenter();
  }
  updateCenter() {
    if (this.config.route) {
      const position = alongRoute(
        this.path.points,
        this.elapsed * this.config.travelSpeed,
      );
      this.center.set(position.x, 0, position.z);
      this.progress = position.progress;
      return;
    }
    const { start, end } = this.path;
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const progress = Math.min(
      1,
      (this.elapsed * this.config.travelSpeed) / length,
    );
    this.center.set(
      start[0] + (end[0] - start[0]) * progress,
      0,
      start[1] + (end[1] - start[1]) * progress,
    );
    this.progress = progress;
  }
  step() {
    this.elapsed += FIXED_STEP;
    this.updateCenter();
    for (const { simulation } of this.houses) {
      simulation.config.wind = this.config.wind;
      simulation.config.radius = this.config.radius;
      simulation.config.reinforcement = this.config.reinforcement;
      simulation.prepareStep(this.center, this.elapsed);
    }
    this.environment?.prepareStep(this.center, this.elapsed);
    if (this.impacts) this.impacts.step(this.world, FIXED_STEP);
    else this.world.step(FIXED_STEP);
    this.environment?.finishStep();
    for (const { simulation } of this.houses) simulation.finishStep();
  }
  get pieces() {
    return [
      ...this.houses.flatMap((h) => h.simulation.pieces),
      ...(this.environment?.pieces ?? []),
    ];
  }
  get profile() {
    return PROFILES[this.config.profile];
  }
  get roof() {
    if (this.config.sitePlan) return ROOFS[this.config.roof];
    return this.houses[0]?.simulation.roof ?? ROOFS[this.config.roof];
  }
  get stats() {
    const rows = this.houses.map((h) => ({
      ...h.simulation.stats,
      id: h.id,
      label: h.label,
      profile: h.simulation.profile.label,
      ...(h.parcelId ? { parcelId: h.parcelId } : {}),
      ...(h.objectId ? { objectId: h.objectId } : {}),
    }));
    const keys = [
      "detached",
      "total",
      "wallDetached",
      "wallTotal",
      "wallDamaged",
      "secondaryDetached",
      "secondaryTotal",
      "stable",
      "facadeTotal",
      "fallen",
      "broken",
      "connectionTotal",
      "structuralBroken",
    ];
    const result = Object.fromEntries(
      keys.map((key) => [key, rows.reduce((sum, row) => sum + row[key], 0)]),
    );
    const affected = rows.filter((s) => s.broken > 0).length;
    return {
      ...result,
      elapsed: this.elapsed,
      maxDisplacement: Math.max(0, ...rows.map((s) => s.maxDisplacement)),
      maxTilt: Math.max(0, ...rows.map((s) => s.maxTilt)),
      state: !rows.length
        ? "Sin viviendas"
        : affected
          ? `${affected}/${rows.length} viviendas afectadas`
          : "Estable",
      affected,
      houseTotal: rows.length,
      collapsed: rows.filter((s) => s.state === "Colapso del modelo").length,
      rows,
      progress: this.progress,
      ...(this.environment ? { environment: this.environment.stats } : {}),
    };
  }
}

export class Experiment {
  constructor(config = {}, options = {}) {
    this.recordEnabled = options.record !== false;
    this.revision = 0;
    this.reset(config);
  }
  reset(changes = {}) {
    const config = cleanConfig({
      mode: "single",
      distribution: "mixed",
      spacing: 13,
      trajectory: "diagonal",
      ...this.config,
      ...changes,
    });
    if (!["single", "block9", "block16", "neighborhood"].includes(config.mode))
      throw new RangeError("Escenario desconocido.");
    const next =
      config.mode === "single" ? new Simulation(config) : new District(config);
    this.active = next;
    this.steps = 0;
    this.realSeconds = 0;
    this.revision++;
    this.recorder = this.recordEnabled ? new RunRecorder(this) : null;
  }
  step() {
    if (this.finished) return false;
    this.active.step();
    this.steps++;
    this.recorder?.tick(this);
    return true;
  }
  get finished() {
    return (
      this.config.duration !== null &&
      this.steps >= Math.round(this.config.duration / FIXED_STEP)
    );
  }
  setParameter(key, value) {
    if (!["wind", "radius", "reinforcement"].includes(key))
      throw new Error("Control no modificable durante la ejecución.");
    cleanConfig({ ...this.config, [key]: value });
    if (this.config[key] === value) return;
    this.config[key] = value;
    this.recorder?.change(this.steps, key, value);
  }
  get events() {
    return this.recorder?.events ?? [];
  }
  document(name) {
    if (!this.recorder) throw new Error("Esta ejecución no se está grabando.");
    return this.recorder.document(this, name);
  }

  get config() {
    return this.active?.config;
  }
  get houses() {
    return this.active.houses;
  }
  get pieces() {
    return this.active.pieces;
  }
  get environment() {
    return this.active.environment;
  }
  get center() {
    return this.active.center;
  }
  get elapsed() {
    return this.active.elapsed;
  }
  get stats() {
    return this.active.stats;
  }
  get profile() {
    return this.active.profile;
  }
  get roof() {
    return this.active.roof;
  }
}
