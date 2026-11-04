import { Vec3 } from "cannon-es";
import { dynamicPressure } from "./aerodynamics.js";

export const FRAGMENT_MODEL = Object.freeze({
  version: "projected-v1",
  airDensity: 1.225,
  dragCoefficient: 0.7,
  pressureShift: 0.15,
  evidence: "Arrastre educativo por caras de caja, pendiente de calibración.",
});

const normals = [new Vec3(1, 0, 0), new Vec3(0, 1, 0), new Vec3(0, 0, 1)];

// Convert the illustrative unit-area pressure vector into an equivalent flow.
export function equivalentAir(load, ramp) {
  const pressure = load.length();
  if (pressure === 0) return load;
  return load.scale(
    Math.sqrt((2 * pressure * ramp) / FRAGMENT_MODEL.airDensity) / pressure,
  );
}

export function applyFragmentAir(body, size, air, dt) {
  const centerFlow = air.vsub(body.velocity);
  const axes = normals.map((normal) => body.quaternion.vmult(normal));
  for (let axis = 0; axis < 3; axis++) {
    const normal = axes[axis];
    const faceArea = size[(axis + 1) % 3] * size[(axis + 2) % 3];
    for (const side of [-1, 1]) {
      const arm = normal.scale((side * size[axis]) / 2);
      const faceFlow = centerFlow.vsub(body.angularVelocity.cross(arm));
      const faceSpeed = faceFlow.length();
      if (faceSpeed === 0 || -side * faceFlow.dot(normal) <= 0) continue;
      // An oblique flow shifts the assumed pressure center toward the leading edge.
      for (const edge of [(axis + 1) % 3, (axis + 2) % 3]) {
        const shift =
          (-FRAGMENT_MODEL.pressureShift *
            size[edge] *
            faceFlow.dot(axes[edge])) /
          faceSpeed;
        arm.vadd(axes[edge].scale(shift), arm);
      }
      const flow = centerFlow.vsub(body.angularVelocity.cross(arm));
      const closing = -side * flow.dot(normal);
      if (closing <= 0) continue;
      const speed = flow.length();
      const direction = flow.scale(1 / speed);
      const projectedArea = (faceArea * closing) / speed;
      const torqueAxis = arm.cross(direction);
      const inverseMass =
        body.invMass + torqueAxis.dot(body.invInertiaWorld.vmult(torqueAxis));
      // Bound the explicit impulse at each of the six face samples.
      const limit = speed / (6 * dt * inverseMass);
      const drag =
        dynamicPressure(speed, FRAGMENT_MODEL.airDensity) *
        FRAGMENT_MODEL.dragCoefficient *
        projectedArea;
      body.applyForce(direction.scale(Math.min(drag, limit)), arm);
    }
  }
}
