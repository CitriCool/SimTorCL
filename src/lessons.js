import { EditorState } from "./editor-state.js";

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
};
export function lessonConfig(id) {
  if (!Object.hasOwn(LESSONS, id))
    throw new Error("Ejemplo guiado desconocido.");
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
