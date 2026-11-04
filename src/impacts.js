import { Vec3 } from "cannon-es";
import { recoverMissedContact } from "./swept-box.js";

export const IMPACT_MODEL = Object.freeze({
  version: "contact-v1",
  minimumClosingSpeed: 0.5,
  speedUnit: "m/s",
  forceUnit: "N",
  momentUnit: "N·m",
  evidence: "Criterio educativo sin calibración experimental.",
});
export const SWEPT_IMPACT_MODEL = Object.freeze({
  ...IMPACT_MODEL,
  version: "swept-v2",
  restitution: 0.03,
  separation: 0.00001,
  detection: "Barrido lineal de cajas orientadas entre posiciones del paso.",
});
const models = { "contact-v1": IMPACT_MODEL, "swept-v2": SWEPT_IMPACT_MODEL };
export const impactModel = (mode) =>
  Object.hasOwn(models, mode) ? models[mode] : null;

// Read solved normal forces without changing Cannon's collision response.
export class DebrisImpacts {
  constructor(owners, mode) {
    this.model = impactModel(mode);
    this.bodies = new Map();
    for (const owner of owners)
      for (const piece of owner.simulation.pieces)
        this.bodies.set(piece.body, { ...owner, piece });
  }

  step(world, dt) {
    const incoming = new Map();
    for (const [body, { piece }] of this.bodies) {
      if (piece.detached && piece.releaseEventId)
        incoming.set(body, [
          body.velocity.clone(),
          body.angularVelocity.clone(),
        ]);
    }
    world.step(dt);
    const hits = new Map();
    for (const contact of world.contacts) {
      if (
        !contact.enabled ||
        !Number.isFinite(contact.multiplier) ||
        contact.multiplier <= 0
      )
        continue;
      const sourceIsFirst = incoming.has(contact.bi);
      const sourceBody = sourceIsFirst ? contact.bi : contact.bj;
      const targetBody = sourceIsFirst ? contact.bj : contact.bi;
      const velocity = incoming.get(sourceBody);
      const target = this.bodies.get(targetBody);
      if (
        !velocity ||
        !target ||
        target.piece.detached ||
        !target.piece.connections.length
      )
        continue;
      const normal = contact.ni.scale(sourceIsFirst ? 1 : -1);
      const sourceArm = sourceIsFirst ? contact.ri : contact.rj;
      const targetArm = sourceIsFirst ? contact.rj : contact.ri;
      const closingSpeed = velocity[0]
        .vadd(velocity[1].cross(sourceArm))
        .dot(normal);
      if (!(closingSpeed >= IMPACT_MODEL.minimumClosingSpeed)) continue;

      const pair = `${sourceBody.id}:${targetBody.id}`;
      if (!hits.has(pair))
        hits.set(pair, {
          source: this.bodies.get(sourceBody),
          target,
          speed: 0,
          force: new Vec3(),
          moment: new Vec3(),
        });
      const hit = hits.get(pair);
      const force = normal.scale(contact.multiplier);
      hit.force.vadd(force, hit.force);
      hit.moment.vadd(targetArm.cross(force), hit.moment);
      hit.speed = Math.max(hit.speed, closingSpeed);
    }

    if (this.model === SWEPT_IMPACT_MODEL) {
      for (const body of incoming.keys()) {
        const hit = recoverMissedContact(
          world,
          body,
          this.bodies,
          hits,
          dt,
          this.model,
        );
        if (!hit) continue;
        const target = this.bodies.get(hit.target);
        hits.set(`${body.id}:${hit.target.id}`, {
          ...hit,
          source: this.bodies.get(body),
          target,
        });
      }
    }

    const failures = new Map();
    for (const hit of hits.values()) {
      const { piece, simulation } = hit.target;
      const supports = piece.connections.filter(
        (c) =>
          !c.broken &&
          (c.a === piece || c.kind === "wall" || c.kind === "corner"),
      );
      for (const connection of supports) {
        let demand = hit.force.length();
        if (connection.unit === "N·m") {
          const pivot =
            connection.b?.body.position ??
            new Vec3(piece.origin.x, 0, piece.origin.z);
          const moment = piece.body.position
            .vsub(pivot)
            .cross(hit.force)
            .vadd(hit.moment);
          demand = Math.hypot(moment.x, moment.z);
        }
        demand /= supports.length;
        const capacity =
          (connection.capacity * simulation.config.reinforcement) / 100;
        if (
          Number.isFinite(demand) &&
          demand > capacity &&
          demand > (failures.get(connection)?.demand ?? 0)
        )
          failures.set(connection, { hit, demand });
      }
    }
    const changed = new Set();
    for (const [connection, { hit, demand }] of failures) {
      const { source, target } = hit;
      target.simulation.breakImpact(connection, demand, {
        sourceReleaseId: `${source.label}:E${source.piece.releaseEventId}`,
        targetPieceId: target.piece.id,
        closingSpeed: hit.speed,
        ...(hit.fraction === undefined ? {} : { sweepFraction: hit.fraction }),
      });
      changed.add(target.simulation);
    }
    for (const simulation of changed) simulation.resolveSupports();
  }
}
