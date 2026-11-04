import { cleanConfig } from "./records.js";
import { generateNeighborhood, validateUrban } from "./urban.js";
import {
  initialSitePlan,
  normalizeSitePlan,
  WORKSHOP_PLAN_VERSION,
} from "./site-plan.js";
import { PROFILES } from "./catalog.js";
import { normalizeControls } from "./route.js";

// The draft owns all mutations. An invalid command never changes history or IDs.
export class EditorState {
  constructor(config) {
    this.base = cleanConfig({
      ...config,
      mode: "neighborhood",
      environment: "physical",
    });
    this.plan =
      this.base.sitePlan ??
      initialSitePlan(this.base, generateNeighborhood(this.base));
    this.plan = {
      ...structuredClone(this.plan),
      version: WORKSHOP_PLAN_VERSION,
      items: structuredClone(this.plan.items ?? []),
    };
    this.settings = {
      route: structuredClone(this.base.route),
      travelSpeed: this.base.travelSpeed,
      duration: this.base.duration,
      wind: this.base.wind,
      lesson: this.base.lesson,
    };
    this.past = [];
    this.future = [];
  }
  get config() {
    return cleanConfig({
      ...this.base,
      ...this.settings,
      route: this.settings.route?.length === 1 ? null : this.settings.route,
      sitePlan: this.plan,
    });
  }
  get layout() {
    return generateNeighborhood(this.config);
  }
  at(parcelId) {
    return this.plan.objects.find((o) => o.parcelId === parcelId);
  }
  find(id) {
    return (
      this.plan.objects.find((o) => o.id === id) ??
      this.plan.items.find((i) => i.id === id)
    );
  }
  assertReady() {
    if (this.settings.route?.length === 1)
      throw new Error(
        "Añade al menos otro punto al recorrido o bórralo antes de guardar.",
      );
    return this.config;
  }
  snapshot() {
    return structuredClone({
      base: this.base,
      plan: this.plan,
      settings: this.settings,
    });
  }
  restore(snapshot) {
    this.base = snapshot.base;
    this.plan = snapshot.plan;
    this.settings = snapshot.settings;
  }
  loadExample(config) {
    const candidate = new EditorState(config);
    this.past.push(this.snapshot());
    if (this.past.length > 80) this.past.shift();
    this.base = candidate.base;
    this.plan = candidate.plan;
    this.settings = candidate.settings;
    this.future = [];
  }
  execute(action, args = {}) {
    let base = this.base;
    const next = structuredClone(this.plan),
      settings = structuredClone(this.settings),
      source =
        next.objects.find((o) => o.id === args.id) ??
        next.items.find((i) => i.id === args.id);
    const requireSource = () => {
      if (!source) throw new Error("Selecciona una infraestructura.");
    };
    const requireEmpty = (parcelId) => {
      if (next.objects.some((o) => o.parcelId === parcelId))
        throw new Error(
          "Parcela ocupada. Elige una parcela libre; el objeto anterior se conserva.",
        );
    };
    const allocate = () => `O${String(next.nextId++).padStart(6, "0")}`;
    if (action === "resize-grid") {
      const { rows, columns } = args;
      if (rows === base.rows && columns === base.columns) return false;
      base = { ...base, rows, columns };
      validateUrban(base);
      next.grid = { ...next.grid, rows, columns };
      for (const object of [...next.objects, ...next.items]) {
        const index = Number(object.parcelId.slice(1)) - 1;
        const row = Math.floor(index / this.base.columns);
        const column = index % this.base.columns;
        if (row >= rows || column >= columns)
          throw new Error(
            "Mueve los objetos de las filas o columnas que quieres quitar.",
          );
        object.parcelId = `P${String(row * columns + column + 1).padStart(2, "0")}`;
      }
      if (settings.route) {
        // Resizing adds or removes parcels on the east and south edges.
        // The grid is centered, so shift the route with the retained parcels.
        const { pitch } = this.layout;
        const dx = (this.base.columns - columns) * pitch / 2;
        const dz = (this.base.rows - rows) * pitch / 2;
        settings.route = settings.route.map(({ x, z }) => ({
          x: x + dx,
          z: z + dz,
        }));
      }
    } else if (action === "route-point") {
      settings.route = [...(settings.route ?? []), { x: args.x, z: args.z }];
    } else if (action === "route-remove") {
      settings.route = settings.route?.slice(0, -1) ?? null;
      if (!settings.route?.length) settings.route = null;
    } else if (action === "route-clear") settings.route = null;
    else if (action === "weather") {
      for (const key of ["wind", "travelSpeed", "duration"])
        if (Object.hasOwn(args, key)) settings[key] = args[key];
    } else if (action === "place-item") {
      next.items.push({
        id: allocate(),
        parcelId: args.parcelId,
        type: args.type,
        slot: args.slot,
        rotation: 0,
        ...(args.type === "tree" ? { anchorage: "standard" } : {}),
      });
    } else if (action === "place") {
      requireEmpty(args.parcelId);
      const type = args.type;
      next.objects.push({
        id: allocate(),
        parcelId: args.parcelId,
        type,
        rotation: 0,
        ...(type === "house"
          ? {
              profile: this.base.profile,
              roof: PROFILES[this.base.profile].roofs.includes(this.base.roof)
                ? this.base.roof
                : PROFILES[this.base.profile].defaultRoof,
            }
          : {}),
        ...(type === "building" ? { floors: this.base.buildingFloors } : {}),
      });
    } else if (action === "move" || action === "duplicate") {
      requireSource();
      const isItem = next.items.includes(source);
      if (
        action === "move" &&
        source.parcelId === args.parcelId &&
        (!isItem || source.slot === args.slot)
      )
        return false;
      if (!isItem) requireEmpty(args.parcelId);
      if (action === "move") {
        source.parcelId = args.parcelId;
        if (isItem) source.slot = args.slot;
      } else
        (isItem ? next.items : next.objects).push({
          ...source,
          id: allocate(),
          parcelId: args.parcelId,
          ...(isItem ? { slot: args.slot } : {}),
        });
    } else if (action === "remove") {
      requireSource();
      next.objects = next.objects.filter((o) => o.id !== source.id);
      next.items = next.items.filter((i) => i.id !== source.id);
    } else if (action === "rotate") {
      requireSource();
      source.rotation = (source.rotation + 90) % 360;
    } else if (action === "properties") {
      requireSource();
      for (const key of ["profile", "roof", "floors", "rotation", "anchorage"])
        if (Object.hasOwn(args, key)) source[key] = args[key];
    } else throw new Error("Acción de edición desconocida.");
    const valid = normalizeSitePlan(next, base);
    normalizeControls({ ...base, ...settings }, true);
    cleanConfig({
      ...base,
      ...settings,
      route: settings.route?.length === 1 ? null : settings.route,
      sitePlan: valid,
    });
    if (
      JSON.stringify(valid) === JSON.stringify(this.plan) &&
      JSON.stringify(settings) === JSON.stringify(this.settings)
    )
      return false;
    this.past.push(this.snapshot());
    if (this.past.length > 80) this.past.shift();
    this.base = base;
    this.plan = valid;
    this.settings = settings;
    this.future = [];
    return true;
  }
  undo() {
    if (!this.past.length) return false;
    this.future.push(this.snapshot());
    this.restore(this.past.pop());
    return true;
  }
  redo() {
    if (!this.future.length) return false;
    this.past.push(this.snapshot());
    this.restore(this.future.pop());
    return true;
  }
}
