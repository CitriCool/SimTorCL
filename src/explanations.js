import { ENV_LABELS } from "./environment.js";
const labels = {
  ...ENV_LABELS,
  roof: "cubierta",
  wall: "pared",
  cladding: "revestimiento o ventana",
  base: "anclaje de muro",
  corner: "unión de esquina",
};
const number = (n) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
export function describeImpact(event, events) {
  const hit = event.impact;
  const source = events.find((e) => e.id === hit.sourceReleaseId);
  const origin = source
    ? `${source.entityId ?? source.house} · ${labels[source.kind]} #${source.pieceId} (${source.id})`
    : hit.sourceReleaseId;
  return `Fragmento de origen ${origin}. Receptor ${event.entityId ?? event.house} · pieza #${hit.targetPieceId}. Velocidad normal de acercamiento ${number(hit.closingSpeed)} m/s.`;
}
export function explainEvent(event, events = []) {
  if (!event)
    return {
      title: "Sin fallas registradas",
      body: "Todavía no hay fallas registradas para esta selección en el estado mostrado. Revisa su exposición y los eventos; la ausencia de fallas no valida una construcción real.",
      parents: [],
    };
  const name = labels[event.kind] ?? event.kind,
    location = event.parcelId ? ` en ${event.parcelId}` : "";
  const parents = (event.parents ?? [])
    .map((id) => events.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => ({ id: e.id, time: e.time, label: labels[e.kind] ?? e.kind }));
  if (event.cause === "impact")
    return {
      title: `Rotura por impacto${location}`,
      body: `${describeImpact(event, events)} A los ${number(event.time)} s, la demanda de contacto fue ${number(event.demand)} ${event.unit ?? "N"} y superó la capacidad ilustrativa de ${number(event.capacity)} ${event.unit ?? "N"}.`,
      parents,
    };
  if (event.type === "connection")
    return {
      title: `Falló una unión de ${name}${location}`,
      body: `Según el registro, a los ${number(event.time)} s se alcanzó el criterio de sobrecarga del modelo: demanda ${number(event.demand)} ${event.unit ?? "N"} frente a capacidad asumida ${number(event.capacity)} ${event.unit ?? "N"}. La capacidad es educativa y no está calibrada para una construcción real.`,
      parents,
    };
  return {
    title: `${name[0].toUpperCase() + name.slice(1)} sin soporte${location}`,
    body: `Según el registro, a los ${number(event.time)} s esta pieza perdió sus apoyos del grafo y quedó liberada. ${parents.length ? "Las fallas relacionadas se indican abajo." : "El registro no incluye un apoyo previo identificable."}`,
    parents,
  };
}
