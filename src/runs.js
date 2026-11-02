import { Experiment } from "./district.js";

import { FIXED_STEP } from "./physics.js";

import { cleanConfig } from "./records.js";

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
      "distribution",
      "spacing",
      "roof",
      "trajectory",
    ].includes(key)
  )
    throw new Error("Condición no comparable.");

  const first = cleanConfig(config),
    second = cleanConfig({ ...config, [key]: value });

  for (const [label, settings] of [
    ["A", first],
    ["B", second],
  ]) {
    const e = new Experiment(settings, { record: false });
    for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) e.step();

    yield { label, config: settings, stats: e.stats };
  }
}
