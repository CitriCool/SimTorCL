// Synthetic planning geometry. Reservations and landscaping have no damage model.
export const URBAN_VERSION = "urban-grid-v1";
export const URBAN_DEFAULTS = Object.freeze({
  rows: 3,
  columns: 4,
  lotSize: 16,
  roadWidth: 6,
  orientation: 0,
  seed: 2024,
  density: 100,
  greenPercent: 25,
  buildingPercent: 15,
});
export const URBAN_RULES = Object.freeze({
  sidewalk: 1.2,
  houseFootprint: 7.4,
  reserveFootprint: 8,
  maxLots: 16,
});
export const PARCEL_TYPES = Object.freeze({
  house: "Vivienda",
  green: "Área verde",
  building: "Reserva para edificio",
  vacant: "Parcela libre",
});

export function validateUrban(config) {
  for (const key of ["rows", "columns"])
    if (!Number.isInteger(config[key]) || config[key] < 2 || config[key] > 4)
      throw new RangeError("El barrio admite de 2 a 4 filas y columnas.");
  if (
    ![12, 16, 20].includes(config.lotSize) ||
    ![4, 6, 8].includes(config.roadWidth) ||
    !Number.isInteger(config.orientation) ||
    config.orientation < 0 ||
    config.orientation > 315 ||
    config.orientation % 45
  )
    throw new RangeError("Dimensiones u orientación de barrio inválidas.");
  if (
    !Number.isInteger(config.seed) ||
    config.seed < 0 ||
    config.seed > 4294967295
  )
    throw new RangeError("La semilla debe ser un entero entre 0 y 4294967295.");
  for (const [key, min, max] of [
    ["density", 25, 100],
    ["greenPercent", 0, 50],
    ["buildingPercent", 0, 50],
  ])
    if (
      !Number.isInteger(config[key]) ||
      config[key] < min ||
      config[key] > max
    )
      throw new RangeError("Proporciones de parcelas fuera de rango.");
  if (config.greenPercent + config.buildingPercent > 75)
    throw new RangeError(
      "Áreas verdes y reservas pueden ocupar hasta el 75 % de las parcelas.",
    );
}

function generator(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
const round = (n) => Math.round(n * 1e6) / 1e6;
export function rotatePoint(x, z, yaw) {
  return {
    x: round(Math.cos(yaw) * x + Math.sin(yaw) * z),
    z: round(-Math.sin(yaw) * x + Math.cos(yaw) * z),
  };
}

export function generateNeighborhood(input) {
  const c = { ...URBAN_DEFAULTS, ...input };
  validateUrban(c);
  const n = c.rows * c.columns,
    rng = generator(c.seed),
    order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const green = Math.floor((n * c.greenPercent) / 100),
    building = Math.floor((n * c.buildingPercent) / 100),
    residential = n - green - building;
  const houses = Math.max(1, Math.ceil((residential * c.density) / 100));
  const types = Array(n).fill("vacant");
  order.forEach((slot, i) => {
    types[slot] =
      i < green
        ? "green"
        : i < green + building
          ? "building"
          : i < green + building + houses
            ? "house"
            : "vacant";
  });
  const pitch = c.lotSize + 2 * URBAN_RULES.sidewalk + c.roadWidth,
    yaw = (c.orientation * Math.PI) / 180;
  const width = c.columns * pitch + c.roadWidth,
    depth = c.rows * pitch + c.roadWidth;
  const parcels = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / c.columns),
      column = i % c.columns,
      x = (column - (c.columns - 1) / 2) * pitch,
      z = (row - (c.rows - 1) / 2) * pitch;
    return {
      id: `P${String(i + 1).padStart(2, "0")}`,
      row,
      column,
      type: types[i],
      x,
      z,
      ...{ world: rotatePoint(x, z, yaw) },
      yaw,
      houseYaw: yaw + (row % 2 ? Math.PI : 0),
      size: c.lotSize,
      area: c.lotSize ** 2,
      profileOffset: Math.floor(rng() * 4),
    };
  });
  const roads = [];
  for (let i = 0; i <= c.columns; i++)
    roads.push({
      id: `V${i + 1}`,
      x: (i - c.columns / 2) * pitch,
      z: 0,
      width: c.roadWidth,
      depth,
    });
  for (let i = 0; i <= c.rows; i++)
    roads.push({
      id: `H${i + 1}`,
      x: 0,
      z: (i - c.rows / 2) * pitch,
      width,
      depth: c.roadWidth,
    });
  return {
    version: URBAN_VERSION,
    seed: c.seed,
    yaw,
    width,
    depth,
    pitch,
    sidewalk: URBAN_RULES.sidewalk,
    parcels,
    roads,
    bounds: {
      width: round(
        Math.abs(Math.cos(yaw)) * width + Math.abs(Math.sin(yaw)) * depth,
      ),
      depth: round(
        Math.abs(Math.sin(yaw)) * width + Math.abs(Math.cos(yaw)) * depth,
      ),
    },
    counts: {
      house: houses,
      green,
      building,
      vacant: n - green - building - houses,
    },
    areas: {
      total: width * depth,
      parcels: n * c.lotSize ** 2,
      green: green * c.lotSize ** 2,
    },
  };
}

export function housePlacements(config, layout = null) {
  if (config.mode === "single")
    return [{ x: 0, z: 0, yaw: 0, profileOffset: 0 }];
  if (config.mode === "neighborhood")
    return (layout ?? generateNeighborhood(config)).parcels
      .filter((p) => p.type === "house")
      .map((p) => ({
        x: p.world.x,
        z: p.world.z,
        yaw: p.houseYaw,
        parcelId: p.id,
        profileOffset: p.profileOffset,
      }));
  const side = config.mode === "block9" ? 3 : 4;
  return Array.from({ length: side * side }, (_, i) => ({
    x: ((i % side) - (side - 1) / 2) * config.spacing,
    z: (Math.floor(i / side) - (side - 1) / 2) * config.spacing,
    yaw: Math.floor(i / side) % 2 ? Math.PI : 0,
    profileOffset: i % 4,
  }));
}
