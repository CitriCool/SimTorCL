import { EditorState } from "./editor-state.js";
import { Experiment } from "./district.js";
import { SceneView } from "./scene.js";
import { PROFILES, ROOFS } from "./catalog.js";
import { configurationDocument, normalizeName } from "./records.js";
import { saveEntry } from "./library.js";
import { LESSONS, lessonConfig } from "./lessons.js";

const $ = (id) => document.getElementById(id);
const names = {
  house: "Casa",
  building: "Edificio",
  green: "Parque",
  vacant: "Libre",
  tree: "Árbol",
  bench: "Banca",
};
const icons = {
  house: "⌂",
  building: "▥",
  green: "♣",
  vacant: "+",
  tree: "♧",
  bench: "▰",
};

export function setupEditor({ experiment, pause, reset, isReplaying }) {
  const dialog = $("editor-dialog"),
    canvas = $("editor-scene");
  const palette = [...document.querySelectorAll("[data-editor-type]")];
  let draft,
    preview,
    view,
    frame,
    selected,
    selectedObject,
    operation = { action: "select" },
    pointer,
    nativeDrag,
    topCamera = false,
    applying = false;
  const say = (text) => {
    $("editor-status").textContent = text;
  };
  const chosen = () =>
    draft?.find(selectedObject) ??
    draft?.at(selected) ??
    draft?.plan.items.find((i) => i.parcelId === selected);
  const slotAt = (parcelId, point) => {
    const p = draft.layout.parcels.find((p) => p.id === parcelId);
    if (!p || !point) return Number($("editor-slot").value);
    const col = Math.max(
      0,
      Math.min(2, Math.round((point.x - p.x) / (p.size * 0.3)) + 1),
    );
    const row = Math.max(
      0,
      Math.min(2, Math.round((point.z - p.z) / (p.size * 0.3)) + 1),
    );
    return row * 3 + col;
  };
  function topView() {
    if (!view) return;
    topCamera = true;
    const bounds = draft.layout.bounds;
    const tangent = Math.tan((view.camera.fov * Math.PI) / 360);
    const height =
      (Math.max(bounds.depth, bounds.width / view.camera.aspect) /
        (2 * tangent)) *
      1.15;
    view.controls.maxDistance = Math.max(
      view.controls.maxDistance,
      height * 1.2,
    );
    view.camera.far = Math.max(
      view.camera.far,
      height + draft.layout.bounds.depth,
    );
    view.camera.updateProjectionMatrix();
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
    if (next.action === "orbit") topCamera = false;
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
        String(
          ["place", "place-item"].includes(next.action) &&
            next.type === b.dataset.editorType,
        ),
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
    $("editor-route-draw").setAttribute(
      "aria-pressed",
      String(next.action === "route-point"),
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
    if (obj) {
      selected = obj.parcelId;
      selectedObject = obj.id;
    }
    $("editor-selected").textContent = selected
      ? `${selected} · ${obj ? `${names[obj.type]} · ${obj.id}` : "Parcela libre"}`
      : "Selecciona una parcela.";
    for (const id of ["move", "duplicate", "rotate", "remove"])
      $("editor-" + id).disabled = !obj;
    $("editor-properties-form").hidden = !obj;
    $("editor-house-fields").hidden = obj?.type !== "house";
    $("editor-building-fields").hidden = obj?.type !== "building";
    $("editor-tree-fields").hidden = obj?.type !== "tree";
    const members = [
      ...(draft.at(selected) ? [draft.at(selected)] : []),
      ...draft.plan.items.filter((i) => i.parcelId === selected),
    ];
    $("editor-object-list").replaceChildren(
      ...(members.length
        ? members.map(
            (o) =>
              new Option(
                `${names[o.type]} · ${o.id}${o.slot !== undefined ? " · punto " + (o.slot + 1) : ""}`,
                o.id,
              ),
          )
        : [new Option("Sin objetos", "")]),
    );
    if (obj) $("editor-object-list").value = obj.id;
    if (obj) {
      $("editor-rotation").value = obj.rotation;
      if (obj.type === "house") {
        $("editor-profile").value = obj.profile;
        roofs(obj.profile, obj.roof);
      }
      if (obj.type === "building") $("editor-floors").value = obj.floors;
      if (obj.type === "tree") $("editor-anchorage").value = obj.anchorage;
      if (obj.slot !== undefined) $("editor-slot").value = obj.slot;
    }
    for (const b of $("editor-grid").children)
      b.setAttribute("aria-pressed", String(b.dataset.parcel === selected));
    view?.highlightParcel(selected, "selected", obj?.slot ?? null);
  }
  function grid() {
    $("editor-grid").style.setProperty("--editor-columns", draft.base.columns);
    $("editor-grid").replaceChildren(
      ...draft.layout.parcels.map((p) => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.parcel = p.id;
        b.dataset.type = p.type;
        const small = draft.plan.items.filter(
          (i) => i.parcelId === p.id,
        ).length;
        b.setAttribute(
          "aria-label",
          `${p.id} · ${names[p.type]}${small ? " · " + small + (small === 1 ? " elemento" : " elementos") : ""}`,
        );
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
    const route = draft.settings.route;
    $("editor-route-summary").textContent = route?.length
      ? `${route.length} puntos · ${route.length < 2 ? "Añade otro punto antes de guardar." : "Recorrido poligonal guardable."}`
      : "Recorrido lineal del selector principal. Activa Dibujar recorrido para personalizarlo.";
    $("editor-wind").value = draft.settings.wind;
    $("editor-speed").value = draft.settings.travelSpeed;
    const duration = String(draft.settings.duration ?? 0);
    for (const option of $("editor-duration").querySelectorAll("[data-custom]"))
      option.remove();
    if (![...$("editor-duration").options].some((o) => o.value === duration)) {
      const option = new Option(`${duration} s`, duration);
      option.dataset.custom = "true";
      $("editor-duration").add(option);
    }
    $("editor-duration").value = duration;
    $("editor-route-remove").disabled = !route?.length;
    view.showRoutePreview(route);
    $("editor-lesson-goal").textContent =
      LESSONS[draft.settings.lesson]?.goal ??
      "Elige un ejemplo para explorar una pregunta concreta.";
    const items = draft.plan.items;
    if (items.length)
      $("editor-summary").textContent +=
        ` Elementos independientes: ${count(items.filter((i) => i.type === "tree").length, "árbol", "árboles")} y ${count(items.filter((i) => i.type === "bench").length, "banca", "bancas")}.`;
  }
  function commit(command, parcelId, point = null) {
    if (!parcelId) {
      say(
        "Elige una parcela del plano. Las calles y el exterior no admiten colocación.",
      );
      return;
    }
    try {
      const changed = draft.execute(command.action, {
        ...command,
        parcelId,
        slot: slotAt(parcelId, point),
      });
      selected = parcelId;
      selectedObject = ["place", "place-item", "duplicate"].includes(
        command.action,
      )
        ? `O${String(draft.plan.nextId - 1).padStart(6, "0")}`
        : (command.id ?? draft.at(parcelId)?.id);
      if (!["place", "place-item"].includes(command.action)) tools();
      render(changed);
      say(
        changed
          ? `${names[chosen()?.type] ?? "Objeto"} en ${parcelId}. Cambio guardado en el borrador; puedes deshacerlo.`
          : `${parcelId} seleccionada.`,
      );
    } catch (error) {
      view?.highlightParcel(parcelId, "invalid");
      say(error.message);
    }
  }
  function activate(parcelId, point = null, objectId = null) {
    if (operation.action === "route-point") {
      const p = point ?? draft.layout.parcels.find((p) => p.id === parcelId);
      if (!p) {
        say("Marca un punto dentro del barrio o su margen.");
        return;
      }
      attempt(() => {
        draft.execute("route-point", { x: p.x, z: p.z });
        render();
        say("Punto añadido. Marca el siguiente o vuelve a Seleccionar.");
      })();
      return;
    }
    if (["place", "place-item", "move", "duplicate"].includes(operation.action))
      commit(operation, parcelId, point);
    else {
      selected = parcelId;
      selectedObject = objectId ?? draft.at(parcelId)?.id;
      selection();
      say(
        `${parcelId} · ${names[chosen()?.type ?? "vacant"]}. Elige una acción o una infraestructura.`,
      );
    }
  }
  function hover(parcelId, command, point = null) {
    let allowed = false,
      error = "";
    if (parcelId)
      try {
        const trial = new EditorState(draft.config);
        trial.execute(command.action, {
          ...command,
          parcelId,
          slot: slotAt(parcelId, point),
        });
        allowed = true;
      } catch (e) {
        error = e.message;
      }
    const item =
      command.action === "place-item" ||
      ["tree", "bench"].includes(draft.find(command.id)?.type);
    view?.highlightParcel(
      parcelId,
      allowed ? "valid" : "invalid",
      item ? slotAt(parcelId, point) : null,
    );
    say(
      !parcelId
        ? "Fuera de parcela: no se colocará el objeto."
        : allowed
          ? `${parcelId} · destino disponible. Suelta para colocar.`
          : error || `${parcelId} ocupada · el objeto anterior se conserva.`,
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
    selection();
  }
  function hoverNative(event, parcelId, point = null) {
    if (!nativeDrag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect =
      nativeDrag.action === "move" ? "move" : "copy";
    hover(parcelId, nativeDrag, point);
  }
  function dropNative(event, parcelId, point = null) {
    if (!nativeDrag) return;
    event.preventDefault();
    commit(nativeDrag, parcelId, point);
    nativeDrag = null;
  }
  for (const b of palette) {
    b.addEventListener("click", () => {
      tools({
        action: ["tree", "bench"].includes(b.dataset.editorType)
          ? "place-item"
          : "place",
        type: b.dataset.editorType,
      });
      say(
        `${names[b.dataset.editorType]}: elige un destino válido o arrastra desde la paleta.`,
      );
    });
    b.addEventListener("dragstart", (event) =>
      beginNative(event, {
        action: ["tree", "bench"].includes(b.dataset.editorType)
          ? "place-item"
          : "place",
        type: b.dataset.editorType,
      }),
    );
    b.addEventListener("dragend", endNative);
  }
  canvas.addEventListener("dragover", (event) =>
    hoverNative(
      event,
      view?.pickParcel(event.clientX, event.clientY, false),
      view?.groundPoint(event.clientX, event.clientY),
    ),
  );
  canvas.addEventListener("drop", (event) =>
    dropNative(
      event,
      view?.pickParcel(event.clientX, event.clientY, false),
      view?.groundPoint(event.clientX, event.clientY),
    ),
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
        object:
          draft.find(
            view.pickPiece(event.clientX, event.clientY)?.piece.objectId,
          ) ?? draft.at(parcelId),
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
    if (["place", "place-item", "move", "duplicate"].includes(command.action))
      hover(
        view.pickParcel(event.clientX, event.clientY, false),
        command,
        view.groundPoint(event.clientX, event.clientY),
      );
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
        view.groundPoint(event.clientX, event.clientY),
      );
    else if (!start.dragging || operation.action !== "select")
      activate(
        view.pickParcel(event.clientX, event.clientY, !start.dragging),
        view.groundPoint(event.clientX, event.clientY),
        view.pickPiece(event.clientX, event.clientY)?.piece.objectId,
      );
  });
  canvas.addEventListener("pointercancel", () => {
    pointer = null;
    view?.highlightParcel(selected);
    say("Movimiento cancelado; el borrador se conserva.");
  });
  $("editor-profile").replaceChildren(
    ...Object.values(PROFILES).map((p) => new Option(p.label, p.id)),
  );
  $("editor-object-list").addEventListener("change", () => {
    selectedObject = $("editor-object-list").value;
    selection();
  });
  $("editor-route-draw").addEventListener("click", () => {
    tools({ action: "route-point" });
    say(
      "Marca los puntos del recorrido en orden. Puedes hacer clic en calles, parcelas o su margen de 6 m.",
    );
  });
  for (const [id, action] of [
    ["editor-route-remove", "route-remove"],
    ["editor-route-clear", "route-clear"],
  ])
    $(id).addEventListener(
      "click",
      attempt(() => {
        draft.execute(action);
        render();
        say("Recorrido actualizado en el borrador.");
      }),
    );
  $("editor-weather-form").addEventListener("submit", (event) => {
    event.preventDefault();
    attempt(() => {
      draft.execute("weather", {
        wind: Number($("editor-wind").value),
        travelSpeed: Number($("editor-speed").value),
        duration: Number($("editor-duration").value) || null,
      });
      render();
      say(
        "Condiciones del ensayo actualizadas; el experimento original se conserva.",
      );
    })();
  });
  $("editor-load-example").addEventListener(
    "click",
    attempt(() => {
      const id = $("editor-example").value;
      draft.loadExample({
        ...lessonConfig(id),
        fragmentFlight: draft.config.fragmentFlight,
        enclosure: draft.config.enclosure,
      });
      selected = null;
      selectedObject = null;
      tools();
      render();
      topView();
      $("editor-name").value = LESSONS[id].title;
      say(LESSONS[id].goal + " Puedes deshacer la carga del ejemplo.");
    }),
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
        ...(obj.type === "tree"
          ? { anchorage: $("editor-anchorage").value }
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
  $("editor-perspective").addEventListener("click", () => {
    topCamera = false;
    view?.setView("perspective");
  });
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
      selectedObject = null;
      $("editor-replace").hidden = true;
      $("editor-apply").disabled = false;
      dialog.showModal();
      preview = new Experiment(draft.config, { record: false });
      view = new SceneView(canvas, preview);
      view.onResize = () => {
        if (topCamera) topView();
      };
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
    configurationDocument(draft.assertReady(), $("editor-name").value);
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
      const config = draft.assertReady();
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
  return {
    open,
    openExamples() {
      open();
      const panel = document.querySelector(".editor-example-panel");
      panel.open = true;
      panel.scrollIntoView({ block: "nearest" });
    },
    dispose: cleanup,
  };
}
