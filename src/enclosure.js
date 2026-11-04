import { Vec3 } from "cannon-es";

export const ENCLOSURE_MODEL = Object.freeze({
  version: "single-zone-v1",
  leakageArea: 0.1,
  initialOpeningArea: 1,
  windward: 0.8,
  leeward: -0.5,
  evidence:
    "Recinto único en equilibrio de caudales con coeficientes ilustrativos.",
});

const outward = new Vec3(0, 0, 1);
const up = new Vec3(0, 1, 0);

export function balancePressure(openings) {
  // Common discharge and density factors cancel from the net flow equation.
  let lower = Math.min(0, ...openings.map(({ pressure }) => pressure));
  let upper = Math.max(0, ...openings.map(({ pressure }) => pressure));
  for (let i = 0; i < 28 && lower < upper; i++) {
    const middle = (lower + upper) / 2;
    let flow =
      -ENCLOSURE_MODEL.leakageArea *
      Math.sign(middle) *
      Math.sqrt(Math.abs(middle));
    for (const { area, pressure } of openings) {
      const difference = pressure - middle;
      flow += area * Math.sign(difference) * Math.sqrt(Math.abs(difference));
    }
    if (flow === 0) return middle;
    if (flow > 0) lower = middle;
    else upper = middle;
  }
  return (lower + upper) / 2;
}

export function openingState(pieces, frontOpening) {
  const openings = [];
  let frontAlreadyOpen = false;
  for (const piece of pieces) {
    if (!piece.detached) continue;
    if (piece.kind === "cladding" && piece.connections[0].b.detached) continue;
    if (piece.kind !== "roof" && piece.details.front && piece.details.bay === 1)
      frontAlreadyOpen = true;
    openings.push({ piece, area: piece.area });
  }
  if (frontOpening && !frontAlreadyOpen)
    openings.push({
      piece: frontOpening,
      area: ENCLOSURE_MODEL.initialOpeningArea,
    });
  return openings;
}

export function roomPressure(openings, exteriorLoad) {
  return balancePressure(
    openings.map(({ piece, area }) => {
      const load = exteriorLoad(piece.origin);
      if (piece.kind === "roof") return { area, pressure: -load.y };
      const horizontal = Math.hypot(load.x, load.z);
      const normal = piece.orientation.vmult(outward);
      const incidence =
        horizontal > 0
          ? Math.max(0, -(normal.x * load.x + normal.z * load.z) / horizontal)
          : 0;
      const coefficient =
        ENCLOSURE_MODEL.leeward +
        (ENCLOSURE_MODEL.windward - ENCLOSURE_MODEL.leeward) * incidence ** 2;
      return { area, pressure: (coefficient * load.y) / 0.7 };
    }),
  );
}

export function addRoomLoad(force, piece, pressure, area) {
  const normal = piece.body.quaternion.vmult(
    piece.kind === "roof" ? up : outward,
  );
  if (piece.kind === "roof") force.y += pressure * area * Math.abs(normal.y);
  else {
    force.x += pressure * area * normal.x;
    force.z += pressure * area * normal.z;
  }
}
