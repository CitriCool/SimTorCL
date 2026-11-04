// Census categories describe dwellings, not structural strength. All physical
// values below are explicitly illustrative calibration inputs (SI units).
export const SOURCES = Object.freeze({
  glossary: {
    title: "INE · Glosario de viviendas, Censo 2024",
    url: "https://censo2024.ine.gob.cl/wp-content/uploads/2025/05/Glosario_viviendas_y_servicios-basicos_CPV2024.pdf",
    consulted: "2026-11-02",
  },
  manual: {
    title: "INE · Manual censal 2024, preguntas de vivienda",
    url: "https://censo2024.ine.gob.cl/wp-content/uploads/2025/03/Manual_Censal_CPV2024.pdf",
    consulted: "2026-11-02",
  },
  results: {
    title: "INE · Resultados y acceso a tabulados y microdatos",
    url: "https://censo2024.ine.gob.cl/resultados/",
    consulted: "2026-11-02",
  },
});
export const CENSUS = Object.freeze({
  year: 2024,
  // Internal keys, not codes of census variables.
  dwellingTypes: [
    "Casa con acceso directo desde la calle",
    "Casa en condominio cerrado",
    "Departamento con ascensor",
    "Departamento sin ascensor",
    "Vivienda tradicional indígena",
    "Pieza en casa antigua o conventillo",
    "Mediagua, mejora, vivienda de emergencia, rancho o choza",
    "Vivienda móvil",
    "Otro tipo de vivienda particular",
  ],
  walls: [
    "Hormigón armado",
    "Albañilería",
    "Tabique forrado por ambas caras",
    "Tabique sin forro interior",
    "Adobe, barro, pirca, quincha u otro material artesanal",
    "Materiales precarios",
  ],
  roofs: [
    "Tejas o tejuelas",
    "Losa de hormigón",
    "Planchas metálicas",
    "Planchas de fibrocemento",
    "Fonolita o fieltro embreado",
    "Paja, coirón, totora o caña",
    "Materiales precarios",
    "Sin cubierta sólida",
  ],
  floors: [
    "Parquet, piso flotante u otro revestimiento",
    "Radier sin revestimiento",
    "Baldosa de cemento",
    "Capa de cemento sobre tierra",
    "Tierra",
  ],
  scope:
    "Perfiles ilustrativos de casas. Las categorías de materialidad corresponden a paredes exteriores y cubierta predominantes. No se asignan frecuencias de combinaciones ni porcentajes regionales.",
  physicalProvenance:
    "Calibración educativa de SimTorCL, sin validación experimental. Masas, resistencias, geometría y coeficientes de viento no provienen del censo.",
});
export const HOUSE = Object.freeze({
  width: 6.4,
  depth: 6.4,
  height: 3,
  bays: 3,
  pitch: 0.34,
  eave: 0.45,
});
export function roofHeightAt(x) {
  return (
    HOUSE.height +
    0.08 +
    (HOUSE.width / 2 - Math.abs(x)) * Math.tan(HOUSE.pitch)
  );
}
const pitchedRoofs = ["metal", "fiber", "tile"];
export const PROFILES = Object.freeze({
  masonry: {
    id: "masonry",
    label: "Albañilería",
    family: "Albañilería",
    censusWall: "Albañilería",
    description:
      "Paneles macizos con uniones frágiles idealizadas; la rotura separa segmentos rígidos.",
    thickness: 0.18,
    arealMass: 260,
    jointPressure: 1600,
    claddingPressure: 0,
    color: "#b98865",
    roofs: [...pitchedRoofs, "slab"],
    defaultRoof: "metal",
    failure: "Separación de segmentos de albañilería",
  },
  timber: {
    id: "timber",
    label: "Entramado de madera",
    family: "Estructura liviana",
    censusWall: "Tabique forrado por ambas caras",
    description:
      "Variante ilustrativa de madera. Revestimientos y paneles estructurales tienen conexiones independientes.",
    thickness: 0.14,
    arealMass: 32,
    jointPressure: 850,
    claddingPressure: 300,
    claddingMass: 9,
    color: "#ad9672",
    roofs: pitchedRoofs,
    defaultRoof: "metal",
    failure: "Pérdida de revestimientos y uniones del entramado",
  },
  steel: {
    id: "steel",
    label: "Entramado de acero",
    family: "Estructura liviana",
    censusWall: "Tabique forrado por ambas caras",
    description:
      "Variante ilustrativa de acero dentro de la misma categoría censal que el entramado de madera.",
    thickness: 0.12,
    arealMass: 28,
    jointPressure: 1250,
    claddingPressure: 420,
    claddingMass: 11,
    color: "#b5bfc0",
    roofs: pitchedRoofs,
    defaultRoof: "metal",
    failure: "Pérdida de revestimientos y uniones del entramado",
  },
  concrete: {
    id: "concrete",
    label: "Hormigón armado",
    family: "Hormigón armado",
    censusWall: "Hormigón armado",
    description:
      "Segmentos rígidos con conexiones de mayor capacidad asumida; ventanas secundarias desprendibles.",
    thickness: 0.16,
    arealMass: 360,
    jointPressure: 4000,
    claddingPressure: 650,
    claddingMass: 22,
    color: "#b6b7a6",
    roofs: [...pitchedRoofs, "slab"],
    defaultRoof: "slab",
    failure:
      "Elementos secundarios; pérdida de soporte solo si fallan las uniones",
  },
});
export const ROOFS = Object.freeze({
  metal: {
    id: "metal",
    label: "Planchas metálicas",
    censusRoof: "Planchas metálicas",
    unit: "planchas",
    arealMass: 4.2,
    thickness: 0.065,
    fixingPressure: 250,
    columns: 2,
    rows: 4,
    color: "#8daba8",
  },
  fiber: {
    id: "fiber",
    label: "Fibrocemento",
    censusRoof: "Planchas de fibrocemento",
    unit: "planchas",
    arealMass: 12,
    thickness: 0.07,
    fixingPressure: 300,
    columns: 2,
    rows: 4,
    color: "#9daba5",
  },
  tile: {
    id: "tile",
    label: "Tejas / tejuelas",
    censusRoof: "Tejas o tejuelas",
    unit: "módulos",
    arealMass: 40,
    thickness: 0.09,
    fixingPressure: 190,
    columns: 4,
    rows: 8,
    color: "#a86f50",
  },
  slab: {
    id: "slab",
    label: "Losa de hormigón",
    censusRoof: "Losa de hormigón",
    unit: "losa",
    arealMass: 300,
    thickness: 0.15,
    fixingPressure: 10000,
    columns: 1,
    rows: 1,
    color: "#b0b2a4",
  },
});
export const DEFAULTS = Object.freeze({
  profile: "masonry",
  roof: "metal",
  wind: 160,
  radius: 8,
  reinforcement: 100,
  impact: "off",
});
export const PRESETS = Object.freeze({ suave: 85, fuerte: 160, extremo: 250 });
export function validateConfig(values = {}) {
  const config = { ...DEFAULTS, ...values };
  if (!["off", "contact-v1", "swept-v2"].includes(config.impact))
    throw new RangeError("Modelo de impactos desconocido.");
  const profile = Object.hasOwn(PROFILES, config.profile)
    ? PROFILES[config.profile]
    : null;
  if (!profile) throw new RangeError("Perfil de vivienda desconocido.");
  if (
    !Object.hasOwn(ROOFS, config.roof) ||
    !profile.roofs.includes(config.roof)
  )
    throw new RangeError(
      "Cubierta no disponible para este perfil ilustrativo.",
    );
  for (const [key, min, max] of [
    ["wind", 0, 280],
    ["radius", 4, 12],
    ["reinforcement", 50, 200],
  ]) {
    if (!Number.isFinite(config[key]) || config[key] < min || config[key] > max)
      throw new RangeError(`Parámetro fuera de rango: ${key}`);
  }
  return config;
}
