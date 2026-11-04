import { Vec3 } from "cannon-es";

export const LOAD_PATH_MODEL = Object.freeze({
  version: "grounded-graph-v1",
  linkWeight: 1,
  unit: "N",
  evidence:
    "Equilibrio estático idealizado con reparto uniforme, pendiente de calibración.",
});

const isWallLink = ({ kind }) => kind === "wall" || kind === "corner";

export function groundedWalls(pieces, connections, attachedOnly = false) {
  const anchored = new Set(
    connections
      .filter(
        (c) =>
          c.kind === "base" && !c.broken && (!attachedOnly || !c.a.detached),
      )
      .map((c) => c.a.id),
  );
  const queue = [...anchored];
  while (queue.length) {
    const piece = pieces[queue.pop()];
    for (const connection of piece.connections) {
      if (connection.broken || !isWallLink(connection)) continue;
      const other = connection.a === piece ? connection.b : connection.a;
      if ((attachedOnly && other.detached) || anchored.has(other.id)) continue;
      anchored.add(other.id);
      queue.push(other.id);
    }
  }
  return anchored;
}

export function createLoadNetwork(pieces, connections) {
  const grounded = groundedWalls(pieces, connections, true);
  const walls = pieces.filter((piece) => grounded.has(piece.id));
  const indices = new Map(walls.map((wall, index) => [wall, index]));
  const links = connections.filter(
    (c) =>
      !c.broken &&
      indices.has(c.a) &&
      (c.kind === "base" || (isWallLink(c) && indices.has(c.b))),
  );
  const attachments = pieces
    .filter(
      (piece) =>
        !piece.detached && (piece.kind === "roof" || piece.kind === "cladding"),
    )
    .map((piece) => ({
      piece,
      mounts: piece.connections.filter(
        (c) => !c.broken && c.a === piece && indices.has(c.b),
      ),
    }))
    .filter(
      ({ piece, mounts }) => mounts.length >= (piece.details.slab ? 3 : 1),
    );

  // Grounded graph Laplacian. Factor once per change in intact supports.
  const lower = walls.map(() => new Float64Array(walls.length));
  for (const link of links) {
    const a = indices.get(link.a);
    lower[a][a] += LOAD_PATH_MODEL.linkWeight;
    if (link.b) {
      const b = indices.get(link.b);
      lower[b][b] += LOAD_PATH_MODEL.linkWeight;
      lower[Math.max(a, b)][Math.min(a, b)] -= LOAD_PATH_MODEL.linkWeight;
    }
  }
  for (let i = 0; i < lower.length; i++) {
    for (let j = 0; j <= i; j++) {
      let value = lower[i][j];
      for (let k = 0; k < j; k++) value -= lower[i][k] * lower[j][k];
      lower[i][j] = i === j ? Math.sqrt(value) : value / lower[j][j];
    }
  }
  return { walls, indices, links, attachments, lower };
}

export function connectionLoads({ walls, indices, links, attachments, lower }) {
  const forces = walls.map((wall) => new Vec3(wall.load.x, 0, wall.load.z));
  const loads = new Map();
  for (const { piece, mounts } of attachments) {
    const share = new Vec3(
      piece.load.x,
      piece.kind === "roof" ? piece.demand : 0,
      piece.load.z,
    ).scale(1 / mounts.length);
    for (const mount of mounts) {
      const wallForce = forces[indices.get(mount.b)];
      wallForce.vadd(share, wallForce);
      loads.set(mount, share);
    }
  }
  // Solve L Lᵀ x = f for all three force components. x is a graph
  // potential, and differences of x give signed forces across links.
  for (let i = 0; i < forces.length; i++) {
    for (let j = 0; j < i; j++)
      forces[i].addScaledVector(-lower[i][j], forces[j], forces[i]);
    forces[i].scale(1 / lower[i][i], forces[i]);
  }
  for (let i = forces.length - 1; i >= 0; i--) {
    for (let j = i + 1; j < forces.length; j++)
      forces[i].addScaledVector(-lower[j][i], forces[j], forces[i]);
    forces[i].scale(1 / lower[i][i], forces[i]);
  }
  for (const link of links) {
    const a = forces[indices.get(link.a)];
    const flow = link.b ? a.vsub(forces[indices.get(link.b)]) : a;
    loads.set(link, flow.scale(LOAD_PATH_MODEL.linkWeight));
  }
  return loads;
}
