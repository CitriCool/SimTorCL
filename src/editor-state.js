import { cleanConfig } from "./records.js";
import { generateNeighborhood } from "./urban.js";
import { initialSitePlan, normalizeSitePlan } from "./site-plan.js";
import { PROFILES } from "./catalog.js";

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
    this.past = [];
    this.future = [];
  }
  get config() {
    return cleanConfig({ ...this.base, sitePlan: this.plan });
  }
  get layout() {
    return generateNeighborhood(this.config);
  }
  at(parcelId) {
    return this.plan.objects.find((o) => o.parcelId === parcelId);
  }
  execute(action, args = {}) {
    const next = structuredClone(this.plan),
      source = next.objects.find((o) => o.id === args.id);
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
    if (action === "place") {
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
      if (action === "move" && source.parcelId === args.parcelId) return false;
      requireEmpty(args.parcelId);
      if (action === "move") source.parcelId = args.parcelId;
      else
        next.objects.push({
          ...source,
          id: allocate(),
          parcelId: args.parcelId,
        });
    } else if (action === "remove") {
      requireSource();
      next.objects = next.objects.filter((o) => o.id !== source.id);
    } else if (action === "rotate") {
      requireSource();
      source.rotation = (source.rotation + 90) % 360;
    } else if (action === "properties") {
      requireSource();
      for (const key of ["profile", "roof", "floors", "rotation"])
        if (Object.hasOwn(args, key)) source[key] = args[key];
    } else throw new Error("Acción de edición desconocida.");
    const valid = normalizeSitePlan(next, this.base);
    if (JSON.stringify(valid) === JSON.stringify(this.plan)) return false;
    this.past.push(structuredClone(this.plan));
    if (this.past.length > 80) this.past.shift();
    this.plan = valid;
    this.future = [];
    return true;
  }
  undo() {
    if (!this.past.length) return false;
    this.future.push(this.plan);
    this.plan = this.past.pop();
    return true;
  }
  redo() {
    if (!this.future.length) return false;
    this.past.push(this.plan);
    this.plan = this.future.pop();
    return true;
  }
}
