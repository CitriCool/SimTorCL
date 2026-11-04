import { explainEvent } from "./explanations.js";
import { LESSONS } from "./lessons.js";

const $ = (id) => document.getElementById(id);
const names = { tree: "Árbol", bench: "Banca", building: "Edificio" };

export function renderHistoricalContext(container, lesson) {
  const historical = lesson?.historical;
  container.hidden = !historical;
  if (!historical) return;
  container.querySelector("[data-case-title]").textContent = lesson.title;
  container.querySelector("[data-case-event]").textContent = historical.event;
  container.querySelector("[data-case-model]").textContent = historical.model;
  const source = container.querySelector("[data-case-source]");
  source.href = historical.source;
  source.textContent = historical.sourceLabel ?? "Mapa y análisis de la DMC ↗";
}

export function setupLearning({
  experiment,
  getView,
  getNotebook,
  pause,
  openEditor,
}) {
  let revision = -1,
    key = "",
    selectedPiece = null,
    visible = [];
  function renderExplanation() {
    const event = visible.find((e) => e.id === $("learning-event").value);
    const all = getNotebook()?.replayRecord?.events ?? experiment.events;
    const explanation = explainEvent(event, all);
    $("learning-title").textContent = explanation.title;
    $("learning-explanation").textContent = explanation.body;
    $("learning-parents").textContent = explanation.parents.length
      ? "Eventos anteriores relacionados: " +
        explanation.parents
          .map((p) => `${p.id} · ${p.label} · ${p.time.toFixed(2)} s`)
          .join("; ")
      : "";
    $("learning-timeline").disabled = !event;
  }
  function refresh() {
    const notebook = getNotebook(),
      view = getView();
    if (revision !== experiment.revision) {
      revision = experiment.revision;
      selectedPiece = null;
      key = "";
      const options = [
        new Option("Todos los objetos", "all"),
        ...(
          experiment.houses ?? [{ label: "C01", simulation: experiment.active }]
        ).map(
          (h) =>
            new Option(
              `${h.parcelId ?? h.label} · Casa · ${h.label}`,
              `house:${h.label}`,
            ),
        ),
        ...(experiment.environment?.entities ?? []).map(
          (e) =>
            new Option(
              `${e.parcelId} · ${names[e.type]} · ${e.id}`,
              `entity:${e.id}`,
            ),
        ),
      ];
      $("learning-object").replaceChildren(...options);
      renderHistoricalContext($("learning-case"), LESSONS[experiment.config.lesson]);
    }
    const record = notebook?.replayRecord;
    const events = (record?.events ?? experiment.events).filter(
      (e) => e.step <= experiment.steps,
    );
    const next = [
      revision,
      events.length,
      $("learning-object").value,
      selectedPiece?.id,
      record ? experiment.steps : "live",
    ].join(":");
    const initial = !!view?.initialView;
    $("learning-initial").setAttribute("aria-pressed", String(initial));
    $("learning-current").setAttribute("aria-pressed", String(!initial));
    $("learning-view-note").textContent = initial
      ? "Geometría inicial de referencia; los contadores y eventos corresponden al estado calculado. La vista no modifica la física."
      : record
        ? "Repetición visual: se explican las fallas registradas hasta este fotograma."
        : "Vista del estado calculado. Las explicaciones se basan en los eventos del modelo.";
    $("learning-compare").disabled = !!record || !experiment.pieces.length;
    const lesson = LESSONS[experiment.config.lesson];
    $("learning-lesson").textContent = lesson
      ? `${lesson.title} · ${lesson.historical ? "escenario inspirado en un caso documentado" : "ejemplo sintético modificable"}. ${lesson.goal}\n${lesson.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "Elige un ejemplo en el editor para seguir una pregunta guiada. Todas las capacidades mecánicas actuales son educativas.";
    if (next === key) return;
    key = next;
    const token = $("learning-object").value;
    visible = events.filter(
      (e) =>
        (token === "all" ||
          token === `house:${e.house}` ||
          token === `entity:${e.entityId}`) &&
        (!selectedPiece ||
          (e.house === selectedPiece.house &&
            (e.pieceId === selectedPiece.id ||
              e.otherPieceId === selectedPiece.id))),
    );
    const previous = $("learning-event").value;
    $("learning-event").replaceChildren(
      ...(visible.length
        ? visible.map(
            (e) =>
              new Option(
                `${e.time.toFixed(2)} s · ${e.cause === "impact" ? "Rotura por impacto" : e.type === "connection" ? "Unión fallada" : "Pieza liberada"} · ${e.id}`,
                e.id,
              ),
          )
        : [new Option("Sin eventos en esta selección", "")]),
    );
    $("learning-event").value = visible.some((e) => e.id === previous)
      ? previous
      : (visible.at(-1)?.id ?? "");
    renderExplanation();
  }
  $("learning-object").addEventListener("change", () => {
    selectedPiece = null;
    key = "";
    refresh();
  });
  $("learning-event").addEventListener("change", renderExplanation);
  $("learning-timeline").addEventListener("click", () =>
    getNotebook()?.openEvent($("learning-event").value),
  );
  $("learning-compare").addEventListener("click", () =>
    getNotebook()?.openComparison(),
  );
  $("learning-examples").addEventListener("click", openEditor);
  for (const [id, initial] of [
    ["learning-initial", true],
    ["learning-current", false],
  ])
    $(id).addEventListener("click", () => {
      pause();
      getView()?.setInitialView(initial);
      refresh();
    });
  const canvas = $("scene");
  let down;
  const start = (event) => {
    if (event.button === 0) down = { x: event.clientX, y: event.clientY };
  };
  const end = (event) => {
    if (!down) return;
    const origin = down;
    down = null;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 5)
      return;
    const hit = getView()?.pickPiece(event.clientX, event.clientY);
    if (!hit) return;
    pause();
    refresh();
    selectedPiece = { id: hit.piece.id, house: hit.house };
    $("learning-object").value = hit.piece.entityId
      ? `entity:${hit.piece.entityId}`
      : `house:${hit.house}`;
    getView()?.highlightPiece(hit.piece);
    key = "";
    refresh();
    $("learning-panel").scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  };
  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointerup", end);
  refresh();
  return {
    refresh,
    dispose() {
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointerup", end);
    },
  };
}
