import { AABB, Body, Box, Vec3 } from "cannon-es";

const directions = [new Vec3(1, 0, 0), new Vec3(0, 1, 0), new Vec3(0, 0, 1)];
const axesOf = (quaternion) => directions.map((axis) => quaternion.vmult(axis));

function projectedRadius(box, axes, axis) {
  const { x, y, z } = box.halfExtents;
  return (
    x * Math.abs(axes[0].dot(axis)) +
    y * Math.abs(axes[1].dot(axis)) +
    z * Math.abs(axes[2].dot(axis))
  );
}

// Intersect the overlap intervals on the face normals and edge cross products.
// Both boxes keep a fixed orientation for this translation query.
function overlapInterval(source, target, displacement, sourceAxes, targetAxes) {
  const offset = source.previousPosition.vsub(target.position);
  const axes = [...sourceAxes, ...targetAxes];
  for (const a of sourceAxes)
    for (const b of targetAxes) {
      const cross = a.cross(b);
      if (cross.lengthSquared() > 1e-16) axes.push(cross.unit());
    }

  let enter = -Infinity,
    exit = Infinity,
    normal;
  for (const axis of axes) {
    const radius =
      projectedRadius(source.shapes[0], sourceAxes, axis) +
      projectedRadius(target.shapes[0], targetAxes, axis);
    const start = offset.dot(axis);
    const travel = displacement.dot(axis);
    if (Math.abs(travel) < 1e-10) {
      if (Math.abs(start) >= radius) return null;
      continue;
    }
    const first = (-radius - start) / travel;
    const second = (radius - start) / travel;
    const near = Math.min(first, second);
    if (near > enter) {
      enter = near;
      normal = axis.scale(Math.sign(travel));
    }
    exit = Math.min(exit, Math.max(first, second));
    if (enter >= exit || enter > 1 || exit <= 0) return null;
  }
  return enter >= 0 ? { enter, exit, normal } : null;
}

export function recoverMissedContact(
  world,
  source,
  targets,
  resolved,
  dt,
  model,
) {
  const start = source.previousPosition;
  const end = source.position;
  const displacement = end.vsub(start);
  if (
    !source.collisionResponse ||
    !(source.shapes[0] instanceof Box) ||
    displacement.lengthSquared() < (model.minimumClosingSpeed * dt) ** 2
  )
    return null;

  // The union of endpoint AABBs bounds the entire fixed-orientation sweep.
  const box = source.shapes[0];
  const lower = new Vec3(),
    upper = new Vec3();
  box.calculateWorldAABB(start, source.previousQuaternion, lower, upper);
  for (const key of ["x", "y", "z"]) {
    lower[key] += Math.min(0, displacement[key]);
    upper[key] += Math.max(0, displacement[key]);
  }
  const bounds = new AABB({ lowerBound: lower, upperBound: upper });
  const sourceAxes = axesOf(source.previousQuaternion);
  let first;
  for (const target of world.broadphase.aabbQuery(world, bounds)) {
    if (
      !targets.has(target) ||
      target.type !== Body.STATIC ||
      !target.collisionResponse ||
      !(target.shapes[0] instanceof Box)
    )
      continue;
    const targetAxes = axesOf(target.quaternion);
    const hit = overlapInterval(
      source,
      target,
      displacement,
      sourceAxes,
      targetAxes,
    );
    if (
      hit &&
      (!first ||
        hit.enter < first.enter ||
        (hit.enter === first.enter && target.id < first.target.id))
    )
      first = { ...hit, target, targetAxes };
  }

  // An overlap at the end can be handled by Cannon at the next step.
  if (
    !first ||
    first.exit >= 1 ||
    resolved.has(`${source.id}:${first.target.id}`)
  )
    return null;
  const { target, normal, enter } = first;
  const speed = displacement.dot(normal) / dt;
  if (!(speed >= model.minimumClosingSpeed) || !Number.isFinite(speed))
    return null;

  const center = start.vadd(displacement.scale(enter));
  const offset = center.vsub(target.position);
  const arm = new Vec3();
  const extents = target.shapes[0].halfExtents.toArray();
  first.targetAxes.forEach((axis, index) => {
    const coordinate = Math.max(
      -extents[index],
      Math.min(extents[index], offset.dot(axis)),
    );
    arm.vadd(axis.scale(coordinate), arm);
  });
  const speedChange = (1 + model.restitution) * speed;
  const force = normal.scale((source.mass * speedChange) / dt);
  center.vsub(normal.scale(model.separation), source.position);
  source.quaternion.copy(source.previousQuaternion);
  source.velocity.vsub(normal.scale(speedChange), source.velocity);
  source.updateInertiaWorld();
  source.aabbNeedsUpdate = true;
  world.broadphase.dirty = true;
  return { target, speed, force, moment: arm.cross(force), fraction: enter };
}
