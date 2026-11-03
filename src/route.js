import { URBAN_RULES, rotatePoint } from "./urban.js";

export function normalizeControls(config, allowSingle = false) {
  if (
    !Number.isFinite(config.travelSpeed) ||
    config.travelSpeed < 0.5 ||
    config.travelSpeed > 8
  )
    throw new Error("La velocidad de avance debe estar entre 0,5 y 8 m/s.");
  if (config.mode === "single" && config.travelSpeed !== 2)
    throw new Error(
      "La velocidad de avance se configura en escenarios urbanos; la casa individual conserva su órbita.",
    );
  if (
    config.duration !== null &&
    (!Number.isInteger(config.duration) ||
      config.duration < 5 ||
      config.duration > 180)
  )
    throw new Error(
      "La duración debe ser un entero entre 5 y 180 s, o sin límite.",
    );
  if (config.route === null) return null;
  if (
    config.mode !== "neighborhood" ||
    !Array.isArray(config.route) ||
    config.route.length < (allowSingle ? 1 : 2) ||
    config.route.length > 24
  )
    throw new Error(
      "El recorrido dibujado requiere un barrio y entre 2 y 24 puntos.",
    );
  const pitch = config.lotSize + 2 * URBAN_RULES.sidewalk + config.roadWidth;
  const halfX = (config.columns * pitch + config.roadWidth) / 2 + 6;
  const halfZ = (config.rows * pitch + config.roadWidth) / 2 + 6;
  return config.route.map((p, i) => {
    if (
      !p ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.z) ||
      Math.abs(p.x) > halfX ||
      Math.abs(p.z) > halfZ ||
      Object.keys(p).some((k) => !["x", "z"].includes(k))
    )
      throw new Error(
        "El recorrido debe quedar dentro del barrio y su margen de 6 m.",
      );
    if (
      i &&
      Math.hypot(p.x - config.route[i - 1].x, p.z - config.route[i - 1].z) < 0.5
    )
      throw new Error("Separa los puntos consecutivos al menos 0,5 m.");
    return { x: p.x, z: p.z };
  });
}
export function controlModel(config) {
  return config.route || config.travelSpeed !== 2 || config.duration !== null
    ? {
        version: "scenario-controls-1",
        routeVersion: "polyline-1",
        speedUnit: "m/s",
        durationUnit: "s",
        coordinateUnit: "m",
        scope:
          "Los recorridos urbanos son lineales o poligonales; los puntos dibujados usan coordenadas locales del barrio. Avance constante por longitud recorrida y parada al final. La casa individual conserva su órbita. La física termina al cumplir la duración; sin duración continúa calculando. Campo de viento educativo sin modificación por obstáculos.",
      }
    : null;
}
export function routePoints(config, layout) {
  return (
    config.route?.map((p) => {
      const q = rotatePoint(p.x, p.z, layout.yaw);
      return [q.x, q.z];
    }) ?? null
  );
}
export function alongRoute(points, distance) {
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0),
    travelled = Math.min(total, Math.max(0, distance));
  let remaining = travelled;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const fraction = lengths[i] ? remaining / lengths[i] : 0;
      return {
        x: points[i][0] + (points[i + 1][0] - points[i][0]) * fraction,
        z: points[i][1] + (points[i + 1][1] - points[i][1]) * fraction,
        progress: total ? travelled / total : 1,
        length: total,
      };
    }
    remaining -= lengths[i];
  }
}
