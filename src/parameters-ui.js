import { MODEL, environmentModel } from "./records.js";
import {
  EVIDENCE_LABELS,
  parameterLibrary,
  libraryCSV,
  referenceCheck,
} from "./parameters.js";

const $ = (id) => document.getElementById(id);
const format = (n) =>
  n.toLocaleString("es-CL", { maximumSignificantDigits: 8 });
const download = (name, body, type) => {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function cells(values) {
  const tr = document.createElement("tr");
  values.forEach((value) => {
    const td = document.createElement("td");
    td.textContent = value;
    tr.append(td);
  });
  return tr;
}
let current, check;
function render() {
  const group = $("library-group").value;
  const text = $("library-search").value.trim().toLocaleLowerCase("es");
  const entries = current.entries.filter(
    (p) =>
      (group === "all" || p.group === group) &&
      `${p.id} ${p.label} ${p.status} ${p.note}`
        .toLocaleLowerCase("es")
        .includes(text),
  );
  $("library-count").textContent =
    `${entries.length} de ${current.entries.length} parámetros · ${current.version}`;
  $("library-rows").replaceChildren(
    ...entries.map((p) =>
      cells([
        `${p.label}\n${p.id}`,
        `${format(p.value)} ${p.unit}`,
        `${EVIDENCE_LABELS[p.evidence]}\n${p.status}`,
        `${p.applicability}${p.note ? ` ${p.note}` : ""} Fuentes de este valor: ${p.sourceIds.length ? p.sourceIds.join(", ") : "ninguna"}.`,
      ]),
    ),
  );
}
export function refreshParameterLibrary(config) {
  current = parameterLibrary(MODEL, environmentModel(config));
  $("library-group").replaceChildren(
    ...["all", ...new Set(current.entries.map((p) => p.group))].map((group) => {
      const option = document.createElement("option");
      option.value = group;
      option.textContent = group === "all" ? "Todos los grupos" : group;
      return option;
    }),
  );
  $("library-search").value = "";
  $("library-sources").replaceChildren(
    ...current.sources.map((source) => {
      const p = document.createElement("p"),
        link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = `${source.title} ↗`;
      p.append(
        link,
        document.createTextNode(
          ` · ${source.status}. Sección: ${source.section}. ${source.supports ?? source.use ?? ""}`,
        ),
      );
      return p;
    }),
  );
  render();
}
$("library-group").addEventListener("change", render);
$("library-search").addEventListener("input", render);
$("library-json").addEventListener("click", () =>
  download(
    "SimTorCL_parametros.json",
    JSON.stringify(current, null, 2),
    "application/json",
  ),
);
$("library-csv").addEventListener("click", () =>
  download(
    "SimTorCL_parametros.csv",
    libraryCSV(current),
    "text/csv;charset=utf-8",
  ),
);
$("reference-run").addEventListener("click", () => {
  check = referenceCheck();
  check.executedAt = new Date().toISOString();
  $("reference-status").textContent =
    `${check.passed ? "Comprobación aprobada" : "Comprobación fallida"}: ${check.rows.filter((r) => r.passed).length}/${check.rows.length} magnitudes dentro de tolerancia. ${check.criterion}`;
  $("reference-rows").replaceChildren(
    ...check.rows.map((r) =>
      cells([
        r.label,
        `${format(r.expected)} ${r.unit}`,
        `${format(r.actual)} ${r.unit}`,
        `${r.absoluteError.toExponential(2)} ${r.unit}`,
        r.passed ? "Cumple" : "Falla",
      ]),
    ),
  );
  $("reference-results").hidden = false;
  $("reference-export").disabled = false;
});
$("reference-export").addEventListener("click", () =>
  download(
    "SimTorCL_comprobacion_analitica.json",
    JSON.stringify(
      {
        ...check,
        sources: current.sources.filter((s) => check.sourceIds.includes(s.id)),
      },
      null,
      2,
    ),
    "application/json",
  ),
);
