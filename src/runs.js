import { Experiment } from "./district.js";

import { FIXED_STEP } from "./physics.js";

import { cleanConfig } from "./records.js";

export function countHomesWithRoofLoss(stats) {
  return (stats.rows ?? [stats]).filter((home) => home.detached > 0).length;
}

export function recalculate(record, onProgress = () => {}) {
  const experiment = new Experiment(record.initial, { record: false });
  let change = 0;

  for (let step = 0; step < record.steps; step++) {
    while (record.changes[change]?.step === step) {
      const c = record.changes[change++];
      experiment.setParameter(c.key, c.value);
    }

    experiment.step();
    if (step % 120 === 0) onProgress(step / Math.max(1, record.steps));
  }

  return experiment.stats;
}

export function* compareScenarios(config, key, value, seconds = 20) {
  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 60)
    throw new Error("Duración de comparación inválida.");

  if (
    ![
      "reinforcement",
      "wind",
      "distribution",
      "spacing",
      "roof",
      "trajectory",
      "lotSize",
      "orientation",
    ].includes(key)
  )
    throw new Error("Condición no comparable.");

  const first = cleanConfig(config),
    second = cleanConfig({
      ...config,
      [key]: value,
      ...(key === "trajectory" ? { route: null } : {}),
    });
  if (first.sitePlan && ["distribution", "roof", "lotSize"].includes(key))
    throw new Error(
      "El plano manual conserva las propiedades de cada objeto. Compara refuerzo, recorrido u orientación; para cambiar objetos utiliza el editor.",
    );
  if (first.mode === "neighborhood" && key === "spacing")
    throw new Error(
      "El barrio usa lado de parcela, veredas y ancho de calle para definir las separaciones.",
    );
  if (first.mode !== "neighborhood" && ["lotSize", "orientation"].includes(key))
    throw new Error("Esta condición requiere un barrio configurable.");

  for (const [label, settings] of [
    ["A", first],
    ["B", second],
  ]) {
    const e = new Experiment(settings, { record: false });
    for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) e.step();

    yield { label, config: settings, stats: e.stats };
  }
}
