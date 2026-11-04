import { Body, Box, Vec3 } from "cannon-es";
import { environmentBlueprint } from "./environment.js";
import { applyFragmentAir } from "./fragment-flight.js";
import { lessonConfig } from "./lessons.js";
import { createWorld, FIXED_STEP, Simulation } from "./physics.js";
import { generateNeighborhood } from "./urban.js";

export function compareFragmentFlight(windKmh) {
  const house = new Simulation({ roof: "metal" });
  const sheet = house.pieces.find((piece) => piece.kind === "roof");
  const config = lessonConfig("plaza");
  const panel = environmentBlueprint(
    config,
    generateNeighborhood(config),
  ).pieces.find((piece) => piece.kind === "facade");
  const air = new Vec3(windKmh / 3.6, 0, 0);
  return [
    ["Plancha metálica", sheet, Math.PI / 2],
    ["Panel de fachada", panel, 0],
  ].map(([label, piece, pitch]) => {
    const world = createWorld();
    const body = new Body({
      mass: piece.mass,
      shape: new Box(new Vec3(...piece.size.map((side) => side / 2))),
      linearDamping: 0.1,
      angularDamping: 0.4,
    });
    body.quaternion.setFromEuler(pitch, Math.PI / 4, 0, "YXZ");
    body.updateAABB();
    body.position.y = 4 - body.aabb.lowerBound.y;
    body.aabbNeedsUpdate = true;
    body.updateInertiaWorld(true);
    world.addBody(body);
    let turn = 0;
    for (let step = 0; step < 1200; step++) {
      const speed = body.velocity.length();
      const distance = Math.hypot(body.position.x, body.position.z);
      applyFragmentAir(body, piece.size, air, FIXED_STEP);
      world.step(FIXED_STEP);
      if (world.contacts.length)
        return {
          label,
          mass: piece.mass,
          distance,
          speed,
          turn,
          time: step * FIXED_STEP,
        };
      turn += (body.angularVelocity.length() * FIXED_STEP * 180) / Math.PI;
    }
    return {
      label,
      mass: piece.mass,
      distance: Math.hypot(body.position.x, body.position.z),
      speed: null,
      turn,
      time: 10,
    };
  });
}
