import { ENV_LABELS } from "./environment.js";
import { Experiment } from "./district.js";
import { PROFILES, ROOFS } from "./catalog.js";
import { FIXED_STEP } from "./physics.js";
import {
  applyFrame,
  cleanConfig,
  componentsCSV,
  configurationDocument,
  csv,
  damageChart,
  eventsCSV,
  environmentCSV,
  objectSimulations as houseSimulations,
  htmlReport,
  MAX_FILE_BYTES,
  normalizeName,
  parseDocument,
  parseShareHash,
  resultsCSV,
  parcelsCSV,
  shareLink,
} from "./records.js";
import { listEntries, readEntry, saveEntry } from "./library.js";

const $ = (id) => document.getElementById(id);
const labels = {
  ...ENV_LABELS,
  wall: "Pared estructural",
  roof: "Cubierta",
  cladding: "Revestimiento / ventana",
  base: "Anclaje a base",
  corner: "Esquina",
};
const seconds = (n) => `${n.toFixed(2)} s`;
const download = (name, body, type) => {
  const url = URL.createObjectURL(new Blob([body], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const filename = (name) =>
  normalizeName(name).replace(/[^\p{L}\p{N}_-]+/gu, "_");
const differences = (a, b, path = "") =>
  Object.entries(a).flatMap(([key, value]) => {
    const label = path + key,
      other = b?.[key];
    if (typeof value === "number")
      return !Number.isFinite(other) ||
        Math.abs(value - other) > 1e-6 * Math.max(1, Math.abs(value))
        ? [label]
        : [];
    if (value && typeof value === "object")
      return differences(value, other, label + ".");
    return value !== other ? [label] : [];
  });

export function setupNotebook({
  experiment,
  getView,
  pause,
  sceneChanged,
  refresh,
  resetConfig,
}) {
  let snapshot,
    replay,
    backup,
    replayStats,
    playing = false,
    replayTime = 0,
    calculation,
    comparison,
    comparisonKey;
  const name = () => normalizeName($("experiment-name").value);
  const status = (message) => {
    $("notebook-status").textContent = message;
  };
  const attempt = (fn) => async () => {
    try {
      await fn();
    } catch (error) {
      status(error.message);
    }
  };
  const current = () =>
    replay ? { ...replay, name: name() } : experiment.document(name());
  function pauseReplay() {
    playing = false;
    $("replay-play").textContent = "Reproducir grabación";
  }
  const controls = [
    "play",
    "mode",
    "distribution",
    "spacing",
    "trajectory",
    "profile",
    "roof",
    "wind",
    "radius",
    "reinforcement",
    "urban-open",
    "editor-open",
    ...Array.from(document.querySelectorAll("[data-preset]")),
  ];
  let disabled = [];
  function freeze(value) {
    if (value) {
      disabled = controls.map((control) => {
        const node = typeof control === "string" ? $(control) : control;
        const was = node.disabled;
        node.disabled = true;
        return [node, was];
      });
    } else {
      for (const [node, was] of disabled) node.disabled = was;
      disabled = [];
    }
  }
  function seek(index) {
    index = Math.max(0, Math.min(replay.frames.length - 1, index));
    replayStats = applyFrame(experiment, replay, index);
    for (const key of ["wind", "radius", "reinforcement"]) {
      const input = $(key);
      input.value = experiment.config[key];
      $(`${key}-value`).value = input.value;
      input.style.setProperty(
        "--fill",
        `${((input.value - input.min) / (input.max - input.min)) * 100}%`,
      );
    }
    replayTime = replay.frames[index].step * FIXED_STEP;
    $("replay-position").value = index;
    $("replay-time").textContent =
      `${index + 1}/${replay.frames.length} · ${seconds(replayTime)}`;
    getView()?.sync();
    refresh();
  }
  function exitReplay(notify = true) {
    if (!backup) return;
    Object.assign(experiment, backup);
    experiment.revision++;
    backup = null;
    replay = null;
    replayStats = null;
    playing = false;
    freeze(false);
    $("replay-panel").hidden = true;
    $("replay-play").textContent = "Reproducir grabación";
    if (notify) {
      pause();
      sceneChanged();
      refresh();
      status(
        "Has vuelto a tu ejecución pausada, con su estado físico conservado.",
      );
    }
  }
  function enterReplay(record, step = 0) {
    // Construct the candidate before changing the live experiment.
    const candidate = new Experiment(record.initial, { record: false });
    applyFrame(candidate, record, 0);
    pause();
    exitReplay(false);
    backup = {
      active: experiment.active,
      recorder: experiment.recorder,
      steps: experiment.steps,
      realSeconds: experiment.realSeconds,
    };
    experiment.active = candidate.active;
    experiment.recorder = null;
    experiment.revision++;
    replay = record;
    $("status-text").textContent = "Repetición visual";
    freeze(true);
    $("replay-panel").hidden = false;
    $("replay-position").max = record.frames.length - 1;
    $("replay-description").textContent =
      `${record.name} · ${record.frames.length} fotogramas muestreados. La física permanece detenida; al salir recuperas tu ejecución.`;
    sceneChanged();
    seek(
      Math.max(
        0,
        record.frames.findIndex((f) => f.step >= step),
      ),
    );
  }
  async function library(selected = "") {
    const entries = await listEntries();
    $("experiment-library").replaceChildren(
      ...(entries.length
        ? entries.map(
            (e) =>
              new Option(
                `${e.name} · ${e.kind === "run" ? "ejecución" : "configuración"} · ${e.mode}`,
                e.id,
              ),
          )
        : [new Option("Sin experimentos guardados", "")]),
    );
    if (selected) $("experiment-library").value = selected;
  }
  async function selected() {
    const id = $("experiment-library").value;
    if (!id) throw new Error("Selecciona un experimento guardado.");
    const record = await readEntry(id);
    if (!record) throw new Error("No se encontró ese experimento.");
    return { id, record: parseDocument(JSON.stringify(record)) };
  }
  function load(record) {
    if (record.kind === "configuration") {
      resetConfig(record.initial);
      status("Configuración cargada: nueva ejecución sin daños.");
    } else {
      enterReplay(record);
      status(
        "Ejecución cargada en repetición visual. Puedes recalcularla en Comparar / verificar.",
      );
    }
    $("experiment-name").value = record.name;
    snapshot = current();
    populate();
  }
  function houses(select, all = false) {
    const previous = select.value;
    select.replaceChildren(
      ...(all ? [new Option("Todas", "all")] : []),
      ...houseSimulations(experiment).map(
        (h) =>
          new Option(`${h.label} · ${h.simulation.profile.label}`, h.label),
      ),
    );
    if ([...select.options].some((o) => o.value === previous))
      select.value = previous;
  }
  function eventDetail() {
    const e = snapshot?.events.find((e) => e.id === $("event-list").value);
    $("event-view").disabled = !e;
    $("event-detail").textContent = e
      ? `${e.id} · ${seconds(e.time)} · paso ${e.step}\n${e.entityId ?? e.house} · ${labels[e.kind]} #${e.pieceId}\n${e.type === "connection" ? `Unión #${e.connectionId} fallada\nDemanda al fallar: ${e.demand.toFixed(1)} ${e.unit ?? "N"} · capacidad: ${e.capacity.toFixed(1)} ${e.unit ?? "N"}` : `Pieza liberada · masa ${e.mass.toFixed(1)} kg`}\nCausa: ${e.cause === "overload" ? "sobrecarga sostenida" : "pérdida de soporte"}\nEventos anteriores relacionados: ${e.parents.join(", ") || "ninguno"}\nLas relaciones describen fallas y apoyos del grafo idealizado; no cuantifican transferencia de cargas.`
      : "No hay eventos para este filtro. Ejecuta la simulación para registrar fallas.";
  }
  function events() {
    if (!snapshot) return;
    const previous = $("event-list").value;
    const filtered = snapshot.events.filter(
      (e) =>
        ($("event-house").value === "all" ||
          e.house === $("event-house").value) &&
        ($("event-type").value === "all" || e.type === $("event-type").value),
    );
    $("event-list").replaceChildren(
      ...filtered.map(
        (e) =>
          new Option(
            `${e.time.toFixed(3)} s · ${e.house} · ${e.type === "connection" ? `Unión #${e.connectionId}` : "Liberación"} · ${labels[e.kind]} #${e.pieceId}`,
            e.id,
          ),
      ),
    );
    if (filtered.some((e) => e.id === previous))
      $("event-list").value = previous;
    else if (filtered.length) $("event-list").selectedIndex = 0;
    eventDetail();
  }
  function owner() {
    return houseSimulations(experiment).find(
      (h) => h.label === $("inspect-house").value,
    );
  }
  function piece() {
    return owner()?.simulation.pieces.find(
      (p) => String(p.id) === $("inspect-piece").value,
    );
  }
  function inspectDetail() {
    const p = piece(),
      h = owner();
    $("inspect-focus").disabled = !p;
    if (!p) {
      $("piece-detail").textContent = "No hay piezas en esta selección.";
      return;
    }
    const material =
      p.details.material ??
      (p.kind === "roof"
        ? h.simulation.roof.label
        : p.kind === "cladding"
          ? `${p.details.secondary ? "Ventana secundaria" : "Revestimiento"} de ${h.simulation.profile.label}`
          : h.simulation.profile.label);
    const displacement = p.body.position.distanceTo(p.origin);
    const tilt =
      (Math.acos(
        Math.max(
          -1,
          Math.min(
            1,
            1 - 2 * (p.body.quaternion.x ** 2 + p.body.quaternion.z ** 2),
          ),
        ),
      ) *
        180) /
      Math.PI;
    const movement =
      p.kind === "wall"
        ? `Movimiento actual de esta pared: ${displacement.toFixed(2)} m / ${tilt.toFixed(1)}°.\n`
        : "";
    $("piece-detail").textContent =
      movement +
      `${p.entityId ?? p.objectId ?? h.label} · ${labels[p.kind]} #${p.id}${p.parcelId ? " · " + p.parcelId : ""}\nMaterial / sistema: ${material}\nMasa: ${p.mass.toFixed(1)} kg · superficie: ${p.area.toFixed(2)} m²\nEstado actual: ${p.detached ? "liberada" : "con soporte"} · ${p.damage} uniones ${p.kind === "wall" ? "estructurales " : ""}falladas\nPosición: ${p.body.position
        .toArray()
        .map((n) => n.toFixed(2))
        .join(", ")} m\n${
        replay
          ? "Cargas instantáneas no almacenadas en los fotogramas."
          : `Carga de viento del último paso: ${p.load
              .toArray()
              .map((n) => n.toFixed(1))
              .join(", ")} N\nDemanda de la pieza: ${p.demand.toFixed(1)} N`
      }\nConexiones (capacidades con el refuerzo actual):\n${p.connections.map((c) => `#${c.id} ${labels[c.kind] ?? c.kind} · ${c.broken ? "fallada" : "intacta"} · ${((c.capacity * experiment.config.reinforcement) / 100).toFixed(1)} ${c.unit ?? "N"} · a ${c.b ? (c.a === p ? c.b.id : c.a.id) : "base"}`).join("\n")}\nMáximos históricos de paredes: ${(replayStats ?? experiment.stats).maxDisplacement.toFixed(2)} m / ${(replayStats ?? experiment.stats).maxTilt.toFixed(1)}°.`;
  }
  function pieces() {
    const previous = $("inspect-piece").value;
    $("inspect-piece").replaceChildren(
      ...(owner()?.simulation.pieces ?? []).map(
        (p) =>
          new Option(
            `${p.entityId ? p.entityId + " · " : ""}#${p.id} · ${labels[p.kind]}`,
            String(p.id),
          ),
      ),
    );
    if ([...$("inspect-piece").options].some((o) => o.value === previous))
      $("inspect-piece").value = previous;
    inspectDetail();
  }
  function populate() {
    $("export-parcels").disabled = !snapshot.layout;
    $("export-environment").disabled = !snapshot.results.environment;
    houses($("event-house"), true);
    houses($("inspect-house"));
    $("damage-chart").innerHTML = damageChart(snapshot);
    events();
    pieces();
    const c = experiment.config;
    $("run-conditions").textContent =
      `Base A: ${c.mode} · ${PROFILES[c.profile].label} · ${ROOFS[c.roof].label} · ${c.wind} km/h · radio ${c.radius} m · refuerzo ${c.reinforcement} % · ${c.distribution} · separación ${c.spacing} m · ${c.trajectory}.`;
    if (c.mode === "neighborhood")
      $("run-conditions").textContent =
        `Barrio: ${c.rows} × ${c.columns} parcelas · semilla ${c.seed} · parcela ${c.lotSize} m · calles ${c.roadWidth} m · orientación ${c.orientation}° · ${PROFILES[c.profile].label} / ${ROOFS[c.roof].label} · ocupación residencial ${c.density} %, verdes ${c.greenPercent} %, reservas ${c.buildingPercent} % · ${c.wind} km/h · radio ${c.radius} m · refuerzo A ${c.reinforcement} %.`;
    if (c.sitePlan)
      $("run-conditions").textContent =
        `Plano manual: ${c.rows} × ${c.columns} parcelas, propiedades por objeto conservadas · ${c.wind} km/h · radio ${c.radius} m · refuerzo A ${c.reinforcement} %.`;
    for (const option of $("run-variable").options)
      option.disabled =
        !!c.sitePlan &&
        ["distribution", "roof", "lotSize"].includes(option.value);
    if ($("run-variable").selectedOptions[0]?.disabled) {
      $("run-variable").value = "reinforcement";
      choices();
    }
    $("verify-run").disabled = !snapshot.steps;
  }
  $("notebook-open").addEventListener(
    "click",
    attempt(async () => {
      pause();
      pauseReplay();
      snapshot = current();
      populate();
      $("notebook-dialog").showModal();
      await library();
    }),
  );
  $("notebook-close").addEventListener("click", () =>
    $("notebook-dialog").close(),
  );
  const tabs = [...document.querySelectorAll(".notebook-tabs [role=tab]")];
  function tab(selected) {
    tabs.forEach((t) => {
      const active = t === selected;
      t.setAttribute("aria-selected", String(active));
      t.tabIndex = active ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !active;
    });
  }
  tabs.forEach((t, i) => {
    t.tabIndex = i ? -1 : 0;
    t.addEventListener("click", () => tab(t));
    t.addEventListener("keydown", (e) => {
      let n;
      if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
      if (e.key === "ArrowLeft") n = (i + tabs.length - 1) % tabs.length;
      if (e.key === "Home") n = 0;
      if (e.key === "End") n = tabs.length - 1;
      if (n !== undefined) {
        e.preventDefault();
        tab(tabs[n]);
        tabs[n].focus();
      }
    });
  });
  $("experiment-save").addEventListener(
    "click",
    attempt(async () => {
      const id = await saveEntry(current());
      await library(id);
      status("Ejecución guardada en la biblioteca de este navegador.");
    }),
  );
  $("library-load").addEventListener(
    "click",
    attempt(async () => load((await selected()).record)),
  );
  $("configuration-save").addEventListener(
    "click",
    attempt(async () => {
      const id = await saveEntry(
        configurationDocument(experiment.config, name()),
      );
      await library(id);
      status(
        "Configuración guardada en la biblioteca, para comenzar desde cero.",
      );
    }),
  );
  $("library-copy").addEventListener(
    "click",
    attempt(async () => {
      const { record } = await selected();
      record.name = normalizeName(record.name + " · copia");
      const id = await saveEntry(record);
      await library(id);
      status("Copia guardada.");
    }),
  );
  $("library-rename").addEventListener(
    "click",
    attempt(async () => {
      const { id, record } = await selected();
      record.name = name();
      await saveEntry(record, id);
      await library(id);
      status(
        "Nombre actualizado con el texto del campo Nombre del experimento.",
      );
    }),
  );
  $("experiment-file").addEventListener(
    "change",
    attempt(async () => {
      const file = $("experiment-file").files[0];
      if (!file) return;
      try {
        if (file.size > MAX_FILE_BYTES)
          throw new Error("El archivo supera 40 MB.");
        load(parseDocument(await file.text()));
      } finally {
        $("experiment-file").value = "";
      }
    }),
  );
  $("export-config").addEventListener(
    "click",
    attempt(() =>
      download(
        `${filename(name())}-config.json`,
        JSON.stringify(
          configurationDocument(experiment.config, name()),
          null,
          2,
        ),
        "application/json",
      ),
    ),
  );
  $("export-run").addEventListener(
    "click",
    attempt(() =>
      download(
        `${filename(name())}-ejecucion.json`,
        JSON.stringify(current()),
        "application/json",
      ),
    ),
  );
  $("export-results").addEventListener(
    "click",
    attempt(() =>
      download(
        `${filename(name())}-viviendas.csv`,
        resultsCSV(current()),
        "text/csv;charset=utf-8",
      ),
    ),
  );
  $("export-events").addEventListener(
    "click",
    attempt(() =>
      download(
        `${filename(name())}-eventos.csv`,
        eventsCSV(current()),
        "text/csv;charset=utf-8",
      ),
    ),
  );
  $("export-environment").addEventListener(
    "click",
    attempt(() =>
      download(
        `${filename(name())}-objetos.csv`,
        environmentCSV(current()),
        "text/csv;charset=utf-8",
      ),
    ),
  );
  $("export-parcels").addEventListener(
    "click",
    attempt(() =>
      download(
        `${filename(name())}-parcelas.csv`,
        parcelsCSV(current()),
        "text/csv;charset=utf-8",
      ),
    ),
  );
  $("export-components").addEventListener(
    "click",
    attempt(() => {
      const r = current(),
        final = new Experiment(r.initial, { record: false });
      applyFrame(final, r, r.frames.length - 1);
      download(
        `${filename(name())}-piezas.csv`,
        componentsCSV(r, final),
        "text/csv;charset=utf-8",
      );
    }),
  );
  $("export-report").addEventListener(
    "click",
    attempt(() => {
      const v = getView();
      v.render();
      download(
        `${filename(name())}-informe.html`,
        htmlReport(current(), v.canvas.toDataURL("image/png")),
        "text/html;charset=utf-8",
      );
      status(
        "Informe exportado. La imagen corresponde a la vista al exportar; las tablas, al final de la ejecución.",
      );
    }),
  );
  $("generate-link").addEventListener(
    "click",
    attempt(() => {
      $("experiment-link").value = shareLink(
        location.href,
        experiment.config,
        name(),
      );
      $("experiment-link").select();
      status(
        "Enlace preparado para copiar. Comparte los parámetros actuales y comienza desde cero.",
      );
    }),
  );
  for (const id of ["event-house", "event-type"])
    $(id).addEventListener("change", events);
  $("event-list").addEventListener("change", eventDetail);
  $("event-view").addEventListener(
    "click",
    attempt(() => {
      const e = snapshot.events.find((e) => e.id === $("event-list").value);
      if (!e) return;
      enterReplay({ ...snapshot, name: name() }, e.step);
      $("notebook-dialog").close();
      $("replay-description").textContent +=
        ` Evento ${e.id}: ${seconds(e.time)}; se muestra el siguiente fotograma disponible.`;
    }),
  );
  $("inspect-house").addEventListener("change", pieces);
  $("inspect-piece").addEventListener("change", inspectDetail);
  $("inspect-focus").addEventListener("click", () => {
    const p = piece(),
      v = getView();
    if (!p || !v) return;
    const { x, y, z } = p.body.position;
    v.controls.target.set(x, y, z);
    v.camera.position.set(x + 8, y + 7, z + 10);
    v.controls.update();
    $("notebook-dialog").close();
  });
  $("replay-position").addEventListener("input", () => {
    playing = false;
    seek(Number($("replay-position").value));
    $("replay-play").textContent = "Reproducir grabación";
  });
  $("replay-first").addEventListener("click", () => {
    playing = false;
    seek(0);
    $("replay-play").textContent = "Reproducir grabación";
  });
  $("replay-play").addEventListener("click", () => {
    if (
      !playing &&
      Number($("replay-position").value) === replay.frames.length - 1
    )
      seek(0);
    playing = !playing;
    $("replay-play").textContent = playing
      ? "Pausar grabación"
      : "Reproducir grabación";
  });
  $("replay-exit").addEventListener("click", () => exitReplay());

  const variables = {
    lotSize: [
      [12, "12 m"],
      [16, "16 m"],
      [20, "20 m"],
    ],
    orientation: Array.from({ length: 8 }, (_, i) => [i * 45, `${i * 45}°`]),
    reinforcement: [
      [50, "50 %"],
      [100, "100 %"],
      [150, "150 %"],
      [200, "200 %"],
    ],
    distribution: [
      ["mixed", "Mezcla ilustrativa"],
      ["uniform", "Uniforme"],
    ],
    spacing: [
      [10, "10 m"],
      [13, "13 m"],
      [16, "16 m"],
    ],
    roof: Object.values(ROOFS).map((r) => [r.id, r.label]),
    trajectory: [
      ["diagonal", "Diagonal"],
      ["horizontal", "Oeste → este"],
      ["vertical", "Sur → norte"],
    ],
  };
  function choices() {
    $("run-value").replaceChildren(
      ...variables[$("run-variable").value].map(
        ([v, label]) => new Option(label, String(v)),
      ),
    );
    if ($("run-variable").value === "reinforcement")
      $("run-value").value = "150";
  }
  $("run-variable").addEventListener("change", choices);
  choices();
  function finish(message) {
    calculation?.terminate();
    calculation = null;
    $("compare-runs").disabled = false;
    $("verify-run").disabled = !snapshot?.steps;
    $("cancel-run").hidden = true;
    $("runs-progress").textContent = message;
  }
  function start(message) {
    if (calculation) return;
    const w = new Worker(new URL("./runs.worker.js", import.meta.url), {
      type: "module",
    });
    calculation = w;
    $("compare-runs").disabled = true;
    $("verify-run").disabled = true;
    $("cancel-run").hidden = false;
    $("runs-progress").textContent = "Calculando…";
    $("runs-results").replaceChildren();
    w.onmessage = ({ data }) => {
      if (calculation !== w) return;
      if (data.type === "progress")
        $("runs-progress").textContent = data.message;
      if (data.type === "error") finish(data.message);
      if (data.type === "recalculated") {
        const diff = differences(message.record.results, data.stats);
        finish(
          diff.length
            ? `Recálculo terminado: diferencias en ${diff.slice(0, 8).join(", ")}. Los resultados importados no se modificaron.`
            : "Recálculo terminado: todas las métricas coinciden con los resultados guardados (tolerancia numérica 1e-6 relativa).",
        );
      }
      if (data.type === "compared") {
        comparison = data.results;
        comparisonKey = message.key;
        renderResults();
        $("export-comparison").disabled = false;
        finish(
          "Comparación terminada: dos escenarios desde cero, con una sola condición diferente.",
        );
      }
    };
    w.onerror = () =>
      finish("No se pudo completar el cálculo en segundo plano.");
    w.postMessage(message);
  }
  function renderResults() {
    const table = document.createElement("table"),
      head = document.createElement("tr");
    for (const title of [
      "Escenario / casa",
      "Cubierta",
      "Paredes sin soporte",
      "Uniones",
      "Estado",
    ]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = title;
      head.append(th);
    }
    table.append(head);
    for (const result of comparison) {
      for (const s of [
        { ...result.stats, label: "Conjunto" },
        ...(result.stats.rows ?? []),
      ]) {
        const tr = document.createElement("tr");
        for (const value of [
          `${result.label} · ${s.label} · ${[...$("run-variable").options].find((o) => o.value === comparisonKey).textContent}: ${variables[comparisonKey].find(([v]) => v === result.config[comparisonKey])[1]}`,
          `${s.detached}/${s.total}`,
          `${s.wallDetached}/${s.wallTotal}`,
          `${s.broken}/${s.connectionTotal}`,
          s.state,
        ]) {
          const td = document.createElement("td");
          td.textContent = value;
          tr.append(td);
        }
        table.append(tr);
      }
    }
    $("runs-results").replaceChildren(table);
    if (comparison.some((r) => r.stats.environment)) {
      const title = document.createElement("h3");
      title.textContent = "Objetos urbanos";
      const extra = document.createElement("table"),
        head = document.createElement("tr");
      for (const text of [
        "Escenario",
        "Objeto",
        "Parcela",
        "Piezas liberadas",
        "Estado",
      ]) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = text;
        head.append(th);
      }
      extra.append(head);
      for (const r of comparison)
        for (const row of r.stats.environment?.rows ?? []) {
          const tr = document.createElement("tr");
          for (const value of [
            r.label,
            row.id,
            row.parcelId,
            `${row.detached}/${row.total}`,
            row.state,
          ]) {
            const td = document.createElement("td");
            td.textContent = value;
            tr.append(td);
          }
          extra.append(tr);
        }
      $("runs-results").append(title, extra);
    }
  }
  $("compare-runs").addEventListener(
    "click",
    attempt(() => {
      const key = $("run-variable").value,
        value = ["reinforcement", "spacing", "lotSize", "orientation"].includes(
          key,
        )
          ? Number($("run-value").value)
          : $("run-value").value;
      const config = cleanConfig(experiment.config);
      if (key === "spacing" && config.mode === "neighborhood")
        throw new Error(
          "En un barrio configurable, compara el lado de parcela en lugar de la separación fija.",
        );
      if (
        ["lotSize", "orientation"].includes(key) &&
        config.mode !== "neighborhood"
      )
        throw new Error("Esta condición requiere un barrio configurable.");
      cleanConfig({ ...config, [key]: value });
      if (
        config.mode === "single" &&
        ["distribution", "spacing", "trajectory"].includes(key)
      )
        throw new Error("Esta condición requiere seleccionar una manzana.");
      if (config[key] === value)
        throw new Error("Elige para B un valor diferente al de A.");
      start({
        kind: "compare",
        config,
        key,
        value,
        seconds: Number($("run-seconds").value),
      });
    }),
  );
  $("verify-run").addEventListener(
    "click",
    attempt(() => {
      snapshot = current();
      if (!snapshot.steps) throw new Error("Primero ejecuta la simulación.");
      start({
        kind: "recalculate",
        record: {
          initial: snapshot.initial,
          changes: snapshot.changes,
          steps: snapshot.steps,
          results: snapshot.results,
        },
      });
    }),
  );
  $("cancel-run").addEventListener("click", () => finish("Cálculo cancelado."));
  $("export-comparison").addEventListener("click", () => {
    if (!comparison) return;
    const rows = [
      [
        "escenario",
        "vivienda",
        "configuracion_JSON",
        "cubierta_desprendida",
        "cubierta_total",
        "paredes_sin_soporte",
        "paredes_total",
        "uniones_falladas",
        "tiempo_s",
        "estado",
        "tipo_resultado",
        "objeto_urbano",
        "parcela",
        "piezas_liberadas",
        "piezas_total",
      ],
    ];
    for (const r of comparison)
      for (const s of [
        { ...r.stats, label: "Conjunto" },
        ...(r.stats.rows ?? []),
      ])
        rows.push([
          r.label,
          s.label,
          JSON.stringify(r.config),
          s.detached,
          s.total,
          s.wallDetached,
          s.wallTotal,
          s.broken,
          s.elapsed,
          s.state,
          "vivienda",
          "",
          s.parcelId ?? "",
          "",
          "",
        ]);
    for (const r of comparison)
      for (const row of r.stats.environment?.rows ?? [])
        rows.push([
          r.label,
          "",
          JSON.stringify(r.config),
          "",
          "",
          "",
          "",
          "",
          r.stats.elapsed,
          row.state,
          "entorno",
          row.id,
          row.parcelId,
          row.detached,
          row.total,
        ]);
    download("simtorcl-comparacion.csv", csv(rows), "text/csv;charset=utf-8");
  });
  $("notebook-dialog").addEventListener("close", () => {
    if (calculation) finish("Cálculo cancelado al cerrar el cuaderno.");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      playing = false;
      $("replay-play").textContent = "Reproducir grabación";
    }
  });
  function loadLink() {
    try {
      const shared = parseShareHash(location.hash);
      if (shared) {
        resetConfig(shared.config);
        $("experiment-name").value = shared.name;
        status("Configuración del enlace cargada desde cero.");
      }
    } catch (error) {
      status(error.message);
    }
  }
  window.addEventListener("hashchange", loadLink);
  loadLink();
  return {
    get replayStats() {
      return replayStats;
    },
    get replaying() {
      return !!replay;
    },
    pauseReplay,
    beforeReset() {
      exitReplay(false);
    },
    advanceReplay(dt) {
      if (!playing || !replay) return;
      const target = replayTime + dt;
      let index = Number($("replay-position").value);
      while (
        index + 1 < replay.frames.length &&
        replay.frames[index + 1].step * FIXED_STEP <= target
      )
        index++;
      if (index !== Number($("replay-position").value)) seek(index);
      replayTime = target;
      if (index === replay.frames.length - 1) {
        playing = false;
        $("replay-play").textContent = "Reproducir grabación";
      }
    },
    refresh() {
      const real = replay ? replay.realSeconds : experiment.realSeconds,
        sim = replay ? replay.steps * FIXED_STEP : experiment.elapsed;
      $("active-clock").textContent =
        `Tiempo real activo: ${seconds(real)} · ritmo medio ${real ? (sim / real).toFixed(2) : "—"}×${replay ? " · ejecución grabada" : ""}`;
    },
    dispose() {
      calculation?.terminate();
      window.removeEventListener("hashchange", loadLink);
    },
  };
}
