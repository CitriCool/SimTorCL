import {
  DEFAULTS,
  HOUSE,
  PROFILES,
  ROOFS,
  SOURCES,
  validateConfig,
} from "./catalog.js";

import { RULES, FIXED_STEP } from "./physics.js";

export const APP_VERSION = "2.2.0";

export const SCHEMA_VERSION = 1;

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
  "mode",
  "distribution",
  "spacing",
  "trajectory",
];

export function cleanConfig(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Configuración inválida.");

  const config = {
    ...DEFAULTS,
    mode: "single",
    distribution: "mixed",
    spacing: 13,
    trajectory: "diagonal",
  };

  for (const key of CONFIG_KEYS)
    if (Object.hasOwn(input, key)) config[key] = input[key];

  validateConfig(config);

  if (
    !["single", "block9", "block16"].includes(config.mode) ||
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
    for (const { label, simulation } of houseSimulations(experiment)) {
      const offset = this.offsets.get(label) ?? 0;

      for (const event of simulation.events.slice(offset))
        this.events.push({
          ...clone(event),
          id: `${label}:E${event.id}`,
          house: label,
          parents: event.parents.map((id) => `${label}:E${id}`),
          step: experiment.steps,
        });

      this.offsets.set(label, simulation.events.length);
    }

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
      name: normalizeName(name),
      startedAt: this.startedAt,
      savedAt: new Date().toISOString(),
      initial: clone(this.initial),
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

export function configurationDocument(config, name) {
  return {
    format: "simtorcl-experiment",
    schemaVersion: 1,
    kind: "configuration",
    appVersion: APP_VERSION,
    modelId: MODEL_ID,
    model: clone(MODEL),
    name: normalizeName(name),
    savedAt: new Date().toISOString(),
    initial: cleanConfig(config),
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
        schemaVersion: 1,
        modelId: MODEL_ID,
        name: normalizeName(name),
        config: cleanConfig(config),
      }),
    );
  return url.href;
}

export function parseShareHash(hash) {
  if (!hash.startsWith("#simtorcl=")) return null;
  if (hash.length > 5000) throw new Error("Enlace demasiado largo.");
  let data;
  try {
    data = JSON.parse(decodeURIComponent(hash.slice(10)));
  } catch {
    throw new Error("Enlace de configuración inválido.");
  }
  if (data.schemaVersion !== 1 || data.modelId !== MODEL_ID)
    throw new Error("El enlace usa otra versión del modelo.");
  return { config: cleanConfig(data.config), name: normalizeName(data.name) };
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

  if (
    !record ||
    record.format !== "simtorcl-experiment" ||
    record.schemaVersion !== 1
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

  if (!["configuration", "run"].includes(record.kind))
    throw new Error("Tipo de experimento desconocido.");

  finiteTree(record);

  if (record.kind === "configuration")
    return configurationDocument(record.initial, record.name);

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

  const homes =
    record.initial.mode === "single"
      ? 1
      : record.initial.mode === "block9"
        ? 9
        : 16;

  const base = Object.keys(PROFILES).indexOf(record.initial.profile);
  function checkStateShape(stats, step) {
    if (Math.abs(stats.elapsed - step * FIXED_STEP) > 1e-6)
      throw new Error("El reloj no coincide con los pasos guardados.");
    if (homes === 1) {
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
        record.initial.mode !== "single" &&
        record.initial.distribution === "mixed"
          ? Object.keys(PROFILES)[(base + i) % 4]
          : record.initial.profile
      ];
    const roof = ROOFS[record.initial.roof];
    return (
      12 +
      (p.claddingPressure ? (p.id === "concrete" ? 11 : 12) : 0) +
      (roof.id === "slab" ? 1 : 2 * roof.columns * roof.rows)
    );
  });

  const expectedPieces = pieceCounts.reduce((a, b) => a + b, 0);

  const ids = new Set();
  last = -1;

  for (const event of record.events) {
    if (
      !event ||
      typeof event.id !== "string" ||
      event.id.length > 40 ||
      ids.has(event.id) ||
      !/^C\d{2}$/.test(event.house) ||
      Number(event.house.slice(1)) < 1 ||
      Number(event.house.slice(1)) > homes ||
      !count(event.step, record.steps) ||
      event.step < last ||
      !Number.isFinite(event.time) ||
      Math.abs(event.time - event.step * FIXED_STEP) > 1e-6 ||
      !["connection", "release"].includes(event.type) ||
      !["roof", "wall", "cladding", "base", "corner"].includes(event.kind) ||
      !["overload", "support"].includes(event.cause) ||
      !count(
        event.pieceId,
        pieceCounts[Number(event.house.slice(1)) - 1] - 1,
      ) ||
      !Array.isArray(event.parents) ||
      event.parents.some((id) => !ids.has(id))
    )
      throw new Error("Registro de eventos inválido.");

    if (
      event.type === "release" &&
      (!Number.isFinite(event.mass) || event.mass < 0)
    )
      throw new Error("Masa inválida.");

    if (
      event.type === "connection" &&
      (!count(event.connectionId, 200) ||
        !Number.isFinite(event.capacity) ||
        event.capacity < 0 ||
        !Number.isFinite(event.demand) ||
        event.demand < 0)
    )
      throw new Error("Carga o capacidad inválida.");

    ids.add(event.id);
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

  for (const { label, simulation } of houseSimulations(experiment)) {
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
    if (typeof v === "string" && /^(?:[=+@\-\t\r\n]|\s+[=+@-])/.test(s)) s = "'" + s;
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
      "masa_kg",
      "superficie_m2",
      "x_m",
      "y_m",
      "z_m",
      "liberada",
      "uniones_falladas",
      "uniones_estructurales_falladas_en_muro",
    ],
    ...houseSimulations(experiment).flatMap(({ label, simulation }) =>
      simulation.pieces.map((p) => [
        record.name,
        label,
        p.id,
        p.kind,
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
      "demanda_N",
      "capacidad_N",
      "eventos_relacionados",
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
      e.parents.join(" | "),
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

export function htmlReport(record, image = "") {
  const e = escapeHTML,
    s = record.results,
    rows = s.rows ?? [
      { ...s, label: "C01", profile: PROFILES[record.initial.profile].label },
    ];

  const screenshot = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)
    ? `<img alt="Vista del experimento al exportar" src="${image}"/>`
    : "";

  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${e(record.name)} · SimTorCL</title><style>body{font:15px system-ui;line-height:1.6;max-width:1100px;margin:40px auto;padding:20px;color:#19392e}table{border-collapse:collapse;width:100%}td,th{padding:8px;text-align:left;border-bottom:1px solid #ccc}img{max-width:100%}svg{width:100%;background:#17231e;color:#dfece3;border-radius:8px;padding:12px}pre{white-space:pre-wrap}small{color:#52665a}@media print{body{margin:0}}</style><h1>${e(record.name)}</h1><p>SimTorCL ${APP_VERSION} · esquema ${SCHEMA_VERSION} · modelo ${MODEL_ID}</p><p>Tiempo simulado: ${s.elapsed.toFixed(2)} s · tiempo real activo: ${record.realSeconds.toFixed(2)} s. Los periodos en pausa se excluyen.</p><p>Modelo educativo con propiedades ilustrativas, sin validación experimental. La geometría urbana sintética no representa distribuciones censales. Informe de resultados declarados de una ejecución; una importación no recalcula ni certifica los datos.</p>${screenshot}<p>La imagen corresponde a la vista al exportar; las tablas y curvas describen la ejecución completa.</p><h2>Daño durante la ejecución</h2><p>Naranja: cubierta desprendida. Verde: paredes sin soporte. Curvas muestreadas, de 0 a 100 %.</p>${damageChart(record)}<h2>Resultados por vivienda</h2><table><tr><th>Casa</th><th>Perfil</th><th>Cubierta</th><th>Paredes sin soporte</th><th>Uniones falladas</th><th>Movimiento máximo de paredes</th><th>Estado</th></tr>${rows.map((r) => `<tr><td>${e(r.label)}</td><td>${e(r.profile)}</td><td>${r.detached}/${r.total}</td><td>${r.wallDetached}/${r.wallTotal}</td><td>${r.broken}/${r.connectionTotal}</td><td>${r.maxDisplacement.toFixed(2)} m / ${r.maxTilt.toFixed(1)}°</td><td>${e(r.state)}</td></tr>`).join("")}</table><h2>Configuración inicial</h2><pre>${e(JSON.stringify(record.initial, null, 2))}</pre><h2>Cambios durante la ejecución</h2><pre>${e(JSON.stringify(record.changes, null, 2))}</pre><h2>Eventos</h2><p>${record.events.length} eventos. El archivo JSON y el CSV de eventos conservan todos los identificadores y relaciones.</p><table><tr><th>Tiempo</th><th>Casa</th><th>Evento</th><th>Causa</th></tr>${record.events
    .slice(0, 200)
    .map(
      (v) =>
        `<tr><td>${v.time.toFixed(3)} s</td><td>${e(v.house)}</td><td>${e(v.id)} · ${e(v.type)} ${e(v.kind)} #${v.pieceId}</td><td>${e(v.cause)}</td></tr>`,
    )
    .join(
      "",
    )}</table><p>Se muestran hasta 200 eventos en este informe; los exportables conservan el registro completo.</p><h2>Parámetros, unidades y fuentes</h2><pre>${e(JSON.stringify(record.model, null, 2))}</pre></html>`;
}
