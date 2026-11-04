import { ENV_MODEL, ENV_LABELS, environmentBlueprint } from "./environment.js";
import {
  URBAN_DEFAULTS,
  validateUrban,
  generateNeighborhood,
  housePlacements,
} from "./urban.js";
import {
  DEFAULTS,
  HOUSE,
  PROFILES,
  ROOFS,
  SOURCES,
  validateConfig,
} from "./catalog.js";

import { RULES, FIXED_STEP } from "./physics.js";
import { parameterLibrary } from "./parameters.js";
import { normalizeSitePlan } from "./site-plan.js";
import { normalizeControls, controlModel } from "./route.js";
import { IMPACT_MODEL, SWEPT_IMPACT_MODEL, impactModel } from "./impacts.js";

export const APP_VERSION = "2.9.0";

export const SCHEMA_VERSION = 7;

export const MAX_FILE_BYTES = 40 * 1024 * 1024;

const clone = (value) => structuredClone(value);

const canonical = (value) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );

export const MODEL = {
  version: "pressure-v2.1",
  parameters: {
    house: HOUSE,
    profiles: PROFILES,
    roofs: ROOFS,
    rules: RULES,
    step: FIXED_STEP,
    engine: {
      name: "cannon-es",
      version: "0.20.0",
      iterations: 15,
      gravity: 9.82,
      friction: 0.65,
      restitution: 0.03,
      linearDamping: 0.1,
      angularDamping: 0.4,
    },
    wind: {
      airDensity: 1.225,
      radialFactor: 0.18,
      tangentialFactor: 0.85,
      verticalFactor: 0.7,
      falloffExponent: 1.15,
      altitudeLimit: 32,
      minimumDistance: 0.25,
      rampSeconds: 1.8,
      wallResidualFactor: 0.12,
      dragCoefficient: 0.7,
    },
    trajectory: {
      blockSpeed: 2,
      orbitalAngularSpeed: 0.17,
      orbitalRadiusX: 5.5,
      orbitalRadiusZ: 4.4,
      orbitalPhase: 0.6,
    },
  },
  sources: SOURCES,
  units: { length: "m", mass: "kg", force: "N", time: "s", wind: "km/h" },
};

export const MODEL_ID = (() => {
  let n = 2166136261;
  for (const c of canonical(MODEL))
    n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return `simtorcl-${(n >>> 0).toString(16)}`;
})();

export const CONFIG_KEYS = [
  "profile",
  "roof",
  "wind",
  "radius",
  "reinforcement",
  "impact",
  "mode",
  "distribution",
  "spacing",
  "trajectory",
  ...Object.keys(URBAN_DEFAULTS),
  "environment",
  "buildingFloors",
  "sitePlan",
  "route",
  "travelSpeed",
  "duration",
  "lesson",
];

export function cleanConfig(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Configuración inválida.");

  const config = {
    ...DEFAULTS,
    ...URBAN_DEFAULTS,
    environment: "physical",
    buildingFloors: 3,
    sitePlan: null,
    route: null,
    travelSpeed: 2,
    duration: null,
    lesson: null,
    mode: "single",
    distribution: "mixed",
    spacing: 13,
    trajectory: "diagonal",
  };

  for (const key of CONFIG_KEYS)
    if (Object.hasOwn(input, key)) config[key] = input[key];

  validateConfig(config);
  validateUrban(config);
  config.sitePlan = normalizeSitePlan(config.sitePlan, config);
  config.route = normalizeControls(config);
  if (
    config.lesson !== null &&
    !["residential", "mixed", "plaza", "reinforced"].includes(config.lesson)
  )
    throw new Error("Ejemplo guiado desconocido.");
  if (
    !["physical", "visual"].includes(config.environment) ||
    !Number.isInteger(config.buildingFloors) ||
    config.buildingFloors < 2 ||
    config.buildingFloors > 5
  )
    throw new RangeError("Configuración del entorno inválida.");

  if (
    !["single", "block9", "block16", "neighborhood"].includes(config.mode) ||
    !["mixed", "uniform"].includes(config.distribution) ||
    ![10, 13, 16].includes(config.spacing) ||
    !["diagonal", "horizontal", "vertical"].includes(config.trajectory)
  )
    throw new RangeError("Distribución urbana inválida.");

  if (
    config.mode !== "single" &&
    config.distribution === "mixed" &&
    config.roof === "slab"
  )
    throw new RangeError("La mezcla de perfiles no admite losa.");

  return config;
}

export function configAt(record, step) {
  const config = { ...record.initial };

  for (const change of record.changes) {
    if (change.step > step) break;
    config[change.key] = change.value;
  }

  return config;
}

export function houseSimulations(experiment) {
  return (
    experiment.houses?.map((h) => ({
      label: h.label,
      simulation: h.simulation,
    })) ?? [{ label: "C01", simulation: experiment.active }]
  );
}

export function objectSimulations(experiment) {
  const houses = houseSimulations(experiment);
  return experiment.environment
    ? [...houses, { label: "ENV", simulation: experiment.environment }]
    : houses;
}
export function environmentModel(config) {
  return config.mode === "neighborhood" && config.environment === "physical"
    ? config.sitePlan
      ? {
          ...ENV_MODEL,
          version:
            config.sitePlan.version === "parcel-editor-2"
              ? "urban-environment-workshop-1"
              : "urban-environment-editor-1",
          geometry:
            config.sitePlan.version === "parcel-editor-2"
              ? "independent-nine-slots-v1"
              : "parcel-quarter-turn-v1",
        }
      : ENV_MODEL
    : null;
}

export class RunRecorder {
  constructor(experiment) {
    this.initial = cleanConfig(experiment.config);
    this.changes = [];
    this.events = [];
    this.frames = [];
    this.offsets = new Map();
    this.sampleEvery = 30;
    this.frameLimit = Math.max(
      2,
      Math.min(240, Math.floor(900000 / (experiment.pieces.length * 9))),
    );
    this.startedAt = new Date().toISOString();

    this.capture(experiment);
  }

  change(step, key, value) {
    const previous = this.changes.at(-1);

    if (previous?.step === step && previous.key === key) previous.value = value;
    else this.changes.push({ step, key, value });
  }

  capture(experiment) {
    const step = experiment.steps;

    const poses = experiment.pieces.flatMap((p) => [
      ...p.body.position.toArray(),
      ...p.body.quaternion.toArray(),
      Number(p.detached),
      p.damage,
    ]);

    const frame = { step, poses, stats: clone(experiment.stats) };

    if (this.frames.at(-1)?.step === step)
      this.frames[this.frames.length - 1] = frame;
    else this.frames.push(frame);

    if (this.frames.length > this.frameLimit) {
      this.frames = this.frames.filter(
        (_v, i) => i % 2 === 0 || i === this.frames.length - 1,
      );
      this.sampleEvery *= 2;
    }
  }

  tick(experiment) {
    const afterContact = [];
    for (const { label, simulation } of objectSimulations(experiment)) {
      const offset = this.offsets.get(label) ?? 0;
      let contactPhase = false;

      for (const event of simulation.events.slice(offset)) {
        contactPhase ||= event.cause === "impact";
        const destination = contactPhase ? afterContact : this.events;
        destination.push({
          ...clone(event),
          ...(simulation.pieces[event.pieceId]?.objectId
            ? {
                objectId: simulation.pieces[event.pieceId].objectId,
                parcelId: simulation.pieces[event.pieceId].parcelId,
              }
            : {}),
          id: `${label}:E${event.id}`,
          house: label,
          parents: [
            ...event.parents.map((id) => `${label}:E${id}`),
            ...(event.impact ? [event.impact.sourceReleaseId] : []),
          ],
          step: experiment.steps,
        });
      }

      this.offsets.set(label, simulation.events.length);
    }
    for (const event of afterContact) this.events.push(event);

    if (experiment.steps % this.sampleEvery === 0) this.capture(experiment);
  }

  document(experiment, name = "Experimento") {
    this.capture(experiment);

    return {
      format: "simtorcl-experiment",
      schemaVersion: SCHEMA_VERSION,
      kind: "run",
      appVersion: APP_VERSION,
      modelId: MODEL_ID,
      model: clone(MODEL),
      scenarioModel: controlModel(this.initial),
      impactModel: clone(impactModel(this.initial.impact)),
      parameterLibrary: parameterLibrary(MODEL, environmentModel(this.initial)),
      environmentModel: clone(environmentModel(this.initial)),
      environmentInventory: experiment.environment
        ? environmentBlueprint(this.initial, experiment.active.layout)
        : null,
      name: normalizeName(name),
      startedAt: this.startedAt,
      savedAt: new Date().toISOString(),
      initial: clone(this.initial),
      layout:
        this.initial.mode === "neighborhood"
          ? clone(experiment.active.layout)
          : null,
      changes: clone(this.changes),
      steps: experiment.steps,
      realSeconds: experiment.realSeconds,
      results: clone(experiment.stats),
      events: clone(this.events),
      frames: clone(this.frames),
    };
  }
}

export const normalizeName = (name) =>
  String(name ?? "Experimento")
    .trim()
    .slice(0, 80) || "Experimento";

export function configurationDocument(config = {}, name) {
  const initial = cleanConfig(config),
    layout =
      initial.mode === "neighborhood" ? generateNeighborhood(initial) : null;
  return {
    format: "simtorcl-experiment",
    schemaVersion: SCHEMA_VERSION,
    kind: "configuration",
    appVersion: APP_VERSION,
    modelId: MODEL_ID,
    model: clone(MODEL),
    scenarioModel: controlModel(initial),
    impactModel: clone(impactModel(initial.impact)),
    parameterLibrary: parameterLibrary(MODEL, environmentModel(initial)),
    environmentModel: clone(environmentModel(initial)),
    environmentInventory: environmentModel(initial)
      ? environmentBlueprint(initial, layout)
      : null,
    name: normalizeName(name),
    savedAt: new Date().toISOString(),
    initial,
    layout,
  };
}

export function shareLink(base, config, name) {
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Se necesita una dirección HTTP.");
  url.search = "";
  url.hash =
    "simtorcl=" +
    encodeURIComponent(
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        modelId: MODEL_ID,
        environmentVersion: environmentModel(config)?.version ?? null,
        controlVersion: controlModel(cleanConfig(config))?.version ?? null,
        name: normalizeName(name),
        config: cleanConfig(config),
      }),
    );
  return url.href;
}

export function parseShareHash(hash) {
  if (!hash.startsWith("#simtorcl=")) return null;
  if (hash.length > 100000) throw new Error("Enlace demasiado largo.");
  let data;
  try {
    data = JSON.parse(decodeURIComponent(hash.slice(10)));
  } catch {
    throw new Error("Enlace de configuración inválido.");
  }
  if (
    ![1, 2, 3, 4, 5, 6, SCHEMA_VERSION].includes(data.schemaVersion) ||
    data.modelId !== MODEL_ID
  )
    throw new Error("El enlace usa otra versión del modelo.");
  if (
    data.schemaVersion >= 3 &&
    (data.environmentVersion ?? null) !==
      (environmentModel(data.config)?.version ?? null)
  )
    throw new Error("El enlace usa otro modelo urbano.");
  if (
    data.schemaVersion >= 6 &&
    (data.controlVersion ?? null) !==
      (controlModel(cleanConfig(data.config))?.version ?? null)
  )
    throw new Error("El enlace usa otro modelo de recorrido o duración.");
  return {
    config: cleanConfig({
      ...data.config,
      ...(data.schemaVersion < 6
        ? { route: null, travelSpeed: 2, duration: null, lesson: null }
        : {}),
      ...(data.schemaVersion < 3 ? { environment: "visual" } : {}),
      ...(data.schemaVersion < 7 ? { impact: "off" } : {}),
    }),
    name: normalizeName(data.name),
  };
}

function finiteTree(value, depth = 0) {
  if (depth > 25)
    throw new Error("El archivo contiene datos demasiado anidados.");

  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("El archivo contiene valores numéricos inválidos.");

  if (value && typeof value === "object")
    for (const v of Object.values(value)) finiteTree(v, depth + 1);
}

const count = (v, max = 1e7) => Number.isInteger(v) && v >= 0 && v <= max;

function checkStats(stats) {
  if (!stats || typeof stats !== "object")
    throw new Error("Resultados incompletos.");

  for (const [a, b] of [
    ["detached", "total"],
    ["wallDetached", "wallTotal"],
    ["secondaryDetached", "secondaryTotal"],
    ["broken", "connectionTotal"],
    ["stable", "facadeTotal"],
  ])
    if (!count(stats[a]) || !count(stats[b]) || stats[a] > stats[b])
      throw new Error("Contadores de daño inválidos.");

  for (const key of ["elapsed", "maxDisplacement", "maxTilt"])
    if (!Number.isFinite(stats[key]) || stats[key] < 0 || stats[key] > 1e9)
      throw new Error("Métricas inválidas.");

  if (typeof stats.state !== "string" || stats.state.length > 100)
    throw new Error("Estado inválido.");
  for (const [key, max] of [
    ["wallDamaged", stats.wallTotal],
    ["fallen", stats.wallTotal],
    ["structuralBroken", stats.broken],
  ])
    if (!count(stats[key], max))
      throw new Error("Contadores estructurales inválidos.");

  if (stats.rows) {
    if (!Array.isArray(stats.rows) || stats.rows.length > 16)
      throw new Error("Viviendas inválidas.");
    stats.rows.forEach(checkStats);
  }
}

export function parseDocument(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > MAX_FILE_BYTES
  )
    throw new Error("El archivo supera 40 MB.");

  let record;
  try {
    record = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es JSON válido.");
  }

  // Explicit migration of the documented configuration-only v0 format.

  if (
    record?.format === "simtorcl-experiment" &&
    record.schemaVersion === 0 &&
    record.kind === "configuration"
  )
    record = configurationDocument(record.config, record.name);

  if (record?.format === "simtorcl-experiment" && record.schemaVersion === 1) {
    if (record.initial?.mode === "neighborhood")
      throw new Error("Un barrio requiere el esquema 2.");
    record = { ...record, schemaVersion: 2, layout: null };
  }
  if (record?.format === "simtorcl-experiment" && record.schemaVersion === 2)
    record = {
      ...record,
      schemaVersion: 3,
      initial: { ...record.initial, environment: "visual" },
      environmentModel: null,
      environmentInventory: null,
    };
  if (record?.format === "simtorcl-experiment" && record.schemaVersion === 3)
    record = {
      ...record,
      schemaVersion: 4,
      parameterLibrary: null,
    };
  if (record?.format === "simtorcl-experiment" && record.schemaVersion === 4)
    record = {
      ...record,
      schemaVersion: 5,
      initial: { ...record.initial, sitePlan: null },
    };
  if (record?.format === "simtorcl-experiment" && record.schemaVersion === 5)
    record = {
      ...record,
      schemaVersion: 6,
      scenarioModel: null,
      initial: {
        ...record.initial,
        route: null,
        travelSpeed: 2,
        duration: null,
        lesson: null,
      },
    };
  if (record?.format === "simtorcl-experiment" && record.schemaVersion === 6)
    record = {
      ...record,
      schemaVersion: SCHEMA_VERSION,
      initial: { ...record.initial, impact: "off" },
      impactModel: null,
    };
  if (
    !record ||
    record.format !== "simtorcl-experiment" ||
    record.schemaVersion !== SCHEMA_VERSION
  )
    throw new Error("Formato o versión de archivo no compatible.");

  if (
    record.modelId !== MODEL_ID ||
    canonical(record.model) !== canonical(MODEL)
  )
    throw new Error(
      "El archivo usa otro modelo físico. Conserva su informe o utiliza la versión original.",
    );

  record.initial = cleanConfig(record.initial);
  record.name = normalizeName(record.name);
  if (
    canonical(record.impactModel) !==
    canonical(impactModel(record.initial.impact))
  )
    throw new Error("El modelo de impactos no coincide con esta versión.");
  if (
    canonical(record.scenarioModel) !== canonical(controlModel(record.initial))
  )
    throw new Error(
      "El modelo de recorrido o duración no coincide con esta versión.",
    );
  if (
    record.parameterLibrary !== null &&
    canonical(record.parameterLibrary) !==
      canonical(parameterLibrary(MODEL, environmentModel(record.initial)))
  )
    throw new Error(
      "La biblioteca de parámetros o su procedencia no coincide con esta versión.",
    );
  if (
    canonical(record.environmentModel) !==
    canonical(environmentModel(record.initial))
  )
    throw new Error("El archivo usa otro modelo de entorno urbano.");
  const expectedLayout =
    record.initial.mode === "neighborhood"
      ? generateNeighborhood(record.initial)
      : null;
  const envBlueprint = environmentBlueprint(record.initial, expectedLayout);
  if (
    canonical(record.environmentInventory) !==
    canonical(environmentModel(record.initial) ? envBlueprint : null)
  )
    throw new Error(
      "La geometría o propiedades de los objetos urbanos no coinciden con esta versión.",
    );
  if (canonical(record.layout) !== canonical(expectedLayout))
    throw new Error(
      "La distribución guardada no coincide con la semilla y los parámetros del barrio.",
    );

  if (!["configuration", "run"].includes(record.kind))
    throw new Error("Tipo de experimento desconocido.");

  finiteTree(record);

  if (record.kind === "configuration") {
    const configuration = configurationDocument(record.initial, record.name);
    // A legacy file did not contain this evidence snapshot. Do not silently
    // rewrite its provenance with today's metadata during import.
    configuration.parameterLibrary = record.parameterLibrary;
    configuration.appVersion = record.appVersion;
    configuration.savedAt = record.savedAt;
    return configuration;
  }

  if (
    !count(record.steps, 864000) ||
    !Number.isFinite(record.realSeconds) ||
    record.realSeconds < 0 ||
    !Array.isArray(record.changes) ||
    record.changes.length > 10000 ||
    !Array.isArray(record.events) ||
    record.events.length > 10000 ||
    !Array.isArray(record.frames) ||
    !record.frames.length ||
    record.frames.length > 241
  )
    throw new Error("Ejecución demasiado grande o incompleta.");

  let last = -1;
  if (
    record.initial.duration !== null &&
    record.steps > Math.round(record.initial.duration / FIXED_STEP)
  )
    throw new Error("La ejecución supera su duración declarada.");
  const config = { ...record.initial };

  for (const change of record.changes) {
    if (
      !count(change.step, record.steps) ||
      change.step < last ||
      !["wind", "radius", "reinforcement"].includes(change.key)
    )
      throw new Error("Historial de controles inválido.");
    config[change.key] = change.value;
    cleanConfig(config);
    last = change.step;
  }

  checkStats(record.results);

  const plans = housePlacements(record.initial, expectedLayout);
  const homes = plans.length;

  const base = Object.keys(PROFILES).indexOf(record.initial.profile);
  function checkStateShape(stats, step) {
    if (environmentModel(record.initial)) {
      const env = stats.environment;
      if (
        !env ||
        env.total !== envBlueprint.pieces.length ||
        !count(env.detached, env.total) ||
        !count(env.broken, env.connectionTotal) ||
        env.connectionTotal !==
          envBlueprint.pieces.filter((p) => p.capacity !== null).length ||
        !Array.isArray(env.rows) ||
        env.rows.length !== envBlueprint.entities.length
      )
        throw new Error("Resultados del entorno urbano inválidos.");
      env.rows.forEach((r, i) => {
        const e = envBlueprint.entities[i];
        if (
          r.id !== e.id ||
          r.type !== e.type ||
          r.parcelId !== e.parcelId ||
          r.total !== e.pieces.length ||
          !count(r.detached, r.total) ||
          typeof r.state !== "string"
        )
          throw new Error("Estado de objeto urbano inválido.");
      });
      if (env.rows.reduce((n, r) => n + r.detached, 0) !== env.detached)
        throw new Error("Recuento urbano inconsistente.");
    } else if (stats.environment)
      throw new Error("El archivo contiene física urbana no declarada.");

    if (Math.abs(stats.elapsed - step * FIXED_STEP) > 1e-6)
      throw new Error("El reloj no coincide con los pasos guardados.");
    if (record.initial.mode === "single") {
      if (stats.rows)
        throw new Error("Una casa individual no admite filas de manzana.");
      return;
    }
    if (
      !Array.isArray(stats.rows) ||
      stats.rows.length !== homes ||
      stats.houseTotal !== homes ||
      !count(stats.affected, homes) ||
      !count(stats.collapsed, homes) ||
      !Number.isFinite(stats.progress) ||
      stats.progress < 0 ||
      stats.progress > 1
    )
      throw new Error("Resultados de manzana incompletos.");
    stats.rows.forEach((r, i) => {
      if (
        (expectedLayout && r.parcelId !== plans[i].parcelId) ||
        (record.initial.sitePlan && r.objectId !== plans[i].objectId) ||
        r.id !== i ||
        r.label !== `C${String(i + 1).padStart(2, "0")}` ||
        typeof r.profile !== "string" ||
        r.profile.length > 100 ||
        Math.abs(r.elapsed - step * FIXED_STEP) > 1e-6
      )
        throw new Error("Identidad o reloj de vivienda inválido.");
    });
  }
  checkStateShape(record.results, record.steps);

  const pieceCounts = Array.from({ length: homes }, (_v, i) => {
    const p =
      PROFILES[
        plans[i].profile ??
          (record.initial.mode !== "single" &&
          record.initial.distribution === "mixed"
            ? Object.keys(PROFILES)[(base + plans[i].profileOffset) % 4]
            : record.initial.profile)
      ];
    const roof = ROOFS[plans[i].roof ?? record.initial.roof];
    return (
      12 +
      (p.claddingPressure ? (p.id === "concrete" ? 11 : 12) : 0) +
      (roof.id === "slab" ? 1 : 2 * roof.columns * roof.rows)
    );
  });

  const expectedPieces =
    pieceCounts.reduce((a, b) => a + b, 0) + envBlueprint.pieces.length;

  const seenEvents = new Map(),
    envConnections = envBlueprint.pieces.filter((p) => p.capacity !== null),
    envBroken = new Set(),
    envReleased = new Set();
  last = -1;

  for (const event of record.events) {
    if (!event) throw new Error("Registro de eventos inválido.");
    if (record.initial.sitePlan && event.house !== "ENV") {
      const plan = plans[Number(event.house?.slice(1)) - 1];
      if (
        !plan ||
        event.objectId !== plan.objectId ||
        event.parcelId !== plan.parcelId
      )
        throw new Error("Identidad de objeto o parcela en evento inválida.");
    }
    if (
      !event ||
      typeof event.id !== "string" ||
      event.id.length > 40 ||
      seenEvents.has(event.id) ||
      (!/^C\d{2}$/.test(event.house) && event.house !== "ENV") ||
      (event.house !== "ENV" && Number(event.house.slice(1)) < 1) ||
      (event.house !== "ENV" && Number(event.house.slice(1)) > homes) ||
      !count(event.step, record.steps) ||
      event.step < last ||
      !Number.isFinite(event.time) ||
      Math.abs(event.time - event.step * FIXED_STEP) > 1e-6 ||
      !["connection", "release"].includes(event.type) ||
      ![
        "roof",
        "wall",
        "cladding",
        "base",
        "corner",
        ...(event.house === "ENV" ? Object.keys(ENV_LABELS) : []),
      ].includes(event.kind) ||
      !["overload", "support", "impact"].includes(event.cause) ||
      !count(
        event.pieceId,
        (event.house === "ENV"
          ? envBlueprint.pieces.length
          : pieceCounts[Number(event.house.slice(1)) - 1]) - 1,
      ) ||
      !Array.isArray(event.parents) ||
      event.parents.some((id) => !seenEvents.has(id))
    )
      throw new Error("Registro de eventos inválido.");

    if (
      event.type === "release" &&
      (!Number.isFinite(event.mass) || event.mass < 0)
    )
      throw new Error("Masa inválida.");

    if (
      event.type === "connection" &&
      (!count(event.connectionId, event.house === "ENV" ? 5000 : 200) ||
        !Number.isFinite(event.capacity) ||
        event.capacity < 0 ||
        !Number.isFinite(event.demand) ||
        event.demand < 0)
    )
      throw new Error("Carga o capacidad inválida.");

    if (event.cause === "impact") {
      const hit = event.impact;
      const source = seenEvents.get(hit?.sourceReleaseId);
      if (
        record.initial.impact === "off" ||
        event.type !== "connection" ||
        source?.type !== "release" ||
        !event.parents.includes(source.id) ||
        (source.house === event.house &&
          source.pieceId === hit.targetPieceId) ||
        !count(
          hit.targetPieceId,
          (event.house === "ENV"
            ? envBlueprint.pieces.length
            : pieceCounts[Number(event.house.slice(1)) - 1]) - 1,
        ) ||
        (hit.targetPieceId !== event.pieceId &&
          hit.targetPieceId !== event.otherPieceId) ||
        !Number.isFinite(hit.closingSpeed) ||
        hit.closingSpeed < IMPACT_MODEL.minimumClosingSpeed ||
        event.demand <= event.capacity
      )
        throw new Error("Origen, receptor o demanda de impacto inválidos.");
      if (
        Object.hasOwn(hit, "sweepFraction") &&
        (record.initial.impact !== SWEPT_IMPACT_MODEL.version ||
          !Number.isFinite(hit.sweepFraction) ||
          hit.sweepFraction < 0 ||
          hit.sweepFraction >= 1)
      )
        throw new Error("Fracción de barrido inválida.");
    } else if (Object.hasOwn(event, "impact"))
      throw new Error("Datos de impacto en un evento con otra causa.");

    if (event.house === "ENV") {
      const p = envBlueprint.pieces[event.pieceId];
      if (event.type === "connection") {
        const connection = envConnections[event.connectionId],
          factor =
            configAt(record, Math.max(0, event.step - 1)).reinforcement / 100;
        if (
          !connection ||
          connection.id !== event.pieceId ||
          envBroken.has(event.connectionId) ||
          event.otherPieceId !== connection.parentId ||
          Math.abs(event.capacity - connection.capacity * factor) > 1e-6
        )
          throw new Error("Unión urbana inconsistente.");
        envBroken.add(event.connectionId);
      } else {
        if (envReleased.has(event.pieceId) || event.mass !== p?.mass)
          throw new Error("Liberación urbana inconsistente.");
        envReleased.add(event.pieceId);
      }

      if (
        !p ||
        p.entityId !== event.entityId ||
        p.parcelId !== event.parcelId ||
        p.kind !== event.kind ||
        (record.initial.sitePlan && p.objectId !== event.objectId) ||
        (event.type === "connection" && event.unit !== p.unit)
      )
        throw new Error("Identidad o unidades de evento urbano inválidas.");
    }
    seenEvents.set(event.id, event);
    last = event.step;
  }

  last = -1;
  let poseLength = null;

  for (const frame of record.frames) {
    if (
      !count(frame.step, record.steps) ||
      frame.step <= last ||
      !Array.isArray(frame.poses) ||
      frame.poses.length !== expectedPieces * 9 ||
      frame.poses.some(
        (v) =>
          typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e9,
      )
    )
      throw new Error("Fotogramas inválidos.");

    if (poseLength !== null && frame.poses.length !== poseLength)
      throw new Error("La geometría cambia dentro de la grabación.");

    for (let i = 0; i < frame.poses.length; i += 9) {
      const norm = Math.hypot(...frame.poses.slice(i + 3, i + 7));
      if (
        Math.abs(norm - 1) > 0.01 ||
        ![0, 1].includes(frame.poses[i + 7]) ||
        !count(frame.poses[i + 8], 200)
      )
        throw new Error("Estado de pieza inválido.");
    }

    checkStats(frame.stats);
    checkStateShape(frame.stats, frame.step);
    poseLength = frame.poses.length;
    last = frame.step;
  }

  if (record.frames[0].step !== 0 || record.frames.at(-1).step !== record.steps)
    throw new Error("Faltan los extremos de la grabación.");
  if (canonical(record.frames.at(-1).stats) !== canonical(record.results))
    throw new Error("Los resultados no coinciden con el último fotograma.");

  return record;
}

export function applyFrame(experiment, record, index) {
  const frame = record.frames[index];
  if (!frame || frame.poses.length !== experiment.pieces.length * 9)
    throw new Error("La grabación no coincide con la geometría generada.");

  Object.assign(experiment.config, configAt(record, frame.step));

  experiment.steps = frame.step;
  experiment.active.elapsed = frame.step * FIXED_STEP;
  experiment.active.updateCenter();

  const broken = new Map(
    record.events
      .filter((e) => e.type === "connection" && e.step <= frame.step)
      .map((e) => [`${e.house}:${e.connectionId}`, e]),
  );

  for (const { label, simulation } of objectSimulations(experiment)) {
    simulation.elapsed = frame.step * FIXED_STEP;

    for (const c of simulation.connections)
      c.broken = broken.has(`${label}:${c.id}`);

    const row = frame.stats.rows?.find((r) => r.label === label) ?? frame.stats;

    simulation.peakDisplacement = row.maxDisplacement;
    simulation.peakTilt = row.maxTilt;
  }

  experiment.pieces.forEach((p, i) => {
    const a = frame.poses,
      j = i * 9;
    p.body.position.set(a[j], a[j + 1], a[j + 2]);
    p.body.quaternion.set(a[j + 3], a[j + 4], a[j + 5], a[j + 6]);
    p.detached = !!a[j + 7];
    p.damage = a[j + 8];
  });

  return frame.stats;
}

export function csv(rows) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (typeof v === "string" && /^(?:[=+@\-\t\r\n]|\s+[=+@-])/.test(s))
      s = "'" + s;
    return `"${s.replaceAll('"', '""')}"`;
  };

  return "\ufeff" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
}

export function resultsCSV(record) {
  const rows = [
    [
      "experimento",
      "modelo",
      "vivienda",
      "perfil",
      "parcela",
      "cubierta_desprendida",
      "cubierta_total",
      "paredes_sin_soporte",
      "paredes_total",
      "secundarios_desprendidos",
      "uniones_falladas",
      "desplazamiento_max_m",
      "inclinacion_max_grados",
      "tiempo_simulado_s",
      "estado",
      "objeto_id",
    ],
  ];

  for (const r of record.results.rows
    ? [
        { ...record.results, label: "Conjunto", profile: "Mixto / agregado" },
        ...record.results.rows,
      ]
    : [
        {
          ...record.results,
          label: "C01",
          profile: PROFILES[record.initial.profile].label,
        },
      ])
    rows.push([
      record.name,
      record.modelId,
      r.label,
      r.profile,
      r.parcelId ?? "",
      r.detached,
      r.total,
      r.wallDetached,
      r.wallTotal,
      r.secondaryDetached,
      r.broken,
      r.maxDisplacement,
      r.maxTilt,
      r.elapsed,
      r.state,
      r.objectId ?? "",
    ]);

  return csv(rows);
}

export function componentsCSV(record, experiment) {
  return csv([
    [
      "experimento",
      "vivienda",
      "pieza_id",
      "tipo",
      "objeto_id",
      "parcela",
      "masa_kg",
      "superficie_m2",
      "x_m",
      "y_m",
      "z_m",
      "liberada",
      "uniones_falladas",
      "uniones_estructurales_falladas_en_muro",
    ],
    ...objectSimulations(experiment).flatMap(({ label, simulation }) =>
      simulation.pieces.map((p) => [
        record.name,
        label,
        p.id,
        p.kind,
        p.entityId ?? p.objectId ?? "",
        p.parcelId ?? "",
        p.mass,
        p.area,
        ...p.body.position.toArray(),
        p.detached ? 1 : 0,
        p.connections.filter((c) => c.broken).length,
        p.kind === "wall" ? p.damage : 0,
      ]),
    ),
  ]);
}

export function eventsCSV(record) {
  return csv([
    [
      "evento",
      "tiempo_s",
      "vivienda",
      "tipo",
      "componente",
      "pieza_id",
      "union_id",
      "causa",
      "demanda",
      "capacidad",
      "unidad",
      "objeto_id",
      "parcela",
      "eventos_relacionados",
      "desprendimiento_origen",
      "pieza_receptora_id",
      "velocidad_normal_m_s",
      "fraccion_barrido_del_paso",
    ],
    ...record.events.map((e) => [
      e.id,
      e.time,
      e.house,
      e.type,
      e.kind,
      e.pieceId,
      e.connectionId ?? "",
      e.cause,
      e.demand ?? "",
      e.capacity ?? "",
      e.type === "connection" ? (e.unit ?? "N") : "",
      e.entityId ?? e.objectId ?? "",
      e.parcelId ?? "",
      e.parents.join(" | "),
      e.impact?.sourceReleaseId ?? "",
      e.impact?.targetPieceId ?? "",
      e.impact?.closingSpeed ?? "",
      e.impact?.sweepFraction ?? "",
    ]),
  ]);
}

export function parcelsCSV(record) {
  if (!record.layout)
    throw new Error("Este escenario no contiene un plano de barrio.");
  const homes = new Map(
    (record.results?.rows ?? []).map((h) => [h.parcelId, h.label]),
  );
  return csv([
    [
      "parcela",
      "uso",
      "vivienda",
      "superficie_m2",
      "centro_x_m",
      "centro_z_m",
      "orientacion_grados",
      "semilla",
      "origen_distribucion",
      "objeto_id",
      "rotacion_objeto_grados",
      "perfil_casa",
      "cubierta_casa",
      "pisos_edificio",
      "elementos_independientes",
    ],
    ...record.layout.parcels.map((p) => [
      p.id,
      p.type,
      homes.get(p.id) ?? "",
      p.area,
      p.world.x,
      p.world.z,
      record.initial.orientation,
      record.initial.seed,
      record.initial.sitePlan ? "manual" : "generado",
      p.objectId ?? "",
      p.objectRotation ?? "",
      p.houseProfile ?? "",
      p.houseRoof ?? "",
      p.buildingFloors ?? "",
      (record.layout.features ?? [])
        .filter((item) => item.parcelId === p.id)
        .map(
          (item) =>
            `${item.id}:${item.type}:punto${item.slot + 1}:giro${item.rotation}`,
        )
        .join(" | "),
    ]),
  ]);
}

export const escapeHTML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function damageChart(record) {
  const frames = record.frames,
    max = Math.max(1, record.steps);

  const points = (key) =>
    frames
      .map(
        (f) =>
          `${((f.step / max) * 600).toFixed(2)},${(120 - (f.stats[key] / Math.max(1, f.stats[key === "detached" ? "total" : "wallTotal"])) * 110).toFixed(2)}`,
      )
      .join(" ");

  return `<svg viewBox="-45 0 670 150" role="img" aria-label="Proporción de cubierta y paredes sin soporte durante el tiempo simulado"><text x="-42" y="15" fill="currentColor" font-size="12">100 %</text><text x="-28" y="124" fill="currentColor" font-size="12">0 %</text><path d="M0 10H600M0 10V120H600" fill="none" stroke="#91a99b"/><polyline points="${points("detached")}" fill="none" stroke="#e3a16f" stroke-width="3"/><polyline points="${points("wallDetached")}" fill="none" stroke="#74d2b5" stroke-width="3"/><text x="4" y="145" fill="currentColor" font-size="12">0 s</text><text x="520" y="145" fill="currentColor" font-size="12">${(record.steps * FIXED_STEP).toFixed(2)} s</text></svg>`;
}

export function environmentCSV(record) {
  const env = record.results.environment;
  if (!env)
    throw new Error("Este experimento no tiene objetos urbanos físicos.");
  return csv([
    [
      "objeto",
      "tipo",
      "parcela",
      "piezas_liberadas",
      "piezas_total",
      "anclaje_arbol_fallado",
      "estado",
    ],
    ...env.rows.map((r) => [
      r.id,
      r.type,
      r.parcelId,
      r.detached,
      r.total,
      r.anchorFailed ? 1 : 0,
      r.state,
    ]),
  ]);
}

export function htmlReport(record, image = "") {
  const e = escapeHTML,
    s = record.results,
    rows = s.rows ?? [
      { ...s, label: "C01", profile: PROFILES[record.initial.profile].label },
    ];

  const screenshot = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)
    ? `<img alt="Vista del experimento al exportar" src="${image}"/>`
    : "";

  const scenario = record.scenarioModel
    ? `<h2>Recorrido y condiciones del ensayo</h2><p>${record.initial.mode === "single" ? "Recorrido orbital de la casa individual." : (record.initial.route ? "Recorrido dibujado: " + record.initial.route.length + " puntos." : "Recorrido lineal.") + " Avance " + record.initial.travelSpeed + " m/s"} · ${record.initial.duration === null ? "sin límite de duración" : record.initial.duration + " s de duración"}. Intensidad inicial ${record.initial.wind} km/h.</p><p>${e(record.scenarioModel.scope)}</p><pre>${e(JSON.stringify(record.scenarioModel, null, 2))}</pre>`
    : "";

  const plan = record.layout
    ? `<h2>Plano del barrio</h2><p>${record.initial.sitePlan ? "Distribución manual; propiedades por objeto conservadas. Semilla de origen " : "Distribución generada. Semilla "}${record.initial.seed} · ${record.initial.rows} × ${record.initial.columns} parcelas · orientación ${record.initial.orientation}°. ${record.initial.environment === "physical" ? "Edificios con estructura fija y envolvente desprendible; árboles y bancos con uniones rompibles." : "Reservas y vegetación visuales."}</p><table><tr><th>Parcela</th><th>Uso</th><th>Superficie m²</th><th>Centro X, Z (m)</th></tr>${record.layout.parcels.map((p) => `<tr><td>${e(p.id)}</td><td>${e({ house: "Vivienda", green: "Área verde", building: record.initial.environment === "physical" ? "Edificio residencial" : "Reserva para edificio", vacant: "Parcela libre" }[p.type])}</td><td>${p.area}</td><td>${p.world.x.toFixed(2)}, ${p.world.z.toFixed(2)}</td></tr>`).join("")}</table>${record.initial.sitePlan ? `<h3>Objetos del diseño manual</h3><pre>${e(JSON.stringify(record.initial.sitePlan, null, 2))}</pre>` : ""}`
    : "";
  const urban = record.environmentModel
    ? `<h2>Objetos urbanos</h2><p>${e(record.environmentModel.scope)} Propiedades mecánicas educativas; las referencias oficiales no son fuentes de estas capacidades.</p><table><tr><th>Objeto</th><th>Parcela</th><th>Piezas liberadas</th><th>Estado</th></tr>${(s.environment?.rows ?? []).map((r) => `<tr><td>${e(r.id)}</td><td>${e(r.parcelId)}</td><td>${r.detached}/${r.total}</td><td>${e(r.state)}</td></tr>`).join("")}</table><h2>Procedencia del entorno urbano</h2><pre>${e(JSON.stringify(record.environmentModel, null, 2))}</pre><details><summary>Geometría y propiedades por pieza (m, kg, m²; capacidad con su unidad)</summary><pre>${e(JSON.stringify(record.environmentInventory, null, 2))}</pre></details>`
    : "";
  const provenance = record.parameterLibrary
    ? `<h2>Biblioteca de parámetros ${e(record.parameterLibrary.version)}</h2><p>${e(record.parameterLibrary.scope)} Los valores mecánicos siguen pendientes de calibración.</p><table><tr><th>Propiedad</th><th>Valor y unidad</th><th>Evidencia</th><th>Aplicación y estado</th></tr>${record.parameterLibrary.entries.map((p) => `<tr><td>${e(p.label)}<br><small>${e(p.id)}</small></td><td>${p.value} ${e(p.unit)}</td><td>${e(p.evidence)}</td><td>${e(p.applicability)} ${e(p.status)} ${e(p.note)}</td></tr>`).join("")}</table><details><summary>Fuentes, ecuaciones y metadatos completos de la biblioteca guardada</summary><pre>${e(JSON.stringify(record.parameterLibrary, null, 2))}</pre></details>`
    : `<h2>Biblioteca de parámetros</h2><p>Este archivo histórico no contiene una biblioteca de procedencia. Se conservan sus descriptores originales; no se le asigna retrospectivamente la biblioteca actual.</p>`;
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${e(record.name)} · SimTorCL</title><style>body{font:15px system-ui;line-height:1.6;max-width:1100px;margin:40px auto;padding:20px;color:#19392e}table{border-collapse:collapse;width:100%}td,th{padding:8px;text-align:left;border-bottom:1px solid #ccc}img{max-width:100%}svg{width:100%;background:#17231e;color:#dfece3;border-radius:8px;padding:12px}pre{white-space:pre-wrap}small{color:#52665a}@media print{body{margin:0}}</style><h1>${e(record.name)}</h1><p>SimTorCL ${e(record.appVersion)} · esquema ${record.schemaVersion} · modelo ${e(record.modelId)}</p><p>Tiempo simulado: ${s.elapsed.toFixed(2)} s · tiempo real activo: ${record.realSeconds.toFixed(2)} s. Los periodos en pausa se excluyen.</p><p>Modelo educativo con propiedades ilustrativas, sin validación experimental. La geometría urbana sintética no representa distribuciones censales. Informe de resultados declarados de una ejecución; una importación no recalcula ni certifica los datos.</p>${screenshot}<p>La imagen corresponde a la vista al exportar; las tablas y curvas describen la ejecución completa.</p><h2>Daño durante la ejecución</h2><p>Naranja: cubierta desprendida. Verde: paredes sin soporte. Curvas muestreadas, de 0 a 100 %.</p>${damageChart(record)}<h2>Resultados por vivienda</h2><table><tr><th>Casa</th><th>Perfil</th><th>Cubierta</th><th>Paredes sin soporte</th><th>Uniones falladas</th><th>Movimiento máximo de paredes</th><th>Estado</th></tr>${rows.map((r) => `<tr><td>${e(r.label)}</td><td>${e(r.profile)}</td><td>${r.detached}/${r.total}</td><td>${r.wallDetached}/${r.wallTotal}</td><td>${r.broken}/${r.connectionTotal}</td><td>${r.maxDisplacement.toFixed(2)} m / ${r.maxTilt.toFixed(1)}°</td><td>${e(r.state)}</td></tr>`).join("")}</table>${scenario}${plan}${urban}${provenance}<h2>Configuración inicial</h2><pre>${e(JSON.stringify(record.initial, null, 2))}</pre><h2>Cambios durante la ejecución</h2><pre>${e(JSON.stringify(record.changes, null, 2))}</pre><h2>Eventos</h2><p>${record.events.length} eventos. El archivo JSON y el CSV de eventos conservan todos los identificadores y relaciones.</p><table><tr><th>Tiempo</th><th>Casa</th><th>Evento</th><th>Causa</th></tr>${record.events
    .slice(0, 200)
    .map(
      (v) =>
        `<tr><td>${v.time.toFixed(3)} s</td><td>${e(v.house)}</td><td>${e(v.id)} · ${e(v.type)} ${e(v.kind)} #${v.pieceId}</td><td>${v.impact ? `Impacto de ${e(v.impact.sourceReleaseId)} sobre pieza #${v.impact.targetPieceId} · ${v.demand.toFixed(1)} ${e(v.unit ?? "N")} frente a ${v.capacity.toFixed(1)} ${e(v.unit ?? "N")}` : e(v.cause)}</td></tr>`,
    )
    .join(
      "",
    )}</table><p>Se muestran hasta 200 eventos en este informe; los exportables conservan el registro completo.</p><h2>Parámetros, unidades y fuentes</h2><pre>${e(JSON.stringify(record.model, null, 2))}</pre></html>`;
}
