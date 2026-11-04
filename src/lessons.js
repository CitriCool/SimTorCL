import { EditorState } from "./editor-state.js";
import { WORKSHOP_PLAN_VERSION } from "./site-plan.js";

export const LESSONS = {
  residential: {
    title: "Barrio residencial",
    goal: "Cambia la cubierta de una casa y observa qué uniones fallan primero.",
    steps: [
      "Selecciona una casa y cambia su cubierta.",
      "Prepara el recorrido y aplica el diseño.",
      "Ejecuta el ensayo; selecciona una pieza para consultar su falla.",
    ],
  },
  mixed: {
    title: "Barrio mixto",
    goal: "Distingue daños de casas, envolvente de edificios y vegetación.",
    steps: [
      "Selecciona el edificio y revisa sus pisos.",
      "Haz pasar el recorrido entre los dos parques.",
      "Compara los resultados por vivienda y por objeto urbano.",
    ],
  },
  plaza: {
    title: "Plaza con edificios",
    goal: "Observa ramas, anclajes y bancas como objetos físicos independientes.",
    steps: [
      "Selecciona un árbol independiente o añade una banca.",
      "Traza un recorrido que atraviese la plaza.",
      "Busca en el registro la primera unión fallada y sus consecuencias.",
    ],
  },
  reinforced: {
    title: "Viviendas reforzadas",
    goal: "Compara el refuerzo manteniendo el mismo plano y recorrido.",
    steps: [
      "Conserva la distribución para comparar condiciones comunes.",
      "Ejecuta el escenario con refuerzo del 150 %.",
      "Abre Comparar refuerzo y contrasta con el 100 %; observa los resultados del modelo.",
    ],
  },
  "puerto-varas-2025": {
    title: "Puerto Varas 2025",
    goal: "Sigue el recorrido de noroeste a sureste y observa el daño en cubiertas, fachadas y árboles.",
    steps: [
      "Mira la ruta dibujada en el plano y aplica el escenario.",
      "Inicia el ensayo y observa qué objetos quedan cerca del paso del tornado.",
      "Pausa y alterna entre la geometría inicial y el estado calculado.",
    ],
    historical: {
      location: "PUERTO VARAS / LOS LAGOS",
      event: "El 25 de mayo de 2025, un tornado afectó a Puerto Varas, Los Lagos, incluido el sector Walker Martínez. La DMC lo clasificó como EF1 a partir de los daños observados y documentó pérdidas de techumbre.",
      model: "El ensayo representa un tramo urbano ilustrativo de 4 × 4 parcelas. El recorrido sigue la dirección general de noroeste a sureste. La manzana y los materiales son sintéticos. Los parámetros iniciales de 175 km/h, 6 m/s de avance, 12 m de radio y 50 % de refuerzo son didácticos. Los daños son resultados del modelo.",
      source: "https://blog.meteochile.gob.cl/2025/06/18/encontrando-el-rastro-del-tornado-en-puerto-varas/",
    },
  },
  "itata-2019": {
    title: "Rinconada de Itata 2019 · Escenario rural",
    goal: "Compara techumbres y árboles cerca del recorrido con viviendas más alejadas.",
    steps: [
      "Observa las viviendas dispersas y los terrenos abiertos.",
      "Ejecuta el ensayo y compara el daño entre parcelas.",
    ],
    historical: {
      location: "YUNGAY / ÑUBLE",
      event: "El 30 de mayo de 2019 se reportaron 42 viviendas afectadas y voladuras de techumbre en Yungay. El informe de la DMC incluyó el episodio entre los tornados sin confirmar.",
      model: "Tramo rural ilustrativo de 215 × 110 m. La ubicación de las viviendas y los árboles, el recorrido y los 160 km/h de viento son supuestos del ensayo. El recuento histórico describe viviendas afectadas; los resultados del modelo cuentan piezas y uniones.",
      source: "https://climatologia.meteochile.gob.cl/publicaciones/climaHoy/climaHoy20201204.pdf",
      sourceLabel: "Informe especial de la DMC ↗",
    },
  },
};

const puertoVaras = LESSONS["puerto-varas-2025"];
LESSONS["puerto-varas-corridor"] = {
  ...puertoVaras,
  title: "Puerto Varas 2025 · Corredor ampliado",
  historical: {
    ...puertoVaras.historical,
    model: "Ensayo ilustrativo de 273 × 183 m, con 96 parcelas y recorrido de noroeste a sureste. Las calles y construcciones son sintéticas. Se mantienen los parámetros didácticos del tramo original y se amplía la duración a 60 s. Los daños son resultados del modelo.",
  },
};

function puertoVarasConfig(id) {
  const expanded = id === "puerto-varas-corridor";
  const grid = expanded
    ? { rows: 8, columns: 12, lotSize: 16, roadWidth: 4 }
    : { rows: 4, columns: 4, lotSize: 12, roadWidth: 4 };
  const d = new EditorState({
    ...grid,
    mode: "neighborhood",
    sitePlan: {
      version: WORKSHOP_PLAN_VERSION,
      grid,
      nextId: 1,
      objects: [],
      items: [],
    },
    wind: 175,
    radius: 12,
    profile: "timber",
    roof: "metal",
    distribution: "uniform",
    reinforcement: 50,
    loadPath: "grounded-graph-v1",
    fragmentFlight: "projected-v1",
    travelSpeed: 6,
    duration: expanded ? 60 : 25,
    route: expanded ? [
      { x: -136, z: -82 },
      { x: -55, z: -37 },
      { x: 56, z: 32 },
      { x: 136, z: 82 },
    ] : [
      { x: -39, z: -37 },
      { x: -12, z: -13 },
      { x: 13, z: 11 },
      { x: 39, z: 39 },
    ],
    lesson: id,
  });
  const houses = expanded
    ? ["P01", "P02", "P15", "P28", "P29", "P40", "P54", "P55", "P57", "P82", "P95", "P96"]
    : ["P01", "P02", "P06", "P10", "P15", "P16"];
  for (const parcelId of houses)
    d.execute("place", { type: "house", parcelId });
  for (const parcelId of expanded ? ["P02", "P29", "P55", "P95"] : ["P02", "P10"])
    d.execute("properties", { id: d.at(parcelId).id, profile: "masonry" });
  for (const parcelId of expanded ? ["P13", "P56", "P81"] : ["P05", "P14"])
    d.execute("place", { type: "building", parcelId });
  for (const parcelId of expanded ? ["P42", "P69", "P83"] : ["P11", "P12"])
    d.execute("place", { type: "green", parcelId });
  d.execute("place-item", { type: "tree", parcelId: expanded ? "P41" : "P07", slot: 6 });
  return d.assertReady();
}

function itataConfig() {
  const grid = { rows: 4, columns: 8, lotSize: 20, roadWidth: 4 };
  const d = new EditorState({
    ...grid,
    mode: "neighborhood",
    sitePlan: { version: WORKSHOP_PLAN_VERSION, grid, nextId: 1, objects: [], items: [] },
    profile: "timber",
    roof: "metal",
    distribution: "uniform",
    wind: 160,
    radius: 12,
    reinforcement: 50,
    loadPath: "grounded-graph-v1",
    fragmentFlight: "projected-v1",
    travelSpeed: 6,
    duration: 45,
    route: [{ x: -106, z: -15 }, { x: 0, z: -13 }, { x: 106, z: -10 }],
    lesson: "itata-2019",
  });
  for (const parcelId of ["P09", "P11", "P13", "P15", "P26", "P29"])
    d.execute("place", { type: "house", parcelId });
  d.execute("properties", { id: d.at("P13").id, profile: "masonry" });
  for (const parcelId of ["P10", "P14", "P18"])
    d.execute("place-item", { type: "tree", parcelId, slot: 4 });
  return d.assertReady();
}

export function lessonConfig(id) {
  if (!Object.hasOwn(LESSONS, id))
    throw new Error("Ejemplo guiado desconocido.");
  if (id === "itata-2019") return itataConfig();
  if (LESSONS[id].historical) return puertoVarasConfig(id);
  const d = new EditorState({
    mode: "neighborhood",
    rows: 2,
    columns: 3,
    lotSize: 12,
    roadWidth: 4,
    greenPercent: 0,
    buildingPercent: 0,
    wind: 250,
    radius: 12,
    distribution: "uniform",
    profile: "timber",
    roof: "metal",
    seed: 38,
    reinforcement: id === "reinforced" ? 150 : 100,
    travelSpeed: 3,
    duration: 45,
    lesson: id,
  });
  for (const o of [...d.plan.objects]) d.execute("remove", { id: o.id });
  const types =
    id === "residential" || id === "reinforced"
      ? ["house", "house", "house", "house", "green", null]
      : id === "plaza"
        ? ["building", "green", "building", "house", "green", "house"]
        : ["building", "house", "green", "green", "house", "building"];
  types.forEach((type, i) => {
    if (!type) return;
    const parcelId = `P0${i + 1}`;
    d.execute("place", { type, parcelId });
    if (type === "building")
      d.execute("properties", {
        id: d.at(parcelId).id,
        floors: i === 0 ? 2 : 4,
      });
  });
  const target = id === "plaza" ? "P02" : id === "mixed" ? "P03" : "P06";
  d.execute("place-item", { type: "tree", parcelId: target, slot: 2 });
  d.execute("place-item", { type: "bench", parcelId: target, slot: 4 });
  d.settings.route = [
    { x: -24, z: -9.2 },
    { x: 0, z: 9.2 },
    { x: 24, z: 9.2 },
  ];
  return d.assertReady();
}
