import catalog from "./historical-events.json";

const scenarios = {
  CL0098: [
    ["puerto-varas-2025", "Abrir tramo urbano"],
    ["puerto-varas-corridor", "Abrir corredor ampliado"],
  ],
  CL0056: [["itata-2019", "Abrir escenario rural"]],
};
const observed = {
  CL0098: "La DMC confirmó EF1 y documentó voladuras de techumbre y daños en viviendas.",
  CL0056: "El catálogo registra 42 viviendas afectadas, 14 con daños de techumbre. La DMC incluyó el episodio entre los tornados sin confirmar en su informe inicial.",
};

const normalize = (value) =>
  String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const element = (tag, text) => {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
};

function externalLink(label, address) {
  const url = new URL(address);
  if (!["https:", "http:"].includes(url.protocol)) return null;
  const link = element("a", label);
  link.href = url.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

export function setupHistoricalCatalog({ openScenario, openRoofReference }) {
  const $ = (id) => document.getElementById(`historical-${id}`);
  const dialog = $("dialog");
  const events = [...catalog.events].reverse();
  events.sort((a, b) => Number(!!scenarios[b.id]) - Number(!!scenarios[a.id]));
  const fields = {
    region: "Todas",
    year: "Todos",
    kind: "Todos",
    ef: "Todas",
  };
  const fieldValue = (event, key) =>
    key === "year" ? event.date.slice(0, 4) : event[key] ?? "Sin dato";
  for (const [key, label] of Object.entries(fields)) {
    const values = [...new Set(events.map((event) => fieldValue(event, key)))];
    values.sort((a, b) => key === "year" ? b.localeCompare(a) : a.localeCompare(b, "es"));
    $(key).replaceChildren(new Option(label, ""), ...values.map((value) => new Option(value)));
  }

  const more = $("more");
  const pageSize = 12;
  let matches = [];
  let shown = 0;

  function card(event) {
    const item = document.createElement("details");
    item.name = "historical-event";
    const summary = element("summary", event.place);
    summary.append(element("small", [
      event.date,
      event.region,
      event.ef,
      scenarios[event.id] ? "Simulable" : event.kind,
    ].filter(Boolean).join(" · ")));
    item.append(summary);

    const body = document.createElement("div");
    body.className = "historical-detail";
    body.append(element("p", [
      event.id, event.kind, event.status,
      event.damage === "Sí" ? "Daño registrado" : null,
    ].filter(Boolean).join(" · ")));
    if (observed[event.id]) body.append(element("p", observed[event.id]));
    if (event.note) body.append(element("p", event.note));
    if (event.reference) body.append(element("p", event.reference));

    const actions = document.createElement("div");
    actions.className = "historical-actions";
    for (const [index, address] of (event.sources ?? []).entries()) {
      try {
        const link = externalLink(index ? "Fuente adicional ↗" : "Ver fuente ↗", address);
        if (link) actions.append(link);
      } catch {
        // Some historical references contain incomplete URLs.
      }
    }
    if (event.coordinates) {
      const [lat, lon] = event.coordinates;
      actions.append(externalLink("Ver punto del catálogo ↗",
        `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=13/${lat}/${lon}`));
    }
    for (const [id, label] of scenarios[event.id] ?? []) {
      const button = element("button", label);
      button.type = "button";
      button.className = "details-button";
      button.addEventListener("click", () => {
        dialog.close();
        openScenario(id);
      });
      actions.append(button);
    }
    if (event.id === "CL0056") {
      const button = element("button", "Ver armado de la techumbre");
      button.type = "button";
      button.className = "details-button";
      button.addEventListener("click", openRoofReference);
      actions.append(button);
    }
    body.append(actions);
    item.append(body);
    return item;
  }

  function showMore() {
    const next = matches.slice(shown, shown + pageSize);
    $("results").append(...next.map(card));
    shown += next.length;
    more.hidden = shown === matches.length;
    $("count").textContent = matches.length
      ? `${shown} de ${matches.length} reportes`
      : "No hay reportes con estos filtros.";
  }

  function filter() {
    const words = normalize($("query").value).trim().split(/\s+/).filter(Boolean);
    matches = events.filter((event) => {
      const search = normalize([
        event.id, event.webId, event.date, event.place, event.region, event.kind,
        event.ef, event.id === "CL0056" ? "Rinconada de Itata" : "",
      ].join(" "));
      return words.every((word) => search.includes(word))
        && Object.keys(fields).every((key) => !$(key).value || $(key).value === fieldValue(event, key));
    });
    $("results").replaceChildren();
    shown = 0;
    showMore();
  }

  $("open").addEventListener("click", () => dialog.showModal());
  $("query").addEventListener("input", filter);
  for (const key of Object.keys(fields)) $(key).addEventListener("change", filter);
  more.addEventListener("click", showMore);
  $("cutoff").textContent = `Revisión del catálogo al ${catalog.reviewedThrough.split("-").reverse().join("/")}. Los puntos ubican reportes de forma aproximada.`;
  filter();
}
