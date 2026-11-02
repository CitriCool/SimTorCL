import { cleanConfig } from "./records.js";
import { generateNeighborhood, PARCEL_TYPES, URBAN_DEFAULTS } from "./urban.js";
const $ = (id) => document.getElementById(id);
const area = (n) =>
  n.toLocaleString("es-CL", { maximumFractionDigits: 0 }) + " m²";
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const description = (layout) =>
  `${count(layout.parcels.length, "parcela", "parcelas")} · ${count(layout.counts.house, "vivienda", "viviendas")} · ${count(layout.counts.building, "reserva para edificio", "reservas para edificios")} · ${count(layout.counts.green, "área verde", "áreas verdes")} · ${count(layout.counts.vacant, "libre", "libres")}. Superficie del barrio: ${area(layout.areas.total)}; parcelas verdes: ${area(layout.areas.green)}.`;

export function setupUrban({ experiment, getView, pause, reset }) {
  const fields = [...document.querySelectorAll("[data-urban]")];
  function read() {
    return cleanConfig({
      ...experiment.config,
      mode: "neighborhood",
      ...Object.fromEntries(
        fields.map((f) => [f.dataset.urban, Number(f.value)]),
      ),
    });
  }
  function preview() {
    try {
      $("urban-form-status").textContent = description(
        generateNeighborhood(read()),
      );
      $("urban-apply").disabled = false;
    } catch (error) {
      $("urban-form-status").textContent = error.message;
      $("urban-apply").disabled = true;
    }
  }
  $("urban-open").addEventListener("click", () => {
    pause();
    for (const field of fields)
      field.value = experiment.config[field.dataset.urban];
    preview();
    $("urban-dialog").showModal();
  });
  $("urban-close").addEventListener("click", () => $("urban-dialog").close());
  for (const f of fields) f.addEventListener("input", preview);
  $("urban-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const config = read();
      reset(config);
      $("urban-dialog").close();
    } catch (error) {
      $("urban-form-status").textContent = error.message;
    }
  });
  $("urban-new-seed").addEventListener("click", () => {
    $("urban-seed").value = crypto.getRandomValues(new Uint32Array(1))[0];
    preview();
  });
  $("parcel-inspect").addEventListener("change", () => {
    const v = getView(),
      layout = experiment.active.layout,
      p = layout?.parcels.find((p) => p.id === $("parcel-inspect").value);
    if (!p) {
      v?.setView("perspective");
      return;
    }
    v.controls.target.set(p.world.x, 1, p.world.z);
    v.camera.position.set(p.world.x + 18, 20, p.world.z + 24);
    v.controls.update();
  });
  return {
    refresh() {
      const layout = experiment.active.layout,
        isUrban = !!layout;
      $("urban-controls").hidden = !isUrban;
      $("spacing").hidden = isUrban;
      $("spacing-label").hidden = isUrban;
      $("urban-results").hidden = !isUrban;
      if (!layout) return;
      $("urban-summary").textContent = description(layout);
      $("urban-config-summary").textContent =
        `${experiment.config.rows} × ${experiment.config.columns} parcelas · ${experiment.config.orientation}° · semilla ${layout.seed}`;
      const houses = new Map(
        experiment.houses.map((h) => [h.parcelId, h.label]),
      );
      $("parcel-inspect").replaceChildren(
        new Option("Plano completo", "all"),
        ...layout.parcels.map(
          (p) =>
            new Option(
              `${p.id} · ${PARCEL_TYPES[p.type]}${houses.has(p.id) ? " · " + houses.get(p.id) : ""}`,
              p.id,
            ),
        ),
      );
      $("parcel-rows").replaceChildren(
        ...layout.parcels.map((p) => {
          const tr = document.createElement("tr");
          for (const value of [
            p.id,
            PARCEL_TYPES[p.type],
            houses.get(p.id) ?? "—",
            area(p.area),
            `${p.world.x.toFixed(1)}, ${p.world.z.toFixed(1)}`,
          ]) {
            const td = document.createElement("td");
            td.textContent = value;
            tr.append(td);
          }
          return tr;
        }),
      );
    },
  };
}
