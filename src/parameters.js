import { dynamicPressure } from "./aerodynamics.js";
import { windAt } from "./physics.js";

export const LIBRARY_VERSION = "parameters-1";
export const EVIDENCE_LABELS = {
  illustrative: "Supuesto educativo",
  numerical: "Configuración numérica",
};
const CONSULTED = "2026-11-03";
export const EQUATION_SOURCES = [
  {
    id: "nasa-pressure",
    institution: "NASA · Glenn Research Center",
    title: "Dynamic Pressure",
    url: "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/dynamic-pressure/",
    edition: "Página web, sin edición declarada",
    section: "Derivation: q = ρu²/2",
    consulted: CONSULTED,
    status: "Ecuación consultada",
    supports:
      "Definición de presión dinámica; no valida densidad, campo de tornado ni resistencias del catálogo.",
  },
  {
    id: "nasa-drag",
    institution: "NASA · Glenn Research Center",
    title: "Drag Equation",
    url: "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/",
    edition: "Página web, sin edición declarada",
    section: "Drag Coefficient; Reference Area; Density",
    consulted: CONSULTED,
    status: "Ecuación consultada",
    supports:
      "D = Cd · ρV²A/2. Cd y área de referencia deben corresponder al objeto y a las condiciones del ensayo; no aporta el Cd del catálogo.",
  },
];

// Explicit dimensions for the numeric fields in the versioned model descriptor.
// Unsupported fields fail closed: adding a new parameter requires describing it.
const FIELDS = {
  width: ["Ancho", "m"],
  depth: ["Fondo", "m"],
  height: ["Altura", "m"],
  bays: ["Segmentos por fachada", "1"],
  pitch: ["Pendiente angular", "rad"],
  eave: ["Alero", "m"],
  thickness: ["Espesor de representación", "m"],
  arealMass: ["Masa superficial", "kg/m²"],
  jointPressure: ["Capacidad de unión por superficie", "N/m²"],
  claddingPressure: ["Fijación secundaria por superficie", "N/m²"],
  claddingMass: ["Masa superficial secundaria", "kg/m²"],
  fixingPressure: ["Fijación de cubierta por superficie", "N/m²"],
  columns: ["Columnas de módulos", "1"],
  rows: ["Filas de módulos", "1"],
  stableDisplacement: ["Umbral de desplazamiento estable", "m"],
  stableTilt: ["Umbral de inclinación estable", "°"],
  collapseTilt: ["Umbral de inclinación de colapso", "°"],
  collapseDrop: ["Umbral de descenso de colapso", "m"],
  collapseFraction: ["Fracción para indicador de colapso", "1"],
  overloadSeconds: ["Duración de sobrecarga", "s"],
  step: ["Paso temporal", "s"],
  iterations: ["Iteraciones del solver", "1"],
  gravity: ["Aceleración gravitatoria", "m/s²"],
  friction: ["Coeficiente de fricción", "1"],
  restitution: ["Coeficiente de restitución", "1"],
  linearDamping: ["Amortiguamiento lineal del motor", "1"],
  angularDamping: ["Amortiguamiento angular del motor", "1"],
  airDensity: ["Densidad del aire", "kg/m³"],
  radialFactor: ["Factor radial del campo", "1"],
  tangentialFactor: ["Factor tangencial del campo", "1"],
  verticalFactor: ["Factor vertical del campo", "1"],
  falloffExponent: ["Exponente de atenuación", "1"],
  altitudeLimit: ["Límite de altura del campo", "m"],
  minimumDistance: ["Distancia mínima de regularización", "m"],
  rampSeconds: ["Rampa de carga", "s"],
  wallResidualFactor: ["Factor vertical residual en paredes", "1"],
  dragCoefficient: ["Coeficiente de arrastre de fragmentos", "1"],
  blockSpeed: ["Velocidad de traslación", "m/s"],
  orbitalAngularSpeed: ["Velocidad angular orbital", "rad/s"],
  orbitalRadiusX: ["Radio orbital X", "m"],
  orbitalRadiusZ: ["Radio orbital Z", "m"],
  orbitalPhase: ["Fase orbital", "rad"],
};
const ENV_FIELDS = {
  treeHeight: "Altura nominal de referencia del árbol",
  woodDensity: "Densidad de madera",
  treeAnchor: "Anclaje del árbol estándar",
  treeWeakAnchor: "Anclaje del árbol reducido",
  branchJoint: "Unión de rama",
  crownJoint: "Unión de copa",
  benchAnchor: "Anclaje de banco",
  benchJoint: "Unión de piezas de banco",
  storeyHeight: "Altura de entrepiso",
  buildingWidth: "Ancho nominal del edificio",
  concreteDensity: "Densidad de hormigón",
  facadeMass: "Masa superficial de fachada y cubierta",
  windowMass: "Masa superficial de ventana",
  facadeFixing: "Fijación de fachada por superficie",
  windowFixing: "Fijación de ventana por superficie",
  roofFixing: "Fijación de cubierta por superficie",
};
const GROUPS = {
  house: "Geometría de vivienda",
  profiles: "Paredes de viviendas",
  roofs: "Cubiertas de viviendas",
  rules: "Reglas de daño",
  step: "Cálculo numérico",
  engine: "Cálculo numérico",
  wind: "Viento",
  trajectory: "Trayectoria",
};
function numericLeaves(value, path = []) {
  return Object.entries(value).flatMap(([key, v]) => {
    if (typeof v === "number") return [{ path: [...path, key], value: v }];
    if (v && typeof v === "object" && !Array.isArray(v))
      return numericLeaves(v, [...path, key]);
    return [];
  });
}
function entry(id, label, value, unit, group, appliesTo, evidence, note = "") {
  return {
    id,
    label,
    value,
    unit,
    group,
    appliesTo,
    evidence,
    origin: "Configuración de SimTorCL; valor conservado del modelo educativo",
    sourceIds: [],
    section: null,
    applicability:
      "Solo la idealización indicada y esta versión del modelo. Sin intervalo de validez física calibrado.",
    calibratedRange: null,
    status:
      evidence === "numerical"
        ? "Verificación numérica; no validación estructural"
        : "Calibración técnica pendiente",
    note,
  };
}
export function parameterLibrary(model, environment = null) {
  const entries = numericLeaves(model.parameters).map(({ path, value }) => {
    const field = path.at(-1),
      definition = FIELDS[field];
    if (!definition)
      throw new Error(`Falta describir el parámetro ${path.join(".")}`);
    const [root, variant] = path;
    const owner = ["profiles", "roofs"].includes(root)
      ? model.parameters[root][variant].label
      : GROUPS[root];
    const numerical =
      root === "step" || (root === "engine" && field === "iterations");
    return entry(
      `model.${path.join(".")}`,
      `${owner} · ${definition[0]}`,
      value,
      definition[1],
      GROUPS[root],
      ["profiles", "roofs"].includes(root) ? variant : root,
      numerical ? "numerical" : "illustrative",
    );
  });
  for (const [key, p] of Object.entries(environment?.parameters ?? {})) {
    if (!ENV_FIELDS[key])
      throw new Error(`Falta describir el parámetro urbano ${key}`);
    entries.push(
      entry(
        `environment.${key}`,
        ENV_FIELDS[key],
        p.value,
        p.unit,
        "Entorno urbano",
        environment.version,
        "illustrative",
        key === "treeHeight"
          ? "Referencia nominal: la geometría real se conserva en el inventario de piezas; este valor no controla por sí solo la altura de la copa."
          : key === "concreteDensity"
            ? "Masa nominal del núcleo fijo; el núcleo no participa como estructura deformable ni colapsable."
            : "",
      ),
    );
  }
  return {
    version: LIBRARY_VERSION,
    reviewed: CONSULTED,
    modelVersion: model.version,
    environmentVersion: environment?.version ?? null,
    scope:
      "Parámetros numéricos declarados en los descriptores de vivienda, cálculo y entorno. No es un inventario de cada constante interna; geometría y propiedades por pieza se conservan por separado.",
    sources: [
      ...Object.entries(model.sources).map(([id, s]) => ({
        id: `census-${id}`,
        ...s,
        institution: "INE",
        edition: "Censo 2024",
        section:
          "Categorías de vivienda y materialidad; véase documento original",
        status: "Referencia de clasificación; sin extracción mecánica",
        supports:
          "Tipología y materialidad. No respalda valores mecánicos de esta biblioteca.",
      })),
      ...(environment?.sources ?? []).map((s) => ({
        ...s,
        edition: "No comprobada en esta entrega",
        consulted: null,
      })),
      ...EQUATION_SOURCES.map((s) => ({ ...s })),
    ],
    equations: [
      {
        id: "dynamic-pressure",
        expression: "q = ρV²/2",
        sourceIds: ["nasa-pressure"],
        implementation: "dynamicPressure; windAt",
        scope:
          "Presión dinámica, con velocidad en m/s. No equivale por sí sola a presión sobre una fachada.",
      },
      {
        id: "drag",
        expression: "D = Cd · q · A",
        sourceIds: ["nasa-drag"],
        implementation: "Arrastre de fragmentos; caso analítico",
        scope:
          "El Cd = 0,7 del modelo sigue siendo un supuesto. El campo del tornado tiene factores propios educativos.",
      },
    ],
    entries,
  };
}

export function libraryCSV(library) {
  const rows = [
    [
      "biblioteca",
      "id",
      "propiedad",
      "valor",
      "unidad",
      "grupo",
      "aplica_a",
      "evidencia",
      "origen",
      "fuentes",
      "seccion",
      "aplicabilidad",
      "intervalo_calibrado",
      "estado",
      "nota",
    ],
    ...library.entries.map((p) => [
      library.version,
      p.id,
      p.label,
      p.value,
      p.unit,
      p.group,
      p.appliesTo,
      p.evidence,
      p.origin,
      p.sourceIds.join(";"),
      p.section ?? "",
      p.applicability,
      p.calibratedRange ?? "",
      p.status,
      p.note,
    ]),
  ];
  return (
    "\ufeff" +
    rows
      .map((row) =>
        row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n")
  );
}

// Independent fixed analytical references, not values calculated by the tested
// function. The field reference includes SimTorCL's documented synthetic factors.
export function referenceCheck(sample = windAt) {
  const pressure = dynamicPressure(36 / 3.6),
    force = pressure * 0.7 * 2;
  const load = sample(
    { x: 0, y: 0, z: 4 },
    { x: 0, y: 0, z: 0 },
    { wind: 36, radius: 8 },
    2,
  );
  const doubled = sample(
    { x: 0, y: 0, z: 4 },
    { x: 0, y: 0, z: 0 },
    { wind: 72, radius: 8 },
    2,
  );
  const zero = sample(
    { x: 0, y: 0, z: 4 },
    { x: 0, y: 0, z: 0 },
    { wind: 0, radius: 8 },
    2,
  );
  const outside = sample(
    { x: 0, y: 0, z: 8 },
    { x: 0, y: 0, z: 0 },
    { wind: 36, radius: 8 },
    2,
  );
  const rows = [
    ["Presión dinámica a 36 km/h", 61.25, pressure, "Pa"],
    ["Arrastre: área 2 m², Cd 0,7", 85.75, force, "N"],
    ["Campo sintético: fuerza X", -46.92135220967635, load.x, "N"],
    ["Campo sintético: fuerza Y", 38.64111358443935, load.y, "N"],
    ["Campo sintético: fuerza Z", -9.936286350284405, load.z, "N"],
    ...["x", "y", "z"].map((axis) => [
      `Duplicar velocidad: componente ${axis.toUpperCase()}`,
      4 *
        { x: -46.92135220967635, y: 38.64111358443935, z: -9.936286350284405 }[
          axis
        ],
      doubled[axis],
      "N",
    ]),
    [
      "Viento cero: norma de fuerza",
      0,
      Math.hypot(zero.x, zero.y, zero.z),
      "N",
    ],
    [
      "Límite del radio: norma de fuerza",
      0,
      Math.hypot(outside.x, outside.y, outside.z),
      "N",
    ],
  ].map(([label, expected, actual, unit]) => {
    const error = Math.abs(actual - expected),
      tolerance = 1e-9 * Math.max(1, Math.abs(expected));
    return {
      label,
      expected,
      actual,
      unit,
      absoluteError: error,
      tolerance,
      passed: Number.isFinite(actual) && error <= tolerance,
    };
  });
  return {
    id: "pressure-reference-1",
    modelVersion: "pressure-v2.1",
    libraryVersion: LIBRARY_VERSION,
    type: "analytical-verification",
    inputs: {
      wind: { value: 36, unit: "km/h" },
      density: { value: 1.225, unit: "kg/m³", evidence: "illustrative" },
      area: { value: 2, unit: "m²" },
      coefficient: { value: 0.7, unit: "1", evidence: "illustrative" },
      fieldPosition: [0, 0, 4],
      center: [0, 0, 0],
      radius: { value: 8, unit: "m" },
    },
    criterion:
      "Error absoluto ≤ 10⁻⁹ · max(1, |referencia|), por magnitud y en su unidad.",
    scope:
      "Verifica presión dinámica, unidades, componentes y límites del campo sintético. No valida resistencias, daño estructural, colisiones ni un tornado real.",
    sourceIds: ["nasa-pressure", "nasa-drag"],
    rows,
    passed: rows.every((r) => r.passed),
  };
}
