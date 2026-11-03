import { PROFILES, ROOFS } from "./catalog.js";

export const SITE_PLAN_VERSION = "parcel-editor-1";
export const WORKSHOP_PLAN_VERSION = "parcel-editor-2";
export function featurePosition(item, parcel) {
  return {
    x: parcel.x + ((item.slot % 3) - 1) * parcel.size * 0.3,
    z: parcel.z + (Math.floor(item.slot / 3) - 1) * parcel.size * 0.3,
  };
}
const footprint = (type, x, z) => ({
  x,
  z,
  hx: type === "tree" ? 1.8 : 1,
  hz: type === "tree" ? 1.8 : 0.7,
});
const overlaps = (a, b) =>
  Math.abs(a.x - b.x) < a.hx + b.hx - 1e-6 &&
  Math.abs(a.z - b.z) < a.hz + b.hz - 1e-6;
const gridKeys = ["rows", "columns", "lotSize", "roadWidth"];
const gridOf = (config) =>
  Object.fromEntries(gridKeys.map((k) => [k, config[k]]));
const fail = (message) => {
  throw new Error(message);
};

export function normalizeSitePlan(input, config) {
  if (input == null) return null;
  if (config.mode !== "neighborhood")
    fail("El plano manual requiere el modo barrio.");
  if (config.environment !== "physical")
    fail("El plano manual requiere el entorno físico.");
  if (
    !input ||
    ![SITE_PLAN_VERSION, WORKSHOP_PLAN_VERSION].includes(input.version) ||
    !Array.isArray(input.objects) ||
    input.objects.length > config.rows * config.columns
  )
    fail("Plano manual no compatible o demasiado grande.");
  if (!input.grid || gridKeys.some((k) => input.grid[k] !== config[k]))
    fail(
      "El plano manual pertenece a otra cuadrícula. Regenera el barrio para cambiar sus dimensiones.",
    );
  if (
    !Number.isInteger(input.nextId) ||
    input.nextId < 1 ||
    input.nextId > 1000000
  )
    fail("Secuencia de objetos inválida.");
  const ids = new Set(),
    parcels = new Set();
  const objects = input.objects
    .map((obj) => {
      if (
        !obj ||
        !/^O\d{6}$/.test(obj.id) ||
        Number(obj.id.slice(1)) < 1 ||
        Number(obj.id.slice(1)) >= input.nextId ||
        ids.has(obj.id)
      )
        fail("Identidad de objeto inválida o repetida.");
      const slot = Number(String(obj.parcelId).slice(1));
      if (
        !/^P\d{2}$/.test(obj.parcelId) ||
        slot < 1 ||
        slot > config.rows * config.columns ||
        parcels.has(obj.parcelId)
      )
        fail(
          "Solo puede haber una infraestructura por parcela y debe quedar dentro de la cuadrícula.",
        );
      if (
        !["house", "building", "green"].includes(obj.type) ||
        ![0, 90, 180, 270].includes(obj.rotation)
      )
        fail("Tipo u orientación de infraestructura inválidos.");
      const allowed = ["id", "parcelId", "type", "rotation"];
      const next = {
        id: obj.id,
        parcelId: obj.parcelId,
        type: obj.type,
        rotation: obj.rotation,
      };
      if (obj.type === "house") {
        const p = Object.hasOwn(PROFILES, obj.profile)
          ? PROFILES[obj.profile]
          : null;
        if (
          !p ||
          !Object.hasOwn(ROOFS, obj.roof) ||
          !p.roofs.includes(obj.roof)
        )
          fail("La cubierta no es compatible con el perfil de esta casa.");
        next.profile = obj.profile;
        next.roof = obj.roof;
        allowed.push("profile", "roof");
      }
      if (obj.type === "building") {
        if (!Number.isInteger(obj.floors) || obj.floors < 2 || obj.floors > 5)
          fail("El edificio admite entre 2 y 5 pisos.");
        next.floors = obj.floors;
        allowed.push("floors");
      }
      if (Object.keys(obj).some((k) => !allowed.includes(k)))
        fail("El objeto contiene propiedades no compatibles.");
      ids.add(obj.id);
      parcels.add(obj.parcelId);
      return next;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const result = {
    version: input.version,
    grid: gridOf(config),
    nextId: input.nextId,
    objects,
  };
  if (input.version === WORKSHOP_PLAN_VERSION) {
    if (!Array.isArray(input.items) || input.items.length > 48)
      fail("Se admiten hasta 48 árboles y bancas independientes.");
    const occupied = new Map();
    for (const obj of objects) {
      const list = [];
      if (obj.type === "green")
        for (const sign of [-1, 1]) {
          // Conservative footprints of the park's built-in trees and benches.
          const yaw = (obj.rotation * Math.PI) / 180;
          const turn = (x, z) => ({
            x: Math.cos(yaw) * x + Math.sin(yaw) * z,
            z: -Math.sin(yaw) * x + Math.cos(yaw) * z,
          });
          const t = turn(
            sign * config.lotSize * 0.28,
            sign * config.lotSize * 0.27,
          );
          const b = turn(sign * 2.5, sign * 1.5);
          const bank = footprint("bench", b.x, b.z);
          if (obj.rotation % 180) [bank.hx, bank.hz] = [bank.hz, bank.hx];
          list.push(footprint("tree", t.x, t.z), bank);
        }
      occupied.set(obj.parcelId, { type: obj.type, list });
    }
    const slots = new Set();
    result.items = input.items
      .map((item) => {
        if (
          !item ||
          typeof item.id !== "string" ||
          !/^O\d{6}$/.test(item.id) ||
          Number(item.id.slice(1)) < 1 ||
          Number(item.id.slice(1)) >= input.nextId ||
          ids.has(item.id)
        )
          fail("Identidad de elemento inválida o repetida.");
        const index = Number(String(item.parcelId).slice(1));
        if (
          !/^P\d{2}$/.test(item.parcelId) ||
          index < 1 ||
          index > config.rows * config.columns ||
          !["tree", "bench"].includes(item.type) ||
          !Number.isInteger(item.slot) ||
          item.slot < 0 ||
          item.slot > 8 ||
          ![0, 90, 180, 270].includes(item.rotation)
        )
          fail("Ubicación o tipo de elemento independiente inválido.");
        const allowed = [
          "id",
          "parcelId",
          "type",
          "slot",
          "rotation",
          ...(item.type === "tree" ? ["anchorage"] : []),
        ];
        if (
          Object.keys(item).some((k) => !allowed.includes(k)) ||
          (item.type === "tree" &&
            !["standard", "weak"].includes(item.anchorage))
        )
          fail("Propiedades del árbol o banca no compatibles.");
        const key = `${item.parcelId}:${item.slot}`,
          parcel = occupied.get(item.parcelId) ?? { type: "vacant", list: [] };
        if (["house", "building"].includes(parcel.type))
          fail("Los árboles y bancas requieren una parcela libre o un parque.");
        if (slots.has(key)) fail("Ese punto de la parcela ya está ocupado.");
        const pos = featurePosition(item, { x: 0, z: 0, size: config.lotSize });
        const box = footprint(item.type, pos.x, pos.z);
        if (item.type === "bench" && item.rotation % 180)
          [box.hx, box.hz] = [box.hz, box.hx];
        if (parcel.list.some((other) => overlaps(box, other)))
          fail(
            "Ese punto se superpone con un árbol o una banca. Elige otro punto.",
          );
        parcel.list.push(box);
        occupied.set(item.parcelId, parcel);
        slots.add(key);
        ids.add(item.id);
        return {
          id: item.id,
          parcelId: item.parcelId,
          type: item.type,
          slot: item.slot,
          rotation: item.rotation,
          ...(item.type === "tree" ? { anchorage: item.anchorage } : {}),
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  return result;
}

export function initialSitePlan(config, layout) {
  const profiles = Object.keys(PROFILES),
    base = profiles.indexOf(config.profile);
  let nextId = 1;
  const objects = layout.parcels
    .filter((p) => p.type !== "vacant")
    .map((p) => {
      const obj = {
        id: `O${String(nextId++).padStart(6, "0")}`,
        parcelId: p.id,
        type: p.type,
        rotation: p.type === "house" && p.row % 2 ? 180 : 0,
      };
      if (p.type === "house") {
        obj.profile =
          config.distribution === "mixed"
            ? profiles[(base + p.profileOffset) % profiles.length]
            : config.profile;
        obj.roof = config.roof;
      }
      if (p.type === "building") obj.floors = config.buildingFloors;
      return obj;
    });
  return normalizeSitePlan(
    { version: SITE_PLAN_VERSION, grid: gridOf(config), nextId, objects },
    config,
  );
}

export function applySitePlan(layout, plan) {
  const byParcel = new Map(plan.objects.map((obj) => [obj.parcelId, obj]));
  const parcels = layout.parcels.map((p) => {
    const obj = byParcel.get(p.id);
    return obj
      ? {
          ...p,
          type: obj.type,
          objectId: obj.id,
          objectRotation: obj.rotation,
          houseYaw: layout.yaw + (obj.rotation * Math.PI) / 180,
          ...(obj.type === "house"
            ? { houseProfile: obj.profile, houseRoof: obj.roof }
            : {}),
          ...(obj.type === "building" ? { buildingFloors: obj.floors } : {}),
        }
      : { ...p, type: "vacant" };
  });
  const counts = Object.fromEntries(
    ["house", "green", "building", "vacant"].map((type) => [
      type,
      parcels.filter((p) => p.type === type).length,
    ]),
  );
  return {
    ...layout,
    version:
      plan.version === WORKSHOP_PLAN_VERSION
        ? "urban-editor-v2"
        : "urban-editor-v1",
    source: "manual",
    parcels,
    counts,
    areas: { ...layout.areas, green: counts.green * plan.grid.lotSize ** 2 },
    ...(plan.version === WORKSHOP_PLAN_VERSION
      ? {
          features: structuredClone(plan.items),
          itemCounts: {
            tree: plan.items.filter((i) => i.type === "tree").length,
            bench: plan.items.filter((i) => i.type === "bench").length,
          },
        }
      : {}),
  };
}
