import { Simulation, FIXED_STEP } from "./physics.js";
import { PROFILES, ROOFS, validateConfig } from "./catalog.js";
export function* compareProfiles(config, seconds = 20) {
  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 60)
    throw new RangeError("La duración debe ser un entero de 5 a 60 segundos.");
  if (!Object.hasOwn(ROOFS, config.roof))
    throw new RangeError("Cubierta desconocida.");
  for (const profile of Object.values(PROFILES)) {
    if (!profile.roofs.includes(config.roof)) {
      yield { profile: profile.id, unavailable: true };
      continue;
    }
    const runConfig = validateConfig({ ...config, profile: profile.id });
    const simulation = new Simulation(runConfig);
    for (let step = 0; step < Math.round(seconds / FIXED_STEP); step++)
      simulation.step();
    yield {
      profile: profile.id,
      config: runConfig,
      seconds,
      stats: simulation.stats,
    };
  }
}
