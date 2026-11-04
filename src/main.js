import { ENV_MODEL } from "./environment.js";
import { setupEditor } from "./editor-ui.js";
import { setupLearning } from "./learning-ui.js";
import { setupHistoricalCatalog } from "./historical-ui.js";
import { LESSONS } from "./lessons.js";
import { refreshParameterLibrary } from "./parameters-ui.js";
import { setupUrban } from "./urban-ui.js";
import "./style.css";
import { FIXED_STEP } from "./physics.js";
import { PROFILES, ROOFS, HOUSE, CENSUS, SOURCES, PRESETS } from "./catalog.js";
import { Experiment } from "./district.js";
import { setupNotebook } from "./notebook.js";
import { SceneView } from "./scene.js";
import { compareFragmentFlight } from "./fragment-trial.js";

const $ = (id) => document.getElementById(id);
const simulation = new Experiment({ fragmentFlight: "projected-v1" });
let view, frame, worker, comparisonConfig, notebook, urban, editor, learning;
let running = false,
  accumulator = 0,
  lastTime = null,
  lastReadout = -1;
const percent = (part, total) =>
  total ? `${Math.round((part / total) * 100)}%` : "—";
const number = (value) =>
  value.toLocaleString("es-CL", { maximumFractionDigits: 2 });

function updateReadout() {
  const s = notebook?.replayStats ?? simulation.stats;
  const indoor = (s.rows ?? [s]).map((row) => row.enclosure).filter(Boolean);
  $("enclosure-summary").hidden = indoor.length === 0;
  if (indoor.length) {
    const pressures = indoor.map(({ pressure }) => pressure);
    const range =
      indoor.length === 1
        ? number(pressures[0])
        : `${number(Math.min(...pressures))} a ${number(Math.max(...pressures))}`;
    const area = indoor.reduce((sum, entry) => sum + entry.openingArea, 0);
    $("enclosure-summary").textContent =
      `Presión interior aplicada ${range} Pa respecto al ambiente · Aberturas ${number(area)} m².`;
  }
  $("roof-count").textContent = s.detached;
  $("roof-total").textContent =
    `${s.total} ${simulation.houses ? "piezas" : simulation.roof.unit}`;
  $("damage-value").textContent = percent(s.detached, s.total);
  $("damage-bar").style.width = s.total ? percent(s.detached, s.total) : "0%";
  $("wall-detached").textContent = s.wallDetached;
  $("wall-total").textContent = s.wallTotal;
  $("secondary-count").textContent = s.secondaryTotal
    ? `${s.secondaryDetached}/${s.secondaryTotal} ${simulation.houses ? "elementos secundarios desprendidos" : simulation.profile.id === "concrete" ? "ventanas desprendidas" : "revestimientos desprendidos"}`
    : "Sin elementos secundarios separados";
  $("wall-count").textContent = s.stable;
  $("facade-total").textContent = s.facadeTotal;
  $("wall-description").textContent = s.state;
  $("wall-description").classList.toggle("damage-state", s.state !== "Estable");
  $("connection-count").textContent = s.broken;
  $("connection-total").textContent = s.connectionTotal;
  $("wall-damage").textContent =
    `${s.wallDamaged}/${s.wallTotal} paneles con uniones estructurales falladas`;
  $("displacement").textContent = s.maxDisplacement.toFixed(2);
  $("tilt").textContent = `Inclinación máx. ${s.maxTilt.toFixed(1)}°`;
  if (simulation.houses) {
    $("district-summary").textContent =
      `${s.affected}/${s.houseTotal} viviendas afectadas · ${s.collapsed} con colapso del modelo · recorrido ${Math.round(s.progress * 100)} %`;
    for (const row of s.rows) {
      const values = [
        row.label,
        row.profile,
        `${row.detached}/${row.total}`,
        `${row.wallDetached}/${row.wallTotal}`,
        row.secondaryTotal
          ? `${row.secondaryDetached}/${row.secondaryTotal}`
          : "—",
        row.state,
      ];
      const cells = document.querySelectorAll(`#house-row-${row.id} td`);
      cells.forEach((cell, i) => {
        if (cell.textContent !== values[i]) cell.textContent = values[i];
      });
    }
  }
  const env = s.environment;
  if (env) {
    const names = { tree: "Árbol", bench: "Banco", building: "Edificio" };
    const fallen = env.rows.filter(
      (r) => r.type === "tree" && r.anchorFailed,
    ).length;
    $("environment-summary").textContent =
      `${env.detached}/${env.total} piezas liberadas · ${env.broken}/${env.connectionTotal} uniones falladas · ${fallen} ${fallen === 1 ? "árbol" : "árboles"} con anclaje fallado.`;
    for (const r of env.rows) {
      let tr = document.getElementById(`environment-row-${r.id}`);
      if (!tr) {
        tr = document.createElement("tr");
        tr.id = `environment-row-${r.id}`;
        for (let i = 0; i < 5; i++) tr.append(document.createElement("td"));
        $("environment-rows").append(tr);
      }
      const values = [
        r.id,
        names[r.type],
        r.parcelId,
        `${r.detached}/${r.total}`,
        r.state,
      ];
      [...tr.children].forEach((td, i) => {
        if (td.textContent !== values[i]) td.textContent = values[i];
      });
    }
  }
  const seconds = Math.floor(s.elapsed + 1e-8);
  $("elapsed").textContent =
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  learning?.refresh();
}

function setRunning(value) {
  if (!view || $("play").disabled) return;
  running = value;
  if (value && view.initialView) view.setInitialView(false);
  lastTime = null;
  $("status").classList.toggle("running", running);
  $("status-text").textContent = running
    ? "Simulación en curso"
    : simulation.finished
      ? "Ensayo terminado"
      : simulation.elapsed
        ? "Simulación pausada"
        : "Listo para iniciar";
  $("play-text").textContent = running
    ? "Pausar simulación"
    : simulation.finished
      ? "Repetir ensayo"
      : simulation.elapsed
        ? "Reanudar simulación"
        : "Iniciar simulación";
  $("play-icon").textContent = running ? "Ⅱ" : "▶";
  $("play").setAttribute("aria-label", $("play-text").textContent);
  $("play").setAttribute("aria-pressed", String(running));
}

function updateScenarioInfo() {
  urban?.refresh();
  $("environment-results").hidden = !simulation.environment;
  $("environment-rows").replaceChildren();
  if (simulation.environment) {
    const names = {
      treeHeight: "Altura de árbol",
      woodDensity: "Densidad de madera",
      treeAnchor: "Anclaje de árbol",
      treeWeakAnchor: "Anclaje reducido de árbol",
      branchJoint: "Unión de rama",
      crownJoint: "Unión de copa",
      benchAnchor: "Anclaje de banco",
      benchJoint: "Unión de mobiliario",
      storeyHeight: "Altura de piso",
      buildingWidth: "Envolvente de edificio",
      concreteDensity: "Densidad del núcleo fijo",
      facadeMass: "Masa superficial de fachada",
      windowMass: "Masa superficial de ventana",
      facadeFixing: "Fijación de fachada",
      windowFixing: "Fijación de ventana",
      roofFixing: "Fijación de cubierta",
    };
    $("environment-sources").replaceChildren(
      ...ENV_MODEL.sources.map((s) => {
        const a = document.createElement("a");
        a.href = s.url;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = `${s.institution}: ${s.title} · ${s.status} ↗`;
        return a;
      }),
    );
    $("environment-parameters").replaceChildren(
      ...Object.entries(ENV_MODEL.parameters).map(([key, p]) => {
        const tr = document.createElement("tr");
        for (const value of [names[key], `${p.value} ${p.unit}`, p.status]) {
          const td = document.createElement("td");
          td.textContent = value;
          tr.append(td);
        }
        return tr;
      }),
    );
  }
  for (const id of ["mode", "distribution", "spacing", "trajectory", "profile"])
    $(id).value = simulation.config[id];
  $("impact").checked = simulation.config.impact !== "off";
  $("enclosure").value = simulation.config.enclosure;
  $("load-path").checked = simulation.config.loadPath !== "off";
  $("fragment-flight").checked =
    simulation.config.fragmentFlight === "projected-v1";
  $("impact-method").textContent =
    simulation.config.impact === "contact-v1"
      ? "Detección discreta · ensayo v2.8"
      : "Barrido de fragmentos rápidos";
  $("trajectory").querySelector("[data-custom]")?.remove();
  if (simulation.config.route) {
    const option = new Option(
      `Dibujado · ${simulation.config.route.length} puntos`,
      "custom",
    );
    option.dataset.custom = "true";
    option.disabled = true;
    $("trajectory").add(option);
    $("trajectory").value = "custom";
  }
  for (const id of ["wind", "radius", "reinforcement"]) {
    $(id).value = simulation.config[id];
    paintRange(id);
  }
  const { profile, roof } = simulation;
  for (const id of ["profile", "roof", "distribution"])
    $(id).disabled = !!simulation.config.sitePlan || !!notebook?.replaying;
  const district = !!simulation.houses;
  $("district-controls").hidden = !district;
  $("district-results").hidden = !district;
  document.querySelector("#district-results h3").textContent =
    simulation.config.mode === "neighborhood"
      ? "Resultados de las viviendas del barrio"
      : "Resultados de la manzana";
  $("compare-button").hidden = district;
  $("profile-title").textContent = district
    ? "Manzana ilustrativa"
    : profile.label;
  if (district) {
    $("district-rows").replaceChildren(
      ...simulation.houses.map((h) => {
        const tr = document.createElement("tr");
        tr.id = `house-row-${h.id}`;
        for (let i = 0; i < 6; i++) tr.append(document.createElement("td"));
        return tr;
      }),
    );
    $("house-inspect").replaceChildren(
      new Option("Vista general", "all"),
      ...simulation.houses.map(
        (h) =>
          new Option(
            `${h.label}${h.parcelId ? " / " + h.parcelId : ""} · ${h.simulation.profile.label}`,
            String(h.id),
          ),
      ),
    );
  }

  $("profile-title").textContent = profile.label;
  $("profile-description").textContent = profile.description;
  $("census-link").href = SOURCES.glossary.url;
  $("census-link").textContent = `Censo 2024: ${profile.censusWall} ↗`;
  $("floor-area").textContent =
    `${Math.round(HOUSE.width * HOUSE.depth)} m²${district ? "/casa" : ""}`;
  $("roof-spec").textContent = `${simulation.stats.total} ${roof.unit}`;
  $("scene-label").textContent =
    `${profile.label} + ${roof.label}`.toUpperCase();
  $("scene").setAttribute(
    "aria-label",
    `Casa de ${profile.label.toLowerCase()} con ${roof.label.toLowerCase()} y tornado tridimensional`,
  );
  const options = Object.values(ROOFS).map((item) => {
    const option = new Option(item.label, item.id);
    option.disabled =
      !profile.roofs.includes(item.id) ||
      (district &&
        simulation.config.distribution === "mixed" &&
        item.id === "slab");
    return option;
  });
  $("roof").replaceChildren(...options);
  $("roof").value = roof.id;
  if (district) {
    $("profile-title").textContent =
      `${simulation.houses.length} viviendas · ${simulation.config.distribution === "mixed" ? "mezcla ilustrativa" : profile.label}`;
    $("scene-label").textContent =
      (simulation.config.mode === "neighborhood"
        ? simulation.config.sitePlan
          ? "TU MANZANA · "
          : "BARRIO SINTÉTICO · "
        : "MANZANA ILUSTRATIVA · ") +
      simulation.houses.length +
      " CASAS";
    $("profile-description").textContent =
      simulation.config.distribution === "mixed"
        ? "Mezcla determinista de cuatro variantes, sin proporciones censales."
        : profile.description;
    $("census-link").textContent = "Fuentes de las categorías de vivienda ↗";
  }
  if (simulation.config.sitePlan) {
    $("profile-title").textContent =
      `${simulation.houses.length} casas configuradas por objeto`;
    $("profile-description").textContent =
      "El plano conserva el perfil, la cubierta y la orientación de cada casa. Selecciona un objeto en el editor para cambiarlo.";
  }
  const lesson = LESSONS[simulation.config.lesson];
  $("scene-location").textContent =
    lesson?.historical?.location ?? "36° S / CHILE CENTRAL";
  document.querySelector(".scene-header h2").textContent = lesson?.historical
    ? lesson.title
    : district
      ? simulation.config.mode === "neighborhood"
        ? "Barrio bajo el vórtice"
        : "Manzana bajo el vórtice"
      : "Vivienda bajo el vórtice";
  if (district)
    $("scene").setAttribute(
      "aria-label",
      `${simulation.config.mode === "neighborhood" ? "Barrio sintético" : "Manzana ilustrativa"} de ${simulation.houses.length} viviendas y tornado`,
    );
  $("roof-description").textContent = simulation.config.sitePlan
    ? "Plano manual: configura cada casa desde Construir mi manzana."
    : profile.family === "Estructura liviana"
      ? "Losa no disponible en este perfil ilustrativo. Cambiar la selección reconstruye la vivienda."
      : "Cambiar el sistema o la cubierta reconstruye el escenario.";
}

function reset(changes = {}) {
  notebook?.beforeReset();
  setRunning(false);
  const next = { ...simulation.config, ...changes };
  if (next.mode !== "neighborhood") {
    next.sitePlan = null;
    next.route = null;
    next.lesson = null;
  }
  if (next.mode === "single") next.travelSpeed = 2;
  if (
    next.mode !== "single" &&
    next.distribution === "mixed" &&
    next.roof === "slab"
  )
    next.roof = "metal";
  simulation.reset(next);
  if (view) view.initialView = false;
  accumulator = 0;
  lastTime = null;
  lastReadout = -1;
  view?.sync();
  if (simulation.houses) view?.setView("perspective");
  updateScenarioInfo();
  updateReadout();
  setRunning(false);
}

function updateRange(id) {
  const input = $(id);
  simulation.setParameter(id, Number(input.value));
  paintRange(id);
  view?.sync();
}

function paintRange(id) {
  const input = $(id);
  $(`${id}-value`).value = input.value;
  input.style.setProperty(
    "--fill",
    `${((input.value - input.min) / (input.max - input.min)) * 100}%`,
  );
  if (id === "wind")
    document.querySelectorAll("[data-preset]").forEach((button) => {
      const active = PRESETS[button.dataset.preset] === Number(input.value);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  view?.sync();
}

for (const id of ["mode", "distribution", "spacing", "trajectory"])
  $(id).addEventListener("change", () =>
    reset({
      [id]: id === "spacing" ? Number($(id).value) : $(id).value,
      ...(id === "trajectory" ? { route: null } : {}),
    }),
  );
$("house-inspect").addEventListener("change", () => {
  const house = simulation.houses?.find(
    (h) => String(h.id) === $("house-inspect").value,
  );
  if (!house) {
    view?.setView("perspective");
    return;
  }
  view.controls.target.set(house.offset.x, 2, house.offset.z);
  view.camera.position.set(house.offset.x + 17, 17, house.offset.z + 21);
  view.controls.update();
});
$("profile").replaceChildren(
  ...Object.values(PROFILES).map((p) => new Option(p.label, p.id)),
);
$("profile").value = simulation.config.profile;
$("profile").addEventListener("change", () => {
  const profile = PROFILES[$("profile").value];
  reset({
    profile: profile.id,
    roof: profile.roofs.includes(simulation.config.roof)
      ? simulation.config.roof
      : profile.defaultRoof,
  });
});
$("roof").addEventListener("change", () => reset({ roof: $("roof").value }));
$("impact").addEventListener("change", () =>
  reset({ impact: $("impact").checked ? "swept-v2" : "off" }),
);
$("fragment-flight").addEventListener("change", () =>
  reset({
    fragmentFlight: $("fragment-flight").checked ? "projected-v1" : "legacy",
  }),
);
$("enclosure").addEventListener("change", () =>
  reset({ enclosure: $("enclosure").value }),
);
$("load-path").addEventListener("change", () =>
  reset({ loadPath: $("load-path").checked ? "grounded-graph-v1" : "off" }),
);
for (const id of ["wind", "radius", "reinforcement"]) {
  $(id).addEventListener("input", () => updateRange(id));
  updateRange(id);
}
document.querySelectorAll("[data-preset]").forEach((button) =>
  button.addEventListener("click", () => {
    $("wind").value = PRESETS[button.dataset.preset];
    updateRange("wind");
  }),
);
$("play").addEventListener("click", () => {
  if (simulation.finished) reset();
  setRunning(!running);
});
$("reset").addEventListener("click", () => reset());
$("show-tornado").addEventListener("change", (event) => {
  if (view) view.vortex.visible = event.target.checked;
});
$("show-radius").addEventListener("change", (event) => {
  if (view) view.influence.visible = event.target.checked;
});
document.querySelectorAll("[data-view]").forEach((button) =>
  button.addEventListener("click", () => {
    view?.setView(button.dataset.view);
    document.querySelectorAll("[data-view]").forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
  }),
);

function showDialog(id) {
  setRunning(false);
  notebook?.pauseReplay();
  $(id).showModal();
}
$("about-button").addEventListener("click", () => showDialog("about-dialog"));
$("fragment-trial-open").addEventListener("click", () => {
  const wind = simulation.config.wind;
  $("fragment-trial-conditions").textContent =
    `Viento horizontal constante de ${wind} km/h. Ambas piezas parten en reposo, a 4 m libres del suelo y con la cara a 45° del viento. Los datos se toman al primer contacto con el suelo.`;
  $("fragment-trial-results").replaceChildren(
    ...compareFragmentFlight(wind).map((row) => {
      const tr = document.createElement("tr");
      const format = (value) =>
        value.toLocaleString("es-CL", { maximumFractionDigits: 2 });
      const label = document.createElement("th");
      label.scope = "row";
      label.textContent = row.label;
      tr.append(label);
      for (const value of [
        format(row.mass),
        format(row.distance),
        format(row.turn),
        row.speed === null ? "Sin impacto" : format(row.speed),
        format(row.time),
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      return tr;
    }),
  );
  showDialog("fragment-trial-dialog");
});
$("fragment-trial-close").addEventListener("click", () =>
  $("fragment-trial-dialog").close(),
);
$("close-about").addEventListener("click", () => $("about-dialog").close());
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  });

$("parameters-button").addEventListener("click", () => {
  refreshParameterLibrary(simulation.config);
  const { profile, roof, config } = simulation;
  $("census-description").textContent = simulation.config.sitePlan
    ? "Plano manual: cada casa tiene su propio perfil y cubierta. Esta tabla muestra valores base de referencia; consulta cada objeto en el editor o en la inspección del cuaderno. " +
      CENSUS.scope
    : `Tipo representado: casa con acceso directo. Paredes: ${profile.censusWall}. Cubierta: ${roof.censusRoof}. ${CENSUS.scope}`;
  $("calibration-description").textContent = CENSUS.physicalProvenance;
  const rows = [
    ["Perfil ilustrativo", profile.label, "Catálogo SimTorCL"],
    [
      "Dimensiones",
      `${HOUSE.width} × ${HOUSE.depth} × ${HOUSE.height} m`,
      "Supuesto educativo",
    ],
    [
      "Masa superficial de paredes",
      `${number(profile.arealMass)} kg/m²`,
      "Supuesto educativo",
    ],
    [
      "Espesor de paredes",
      `${number(profile.thickness)} m`,
      "Supuesto educativo",
    ],
    [
      "Capacidad base de uniones de muro",
      `${number(profile.jointPressure)} N/m²`,
      "Supuesto educativo",
    ],
    [
      "Masa superficial de cubierta",
      `${number(roof.arealMass)} kg/m²`,
      "Supuesto educativo",
    ],
    [
      "Capacidad base de fijación de cubierta",
      `${number(roof.fixingPressure)} N/m²`,
      "Supuesto educativo",
    ],
    [
      "Refuerzo aplicado",
      `${config.reinforcement} %`,
      "Control del experimento",
    ],
    [
      "Base común",
      "Plano estático; piso sin daño",
      "Simplificación geométrica",
    ],
    ["Modo de daño", profile.failure, "Modelo simplificado"],
  ];
  if (profile.claddingPressure)
    rows.splice(5, 0, [
      "Capacidad de elementos secundarios",
      `${number(profile.claddingPressure)} N/m²`,
      "Supuesto educativo",
    ]);
  $("parameter-values").replaceChildren(
    ...rows.map(([name, value, origin]) => {
      const row = document.createElement("tr"),
        th = document.createElement("th");
      th.scope = "row";
      th.textContent = name;
      row.append(th);
      for (const text of [value, origin]) {
        const td = document.createElement("td");
        td.textContent = text;
        row.append(td);
      }
      return row;
    }),
  );
  $("source-links").replaceChildren(
    ...Object.values(SOURCES).map((source) => {
      const a = document.createElement("a");
      a.href = source.url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = `${source.title} ↗ · consulta ${source.consulted}`;
      return a;
    }),
  );
  showDialog("parameters-dialog");
});
$("close-parameters").addEventListener("click", () =>
  $("parameters-dialog").close(),
);

function finishComparison(message) {
  worker?.terminate();
  worker = null;
  $("run-comparison").disabled = false;
  $("comparison-duration").disabled = false;
  $("cancel-comparison").hidden = true;
  $("comparison-progress").textContent = message;
}
function renderComparison(results) {
  const rows = results.map((result) => {
    const row = document.createElement("tr"),
      heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = PROFILES[result.profile].label;
    row.append(heading);
    if (result.unavailable) {
      const td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = "Combinación no disponible en este catálogo.";
      row.append(td);
      return row;
    }
    const s = result.stats;
    const values = [
      `${s.detached}/${s.total} · ${percent(s.detached, s.total)}`,
      `${s.wallDetached}/${s.wallTotal}`,
      s.secondaryTotal
        ? `${s.secondaryDetached}/${s.secondaryTotal}`
        : "No aplica",
      `${s.broken}/${s.connectionTotal}`,
      `${s.maxDisplacement.toFixed(2)} m / ${s.maxTilt.toFixed(1)}°`,
      s.state,
    ];
    for (const value of values) {
      const td = document.createElement("td");
      td.textContent = value;
      row.append(td);
    }
    return row;
  });
  $("comparison-results").replaceChildren(...rows);
}
$("compare-button").addEventListener("click", () => {
  comparisonConfig = { ...simulation.config };
  $("comparison-conditions").textContent =
    `${ROOFS[comparisonConfig.roof].label} · ${comparisonConfig.wind} km/h · radio ${comparisonConfig.radius} m · refuerzo ${comparisonConfig.reinforcement} %. Trayectoria orbital idéntica y arranque sin daños.`;
  $("comparison-results").replaceChildren();
  $("comparison-progress").textContent =
    "Cada ejecución comienza con las viviendas intactas.";
  showDialog("comparison-dialog");
});
$("run-comparison").addEventListener("click", () => {
  if (worker) return;
  $("run-comparison").disabled = true;
  $("comparison-duration").disabled = true;
  $("cancel-comparison").hidden = false;
  $("comparison-results").replaceChildren();
  $("comparison-progress").textContent = "Calculando perfiles…";
  try {
    const current = new Worker(
      new URL("./comparison.worker.js", import.meta.url),
      { type: "module" },
    );
    worker = current;
    current.onmessage = ({ data }) => {
      if (worker !== current) return;
      if (data.type === "progress")
        $("comparison-progress").textContent =
          `${data.completed}/4 perfiles procesados · ${PROFILES[data.profile].label}`;
      if (data.type === "complete") {
        renderComparison(data.results);
        finishComparison(
          "Comparación terminada. El experimento interactivo conserva su estado.",
        );
      }
      if (data.type === "error")
        finishComparison(
          `No se pudo completar la comparación: ${data.message}`,
        );
    };
    current.onerror = () => {
      if (worker === current)
        finishComparison(
          "No se pudo iniciar el cálculo. Puedes volver a intentarlo.",
        );
    };
    current.postMessage({
      config: comparisonConfig,
      seconds: Number($("comparison-duration").value),
    });
  } catch {
    finishComparison("No se pudo iniciar el cálculo en segundo plano.");
  }
});
$("cancel-comparison").addEventListener("click", () =>
  finishComparison("Comparación cancelada. Puedes ejecutarla de nuevo."),
);
$("close-comparison").addEventListener("click", () =>
  $("comparison-dialog").close(),
);
$("comparison-dialog").addEventListener("close", () => {
  if (worker) finishComparison("Comparación cancelada al cerrar.");
});

window.addEventListener("keydown", (event) => {
  if (
    event.target.matches("input,button,a,textarea,select") ||
    document.querySelector("dialog[open]") ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  )
    return;
  if (event.code === "Space") {
    event.preventDefault();
    if (simulation.finished) reset();
    setRunning(!running);
  }
  if (event.code === "KeyR" && view) reset();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) setRunning(false);
});
function animate(now) {
  frame = requestAnimationFrame(animate);
  const realDt = lastTime === null ? 0 : (now - lastTime) / 1000;
  const dt = Math.min(realDt, 0.1);
  lastTime = now;
  notebook?.advanceReplay(dt);
  if (running && !notebook?.replaying) {
    simulation.realSeconds += realDt;
    accumulator = Math.min(
      accumulator + dt,
      FIXED_STEP * (simulation.houses ? 4 : 12),
    );
    while (accumulator >= FIXED_STEP) {
      simulation.step();
      accumulator -= FIXED_STEP;
      if (simulation.finished) {
        setRunning(false);
        break;
      }
    }
    view.sync();
  }
  if (now - lastReadout > 100) {
    updateReadout();
    notebook?.refresh();
    lastReadout = now;
  }
  view.render();
}
updateScenarioInfo();
updateReadout();
try {
  view = new SceneView($("scene"), simulation);
  $("loading").hidden = true;
  urban = setupUrban({
    experiment: simulation,
    getView: () => view,
    pause: () => setRunning(false),
    reset,
  });
  urban.refresh();
  notebook = setupNotebook({
    experiment: simulation,
    getView: () => view,
    pause: () => setRunning(false),
    refresh: updateReadout,
    resetConfig: reset,
    sceneChanged: () => {
      view.sync();
      updateScenarioInfo();
      updateReadout();
    },
  });
  editor = setupEditor({
    experiment: simulation,
    pause: () => setRunning(false),
    reset,
    isReplaying: () => !!notebook?.replaying,
  });
  setupHistoricalCatalog({ openScenario: editor.open });
  learning = setupLearning({
    experiment: simulation,
    getView: () => view,
    getNotebook: () => notebook,
    pause: () => setRunning(false),
    openEditor: () => editor.openExamples(),
  });
  frame = requestAnimationFrame(animate);
} catch (error) {
  $("loading").hidden = true;
  $("error").hidden = false;
  $("error").textContent =
    "No fue posible iniciar la escena 3D. Usa un navegador con WebGL 2 y aceleración gráfica activada.";
  $("play").disabled = true;
  $("reset").disabled = true;
  console.error("No se pudo iniciar SimTorCL:", error);
}
$("scene").addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  setRunning(false);
  cancelAnimationFrame(frame);
  $("error").hidden = false;
  $("error").textContent =
    "Se perdió la conexión con la GPU. Recarga para reconstruir el escenario.";
  $("play").disabled = true;
  $("reset").disabled = true;
});
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(frame);
    worker?.terminate();
    notebook?.dispose();
    editor?.dispose();
    learning?.dispose();
    view?.dispose();
  });
