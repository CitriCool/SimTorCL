import * as CANNON from "cannon-es";
import { windAt, FIXED_STEP, RULES } from "./physics.js";
import { rotatePoint } from "./urban.js";

export const ENV_LABELS = {
  trunk: "Tronco",
  branch: "Rama",
  crown: "Copa",
  bench: "Bastidor de banco",
  seat: "Asiento",
  back: "Respaldo",
  core: "Estructura fija",
  facade: "Fachada de edificio",
  window: "Ventana de edificio",
  terrace: "Cubierta de edificio",
};
export const ENV_MODEL = {
  version: "urban-environment-1",
  evidence: "illustrative",
  scope:
    "Árboles y bancos con anclajes y uniones rompibles. Edificios con estructura y losas fijas, envolvente desprendible. Sin daño de suelo, daño adicional por contacto ni modificación aerodinámica del campo.",
  sources: [
    {
      id: "ine",
      institution: "INE",
      title: "Glosario de viviendas, Censo 2024",
      url: "https://censo2024.ine.gob.cl/wp-content/uploads/2025/05/Glosario_viviendas_y_servicios-basicos_CPV2024.pdf",
      section: "Tipos de vivienda y materialidad",
      use: "Clasificación de vivienda y materiales; no resistencia mecánica",
      status: "Referencia tipológica",
    },
    {
      id: "minvu",
      institution: "MINVU · DITEC",
      title: "Manuales técnicos: espacio público, diseño y materiales",
      url: "https://www.minvu.gob.cl/ditec/manuales-tecnicos-ditec/",
      section: "Espacio público; diseño, ingeniería y materiales",
      use: "Índice oficial de documentos para parques, arbolado y construcción; no aporta los coeficientes de esta calibración",
      status: "Índice consultado; extracción de propiedades pendiente",
    },
    {
      id: "infor",
      institution: "INFOR / aportes CONAF",
      title: "Técnicas de Planificación y Manejo del Arbolado Urbano",
      url: "https://bibliotecadigital.infor.cl/bitstream/handle/20.500.12220/13191/13191.pdf?sequence=1",
      section: "Evaluación de riesgos en los árboles",
      use: "Referencia de riesgo de caída; no umbrales universales ni capacidades por especie",
      status: "Referencia localizada; calibración mecánica pendiente",
    },
  ],
  parameters: {
    treeHeight: { value: 3.8, unit: "m" },
    woodDensity: { value: 550, unit: "kg/m³" },
    treeAnchor: { value: 4000, unit: "N·m" },
    treeWeakAnchor: { value: 1200, unit: "N·m" },
    branchJoint: { value: 500, unit: "N·m" },
    crownJoint: { value: 1600, unit: "N" },
    benchAnchor: { value: 280, unit: "N·m" },
    benchJoint: { value: 800, unit: "N" },
    storeyHeight: { value: 3, unit: "m" },
    buildingWidth: { value: 8, unit: "m" },
    concreteDensity: { value: 2500, unit: "kg/m³" },
    facadeMass: { value: 35, unit: "kg/m²" },
    windowMass: { value: 20, unit: "kg/m²" },
    facadeFixing: { value: 750, unit: "N/m²" },
    windowFixing: { value: 450, unit: "N/m²" },
    roofFixing: { value: 500, unit: "N/m²" },
  },
};
for (const p of Object.values(ENV_MODEL.parameters)) {
  p.evidence = "illustrative";
  p.sourceIds = [];
  p.status = "Supuesto educativo; calibración pendiente";
}
// All mechanical values above are educational calibration, not extracted from the references.
const V = Object.fromEntries(
  Object.entries(ENV_MODEL.parameters).map(([k, p]) => [k, p.value]),
);
export function environmentBlueprint(config, layout) {
  if (
    config.mode !== "neighborhood" ||
    config.environment !== "physical" ||
    !layout
  )
    return { entities: [], pieces: [] };
  const entities = [],
    pieces = [];
  function entity(id, type, p) {
    const e = { id, type, parcelId: p.id, pieces: [] };
    entities.push(e);
    return e;
  }
  function part(
    e,
    p,
    kind,
    size,
    pos,
    mass,
    area,
    parent = null,
    capacity = null,
    unit = "N",
    shape = "box",
    rotation = [0, 0, 0],
  ) {
    const objectYaw = ((p.objectRotation ?? 0) * Math.PI) / 180;
    const turned = objectYaw
      ? rotatePoint(pos[0] - p.x, pos[2] - p.z, objectYaw)
      : null;
    const local = rotatePoint(
        turned ? p.x + turned.x : pos[0],
        turned ? p.z + turned.z : pos[2],
        layout.yaw,
      ),
      def = {
        id: pieces.length,
        entityId: e.id,
        ...(p.objectId ? { objectId: p.objectId } : {}),
        entityType: e.type,
        parcelId: p.id,
        kind,
        size,
        position: [local.x, pos[1], local.z],
        rotation: [...rotation],
        yaw: layout.yaw + objectYaw,
        mass,
        area,
        parentId: parent?.id ?? null,
        capacity,
        unit,
        shape,
        material:
          e.type === "tree"
            ? "Madera / copa ilustrativa"
            : e.type === "bench"
              ? "Madera y anclaje ilustrativo"
              : kind === "core"
                ? "Hormigón, idealización fija"
                : kind === "window"
                  ? "Vidrio ilustrativo"
                  : "Panel ligero ilustrativo",
      };
    pieces.push(def);
    e.pieces.push(def.id);
    return def;
  }
  for (const p of layout.parcels) {
    if (p.type === "green")
      for (const [i, sign] of [-1, 1].entries()) {
        const e = entity(`V-${p.objectId ?? p.id}-T${i + 1}`, "tree", p),
          x = p.x + sign * p.size * 0.28,
          z = p.z + sign * p.size * 0.27;
        const trunk = part(
          e,
          p,
          "trunk",
          [0.32, 2.6, 0.32],
          [x, 1.3, z],
          Math.PI * 0.16 ** 2 * 2.6 * V.woodDensity,
          0.32 * 2.6,
          null,
          i === 0 ? V.treeAnchor : V.treeWeakAnchor,
          "N·m",
          "cylinder",
        );
        for (const side of [-1, 1]) {
          const branch = part(
            e,
            p,
            "branch",
            [0.13, 1.2, 0.13],
            [x + side * 0.55, 2.6, z],
            Math.PI * 0.065 ** 2 * 1.2 * V.woodDensity,
            0.13 * 1.2,
            trunk,
            V.branchJoint,
            "N·m",
            "cylinder",
            [0, 0, side * -0.8],
          );
          part(
            e,
            p,
            "crown",
            [1.5, 1.6, 1.5],
            [x + side * 1.0, 3, z],
            24,
            1.8,
            branch,
            V.crownJoint,
            "N",
            "crown",
          );
        }
        const b = entity(`M-${p.objectId ?? p.id}-B${i + 1}`, "bench", p),
          bx = p.x + sign * 2.5,
          bz = p.z + sign * 1.5;
        const frame = part(
          b,
          p,
          "bench",
          [1.6, 0.65, 0.45],
          [bx, 0.325, bz],
          22,
          1.6 * 0.35,
          null,
          V.benchAnchor,
          "N·m",
        );
        part(
          b,
          p,
          "seat",
          [1.8, 0.14, 0.55],
          [bx, 0.72, bz],
          12,
          1.8 * 0.55,
          frame,
          V.benchJoint,
        );
        part(
          b,
          p,
          "back",
          [1.8, 0.65, 0.1],
          [bx, 1.05, bz + sign * 0.35],
          9,
          1.8 * 0.65,
          frame,
          V.benchJoint,
        );
      }
    if (p.type === "building") {
      const floors = p.buildingFloors ?? config.buildingFloors;
      const e = entity(`E-${p.objectId ?? p.id}`, "building", p),
        height = floors * V.storeyHeight;
      const core = part(
        e,
        p,
        "core",
        [7, height, 7],
        [p.x, height / 2, p.z],
        7 * height * 7 * V.concreteDensity,
        0,
      );
      for (let floor = 0; floor < floors; floor++)
        for (let face = 0; face < 4; face++) {
          const angle = (face * Math.PI) / 2,
            normal = [Math.sin(angle), Math.cos(angle)],
            y = floor * 3 + 1.5;
          const wall = part(
            e,
            p,
            "facade",
            [7.4, 2.8, 0.12],
            [p.x + normal[0] * 3.8, y, p.z + normal[1] * 3.8],
            7.4 * 2.8 * V.facadeMass,
            7.4 * 2.8,
            core,
            7.4 * 2.8 * V.facadeFixing,
            "N",
            "box",
            [0, angle, 0],
          );
          part(
            e,
            p,
            "window",
            [1.4, 1.3, 0.07],
            [p.x + normal[0] * 3.95, y, p.z + normal[1] * 3.95],
            1.4 * 1.3 * V.windowMass,
            1.4 * 1.3,
            wall,
            1.4 * 1.3 * V.windowFixing,
            "N",
            "glass",
            [0, angle, 0],
          );
        }
      part(
        e,
        p,
        "terrace",
        [8, 0.14, 8],
        [p.x, height + 0.08, p.z],
        8 * 8 * V.facadeMass,
        64,
        core,
        64 * V.roofFixing,
      );
    }
  }
  return { entities, pieces };
}

export class UrbanEnvironment {
  constructor(config, layout, world) {
    this.config = config;
    this.world = world;
    this.elapsed = 0;
    this.events = [];
    this.pieces = [];
    this.connections = [];
    this.profile = {
      id: "environment",
      label: "Árboles, mobiliario y edificios",
    };
    this.roof = { label: "Cubierta de edificio" };
    const blueprint = environmentBlueprint(config, layout);
    this.entities = blueprint.entities;
    for (const d of blueprint.pieces) {
      const body = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(...d.position),
        shape: new CANNON.Box(new CANNON.Vec3(...d.size.map((n) => n / 2))),
        linearDamping: 0.1,
        angularDamping: 0.4,
      });
      const yaw = new CANNON.Quaternion(),
        local = new CANNON.Quaternion();
      yaw.setFromEuler(0, d.yaw, 0);
      local.setFromEuler(...d.rotation);
      yaw.mult(local, body.quaternion);
      world.addBody(body);
      this.pieces.push({
        ...d,
        details: { ...d },
        body,
        origin: body.position.clone(),
        orientation: body.quaternion.clone(),
        connections: [],
        load: new CANNON.Vec3(),
        demand: 0,
        detached: false,
        damage: 0,
      });
    }
    for (const p of this.pieces)
      if (p.capacity !== null) {
        const c = {
          id: this.connections.length,
          kind: p.kind,
          a: p,
          b: p.parentId === null ? null : this.pieces[p.parentId],
          capacity: p.capacity,
          unit: p.unit,
          broken: false,
          stress: 0,
        };
        this.connections.push(c);
        p.connections.push(c);
        c.b?.connections.push(c);
      }
  }
  log(data) {
    const e = { id: this.events.length + 1, time: this.elapsed, ...data };
    this.events.push(e);
    return e.id;
  }
  breakConnection(c, demand) {
    if (c.broken) return;
    c.broken = true;
    c.cause = "overload";
    c.eventId = this.log({
      type: "connection",
      kind: c.kind,
      connectionId: c.id,
      pieceId: c.a.id,
      otherPieceId: c.b?.id ?? null,
      entityId: c.a.entityId,
      parcelId: c.a.parcelId,
      cause: "overload",
      demand,
      capacity: (c.capacity * this.config.reinforcement) / 100,
      unit: c.unit,
      parents: [],
    });
  }
  resolveSupports() {
    const supported = new Set(
      this.pieces.filter((p) => p.capacity === null).map((p) => p.id),
    );
    for (const c of this.connections)
      if (!c.b && !c.broken) supported.add(c.a.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of this.connections)
        if (
          !c.broken &&
          c.b &&
          supported.has(c.b.id) &&
          !supported.has(c.a.id)
        ) {
          supported.add(c.a.id);
          changed = true;
        }
    }
    for (const p of this.pieces) {
      if (!supported.has(p.id) && !p.detached) {
        const parents = [];
        let q = p;
        while (q) {
          const c = q.connections.find((c) => c.a === q);
          if (c?.broken && c.eventId) parents.push(c.eventId);
          q = c?.b;
        }
        p.releaseEventId = this.log({
          type: "release",
          kind: p.kind,
          pieceId: p.id,
          entityId: p.entityId,
          parcelId: p.parcelId,
          mass: p.mass,
          cause: "support",
          parents,
        });
        p.detached = true;
        p.body.mass = p.mass;
        p.body.type = CANNON.Body.DYNAMIC;
        p.body.updateMassProperties();
        p.body.updateSolveMassProperties();
        p.body.aabbNeedsUpdate = true;
        p.body.wakeUp();
      }
      p.damage = p.connections.filter((c) => c.broken).length;
    }
    for (const c of this.connections) {
      if (c.broken && c.constraint) {
        this.world.removeConstraint(c.constraint);
        c.constraint = null;
      } else if (
        !c.broken &&
        c.b &&
        c.a.detached &&
        c.b.detached &&
        !c.constraint
      ) {
        c.constraint = new CANNON.LockConstraint(c.a.body, c.b.body, {
          maxForce: 1e7,
        });
        c.constraint.collideConnected = false;
        this.world.addConstraint(c.constraint);
      }
    }
  }
  prepareStep(center, time) {
    this.elapsed = time;
    for (const p of this.pieces) {
      windAt(p.body.position, center, this.config, p.area).scale(
        Math.min(time / 1.8, 1),
        p.load,
      );
      if (p.kind !== "terrace") p.load.y *= 0.12;
      p.demand = Math.hypot(p.load.x, p.load.z);
    }
    for (const c of this.connections) {
      if (c.broken) continue;
      let demand = c.a.demand;
      if (c.unit === "N·m") {
        const descendants = [c.a];
        for (let i = 0; i < descendants.length; i++)
          for (const child of this.connections)
            if (!child.broken && child.b === descendants[i])
              descendants.push(child.a);
        const pivot =
          c.b?.body.position ?? new CANNON.Vec3(c.a.origin.x, 0, c.a.origin.z);
        let mx = 0,
          mz = 0;
        for (const p of descendants) {
          const arm = p.body.position.vsub(pivot),
            moment = arm.cross(p.load);
          mx += moment.x;
          mz += moment.z;
        }
        demand = Math.hypot(mx, mz);
      } else if (c.kind === "terrace")
        demand = Math.max(0, c.a.load.y - c.a.mass * 9.82);
      c.stress =
        demand > (c.capacity * this.config.reinforcement) / 100
          ? c.stress + FIXED_STEP
          : Math.max(0, c.stress - 2 * FIXED_STEP);
      if (c.stress + 1e-9 >= RULES.overloadSeconds)
        this.breakConnection(c, demand);
    }
    this.resolveSupports();
    for (const p of this.pieces)
      if (p.detached) {
        const speed = p.body.velocity.length(),
          drag = p.body.velocity.scale(-0.5 * 1.225 * p.area * 0.7 * speed);
        p.body.applyForce(p.load.vadd(drag));
      }
  }
  finishStep() {
    for (const p of this.pieces)
      if (p.detached) {
        p.body.updateAABB();
        const bottom = p.body.aabb.lowerBound.y;
        if (bottom < -0.01) {
          p.body.position.y -= bottom;
          if (p.body.velocity.y < 0) p.body.velocity.y *= -0.03;
          p.body.aabbNeedsUpdate = true;
        }
      }
  }
  get stats() {
    const rows = this.entities.map((e) => {
      const pieces = e.pieces.map((id) => this.pieces[id]),
        detached = pieces.filter((p) => p.detached).length;
      return {
        id: e.id,
        type: e.type,
        parcelId: e.parcelId,
        total: pieces.length,
        detached,
        anchorFailed: pieces.some((p) => p.kind === "trunk" && p.detached),
        state: detached ? "Con desprendimientos" : "Sin desprendimientos",
      };
    });
    return {
      total: this.pieces.length,
      detached: rows.reduce((n, r) => n + r.detached, 0),
      broken: this.connections.filter((c) => c.broken).length,
      connectionTotal: this.connections.length,
      rows,
    };
  }
}
