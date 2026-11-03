import { EditorState } from "./editor-state.js";
import { Experiment } from "./district.js";
import { SceneView } from "./scene.js";
import { PROFILES, ROOFS } from "./catalog.js";
import { configurationDocument, normalizeName } from "./records.js";
import { saveEntry } from "./library.js";

const $ = (id) => document.getElementById(id);
const names = {
  house: "Casa",
  building: "Edificio",
  green: "Parque",
  vacant: "Libre",
};
const icons = { house: "⌂", building: "▥", green: "♣", vacant: "+" };

export function setupEditor({ experiment, pause, reset, isReplaying }) {
  const dialog = $("editor-dialog"),
    canvas = $("editor-scene");
  const palette = [...document.querySelectorAll("[data-editor-type]")];
  let draft,
    preview,
    view,
    frame,
    selected,
    operation = { action: "select" },
    pointer,
    nativeDrag,
    applying = false;
  const say = (text) => {
    $("editor-status").textContent = text;
  };
  const chosen = () => draft?.at(selected);
  function topView() {
    if (!view) return;
    const bounds = draft.layout.bounds;
    const tangent = Math.tan((view.camera.fov * Math.PI) / 360);
    const height =
      (Math.max(bounds.depth, bounds.width / view.camera.aspect) /
        (2 * tangent)) *
      1.15;
    view.camera.position.set(0, height, 0.01);
    view.controls.target.set(0, 0, 0);
    view.controls.update();
  }
  const attempt =
    (fn) =>
    (...args) => {
      try {
        fn(...args);
      } catch (error) {
        say(error.message);
      }
    };
  function tools(next = { action: "select" }) {
    operation = next;
    if (view) view.controls.enabled = next.action === "orbit";
    canvas.style.cursor =
      next.action === "orbit"
        ? "grab"
        : next.action === "select"
          ? "default"
          : "crosshair";
    palette.forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(next.action === "place" && next.type === b.dataset.editorType),
      ),
    );
    $("editor-select").setAttribute(
      "aria-pressed",
      String(next.action === "select"),
    );
    $("editor-orbit").setAttribute(
      "aria-pressed",
      String(next.action === "orbit"),
    );
  }
  function roofs(profile, current) {
    $("editor-roof").replaceChildren(
      ...PROFILES[profile].roofs.map((id) => new Option(ROOFS[id].label, id)),
    );
    $("editor-roof").value = PROFILES[profile].roofs.includes(current)
      ? current
      : PROFILES[profile].defaultRoof;
  }
  function selection() {
    const obj = chosen();
    $("editor-selected").textContent = selected
      ? `${selected} · ${obj ? `${names[obj.type]} · ${obj.id}` : "Parcela libre"}`
      : "Selecciona una parcela.";
    for (const id of ["move", "duplicate", "rotate", "remove"])
      $("editor-" + id).disabled = !obj;
    $("editor-properties-form").hidden = !obj;
    $("editor-house-fields").hidden = obj?.type !== "house";
    $("editor-building-fields").hidden = obj?.type !== "building";
    if (obj) {
      $("editor-rotation").value = obj.rotation;
      if (obj.type === "house") {
        $("editor-profile").value = obj.profile;
        roofs(obj.profile, obj.roof);
      }
      if (obj.type === "building") $("editor-floors").value = obj.floors;
    }
    for (const b of $("editor-grid").children)
      b.setAttribute("aria-pressed", String(b.dataset.parcel === selected));
    view?.highlightParcel(selected);
  }
  function grid() {
    $("editor-grid").style.setProperty("--editor-columns", draft.base.columns);
    $("editor-grid").replaceChildren(
      ...draft.layout.parcels.map((p) => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.parcel = p.id;
        b.dataset.type = p.type;
        b.setAttribute("aria-label", `${p.id} · ${names[p.type]}`);
        const icon = document.createElement("span"),
          label = document.createElement("small");
        icon.textContent = icons[p.type];
        icon.setAttribute("aria-hidden", "true");
        label.textContent = p.id;
        b.append(icon, label);
        b.draggable = p.type !== "vacant";
        b.addEventListener("click", () => {
          activate(p.id);
          $("editor-grid")
            .querySelector(`[data-parcel="${p.id}"]`)
            ?.focus({ preventScroll: true });
        });
        b.addEventListener("dragstart", (event) =>
          beginNative(event, { action: "move", id: draft.at(p.id).id }),
        );
        b.addEventListener("dragend", endNative);
        b.addEventListener("dragover", (event) => hoverNative(event, p.id));
        b.addEventListener("drop", (event) => dropNative(event, p.id));
        b.addEventListener("keydown", (event) => {
          const offsets = {
            ArrowRight: 1,
            ArrowLeft: -1,
            ArrowDown: draft.base.columns,
            ArrowUp: -draft.base.columns,
          };
          if (!(event.key in offsets)) return;
          event.preventDefault();
          const children = [...$("editor-grid").children],
            index = children.indexOf(b);
          children[
            Math.max(
              0,
              Math.min(children.length - 1, index + offsets[event.key]),
            )
          ].focus();
        });
        return b;
      }),
    );
  }
  function render(rebuild = true) {
    if (rebuild) {
      preview.reset(draft.config);
      view.sync();
      grid();
      view.vortex.visible = false;
      view.influence.visible = false;
      view.rain.visible = false;
    }
    const c = draft.layout.counts;
    const count = (n, singular, plural) =>
      `${n} ${n === 1 ? singular : plural}`;
    $("editor-summary").textContent =
      `${count(c.house, "casa", "casas")} · ${count(c.building, "edificio", "edificios")} · ${count(c.green, "parque", "parques")} · ${count(c.vacant, "parcela libre", "parcelas libres")}. Cuadrícula sintética ${draft.base.rows} × ${draft.base.columns}.`;
    $("editor-undo").disabled = !draft.past.length;
    $("editor-redo").disabled = !draft.future.length;
    selection();
  }
  function commit(command, parcelId) {
    if (!parcelId) {
      say(
        "Elige una parcela del plano. Las calles y el exterior no admiten colocación.",
      );
      return;
    }
    try {
      const changed = draft.execute(command.action, { ...command, parcelId });
      selected = parcelId;
      if (command.action !== "place") tools();
      render(changed);
      say(
        changed
          ? `${names[draft.at(parcelId)?.type] ?? "Objeto"} en ${parcelId}. Cambio guardado en el borrador; puedes deshacerlo.`
          : `${parcelId} seleccionada.`,
      );
    } catch (error) {
      view?.highlightParcel(parcelId, "invalid");
      say(error.message);
    }
  }
  function activate(parcelId) {
    if (["place", "move", "duplicate"].includes(operation.action))
      commit(operation, parcelId);
    else {
      selected = parcelId;
      selection();
      say(
        `${parcelId} · ${names[chosen()?.type ?? "vacant"]}. Elige una acción o una infraestructura.`,
      );
    }
  }
  function hover(parcelId, command) {
    const occupied = parcelId && draft.at(parcelId);
    const allowed =
      !!parcelId &&
      (!occupied || (command.action === "move" && occupied.id === command.id));
    view?.highlightParcel(parcelId, allowed ? "valid" : "invalid");
    say(
      !parcelId
        ? "Fuera de parcela: no se colocará el objeto."
        : allowed
          ? `${parcelId} · destino disponible. Suelta para colocar.`
          : `${parcelId} ocupada · el objeto anterior se conserva.`,
    );
  }
  function beginNative(event, command) {
    nativeDrag = command;
    event.dataTransfer.effectAllowed =
      command.action === "move" ? "move" : "copy";
    event.dataTransfer.setData("text/plain", "SimTorCL: infraestructura");
  }
  function endNative() {
    nativeDrag = null;
    view?.highlightParcel(selected);
  }
  function hoverNative(event, parcelId) {
    if (!nativeDrag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect =
      nativeDrag.action === "move" ? "move" : "copy";
    hover(parcelId, nativeDrag);
  }
  function dropNative(event, parcelId) {
    if (!nativeDrag) return;
    event.preventDefault();
    commit(nativeDrag, parcelId);
    nativeDrag = null;
  }
  for (const b of palette) {
    b.addEventListener("click", () => {
      tools({ action: "place", type: b.dataset.editorType });
      say(
        `${names[b.dataset.editorType]} elegida. Toca una parcela libre o arrastra desde la paleta.`,
      );
    });
    b.addEventListener("dragstart", (event) =>
      beginNative(event, { action: "place", type: b.dataset.editorType }),
    );
    b.addEventListener("dragend", endNative);
  }
  canvas.addEventListener("dragover", (event) =>
    hoverNative(event, view?.pickParcel(event.clientX, event.clientY, false)),
  );
  canvas.addEventListener("drop", (event) =>
    dropNative(event, view?.pickParcel(event.clientX, event.clientY, false)),
  );
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (!view || operation.action === "orbit" || event.button !== 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const parcelId = view.pickParcel(event.clientX, event.clientY);
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        parcelId,
        object: draft.at(parcelId),
        dragging: false,
      };
      canvas.setPointerCapture(event.pointerId);
    },
    true,
  );
  canvas.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (
      Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6 &&
      !pointer.dragging
    )
      return;
    pointer.dragging = true;
    const command =
      operation.action === "select" && pointer.object
        ? { action: "move", id: pointer.object.id }
        : operation;
    if (["place", "move", "duplicate"].includes(command.action))
      hover(view.pickParcel(event.clientX, event.clientY, false), command);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const start = pointer;
    pointer = null;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    if (start.dragging && operation.action === "select" && start.object)
      commit(
        { action: "move", id: start.object.id },
        view.pickParcel(event.clientX, event.clientY, false),
      );
    else if (!start.dragging || operation.action !== "select")
      activate(view.pickParcel(event.clientX, event.clientY, !start.dragging));
  });
  canvas.addEventListener("pointercancel", () => {
    pointer = null;
    view?.highlightParcel(selected);
    say("Movimiento cancelado; el borrador se conserva.");
  });
  $("editor-profile").replaceChildren(
    ...Object.values(PROFILES).map((p) => new Option(p.label, p.id)),
  );
  $("editor-profile").addEventListener("change", () =>
    roofs($("editor-profile").value, $("editor-roof").value),
  );
  $("editor-properties-form").addEventListener("submit", (event) => {
    event.preventDefault();
    attempt(() => {
      const obj = chosen();
      if (!obj) return;
      draft.execute("properties", {
        id: obj.id,
        rotation: Number($("editor-rotation").value),
        ...(obj.type === "house"
          ? { profile: $("editor-profile").value, roof: $("editor-roof").value }
          : {}),
        ...(obj.type === "building"
          ? { floors: Number($("editor-floors").value) }
          : {}),
      });
      render();
      say("Propiedades actualizadas en el borrador.");
    })();
  });
  for (const command of ["move", "duplicate"])
    $("editor-" + command).addEventListener("click", () => {
      if (!chosen()) return;
      tools({ action: command, id: chosen().id });
      say(
        `${command === "move" ? "Mover" : "Duplicar"} ${chosen().id}: elige una parcela libre.`,
      );
    });
  for (const command of ["rotate", "remove"])
    $("editor-" + command).addEventListener(
      "click",
      attempt(() => {
        draft.execute(command, { id: chosen()?.id });
        tools();
        render();
        say(
          command === "rotate"
            ? "Objeto girado 90°."
            : "Objeto eliminado del borrador. Puedes deshacer.",
        );
      }),
    );
  for (const command of ["undo", "redo"])
    $("editor-" + command).addEventListener("click", () => {
      draft[command]();
      tools();
      render();
      say(
        command === "undo" ? "Último cambio deshecho." : "Cambio recuperado.",
      );
    });
  $("editor-select").addEventListener("click", () => {
    tools();
    say("Selecciona una parcela o arrastra un objeto a una parcela libre.");
  });
  $("editor-orbit").addEventListener("click", () => {
    tools({ action: "orbit" });
    say("Arrastra para girar la cámara. Vuelve a Seleccionar para editar.");
  });
  $("editor-top").addEventListener("click", topView);
  $("editor-perspective").addEventListener("click", () =>
    view?.setView("perspective"),
  );
  function cleanup() {
    cancelAnimationFrame(frame);
    pointer = null;
    nativeDrag = null;
    if (view) {
      view.dispose();
    }
    view = null;
    preview = null;
  }
  function open() {
    if (isReplaying()) return;
    pause();
    const base =
      experiment.config.mode === "neighborhood"
        ? experiment.config
        : {
            ...experiment.config,
            mode: "neighborhood",
            rows: 2,
            columns: 3,
            density: 50,
            greenPercent: 25,
            buildingPercent: 25,
            sitePlan: null,
          };
    const settings = {
      ...base,
      ...(base.distribution === "mixed" && base.roof === "slab"
        ? { roof: "metal" }
        : {}),
    };
    try {
      draft = new EditorState(settings);
      selected = null;
      $("editor-replace").hidden = true;
      $("editor-apply").disabled = false;
      dialog.showModal();
      preview = new Experiment(draft.config, { record: false });
      view = new SceneView(canvas, preview);
      topView();
      tools();
      grid();
      render(false);
      view.vortex.visible = false;
      view.influence.visible = false;
      view.rain.visible = false;
      const animate = () => {
        if (!dialog.open || !view) return;
        view.render();
        frame = requestAnimationFrame(animate);
      };
      animate();
      say(
        "Borrador independiente. Elige una infraestructura o selecciona una parcela; tu experimento permanece intacto.",
      );
    } catch (error) {
      cleanup();
      if (dialog.open) dialog.close();
      $("editor-open-note").textContent =
        `No se pudo abrir el editor: ${error.message}`;
    }
  }
  $("editor-open").addEventListener("click", open);
  $("editor-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => {
    if (applying) event.preventDefault();
  });
  dialog.addEventListener(
    "click",
    (event) => {
      if (applying && event.target === dialog) event.stopImmediatePropagation();
    },
    true,
  );
  dialog.addEventListener("close", cleanup);
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && operation.action !== "select") {
      event.preventDefault();
      pointer = null;
      tools();
      selection();
      say(
        "Herramienta cancelada. Pulsa Escape de nuevo para cerrar el borrador.",
      );
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "z" &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)
    ) {
      event.preventDefault();
      event.stopPropagation();
      draft[event.shiftKey ? "redo" : "undo"]();
      tools();
      render();
    }
  });
  const designDocument = () =>
    configurationDocument(draft.config, $("editor-name").value);
  $("editor-save").addEventListener("click", async () => {
    $("editor-save").disabled = true;
    try {
      await saveEntry(designDocument());
      say(
        "Diseño guardado en la biblioteca local. También puedes descargar su JSON.",
      );
    } catch (error) {
      say(error.message);
    } finally {
      $("editor-save").disabled = false;
    }
  });
  $("editor-export").addEventListener(
    "click",
    attempt(() => {
      const record = designDocument(),
        url = URL.createObjectURL(
          new Blob([JSON.stringify(record, null, 2)], {
            type: "application/json",
          }),
        );
      const a = window.document.createElement("a");
      a.href = url;
      a.download =
        normalizeName(record.name).replace(/[^\p{L}\p{N}_-]+/gu, "_") + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(
        "Diseño exportado. Incluye parcelas, objetos y propiedades para reconstruirlo.",
      );
    }),
  );
  async function apply(backup = false) {
    if (applying) return;
    applying = true;
    $("editor-close").disabled = true;
    dialog.querySelector(".editor-layout").inert = true;
    dialog.querySelector(".editor-save").inert = true;
    $("editor-keep-editing").disabled = true;
    for (const id of [
      "editor-apply",
      "editor-backup-apply",
      "editor-discard-apply",
    ])
      $(id).disabled = true;
    try {
      const config = draft.config;
      if (backup)
        await saveEntry(
          experiment.document("Antes de editar · " + $("editor-name").value),
        );
      reset(config);
      dialog.close();
      $("editor-open-note").textContent =
        "Tu manzana está lista. Ajusta el viento e inicia la simulación; revisa los resultados en el cuaderno.";
    } catch (error) {
      say(error.message);
    } finally {
      applying = false;
      $("editor-close").disabled = false;
      dialog.querySelector(".editor-layout").inert = false;
      dialog.querySelector(".editor-save").inert = false;
      $("editor-keep-editing").disabled = false;
      for (const id of [
        "editor-apply",
        "editor-backup-apply",
        "editor-discard-apply",
      ])
        $(id).disabled = false;
    }
  }
  $("editor-apply").addEventListener("click", () => {
    if (experiment.steps) {
      $("editor-replace").hidden = false;
      say(
        "Elige cómo conservar los resultados anteriores antes de aplicar el diseño.",
      );
      $("editor-backup-apply").focus();
    } else apply();
  });
  $("editor-backup-apply").addEventListener("click", () => apply(true));
  $("editor-discard-apply").addEventListener("click", () => apply());
  $("editor-keep-editing").addEventListener("click", () => {
    $("editor-replace").hidden = true;
    say("Continúas editando el borrador; tu ejecución sigue intacta.");
  });
  return { dispose: cleanup };
}
