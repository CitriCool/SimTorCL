import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, windAt } from "../src/physics.js";

function advance(simulation, seconds) {
  for (let i = 0; i < seconds * 60; i++) simulation.step();
  return simulation.stats;
}

test("the wind field ends at the radius and scales with velocity squared", () => {
  const center = { x: 0, z: 0 };
  const position = { x: 2, z: 0 };
  const low = windAt(position, center, { wind: 80, radius: 8 });
  const high = windAt(position, center, { wind: 160, radius: 8 });
  assert.ok(Math.abs(high.y / low.y - 4) < 1e-9);
  assert.equal(
    windAt({ x: 8, z: 0 }, center, { wind: 160, radius: 8 }).length(),
    0,
  );
  assert.equal(windAt(position, center, { wind: 0, radius: 8 }).length(), 0);
  assert.ok(
    Number.isFinite(windAt(center, center, { wind: 160, radius: 8 }).y),
  );
});

test("without wind, the roof stays attached and all four walls stay stable", () => {
  const simulation = new Simulation({ wind: 0 });
  const stats = advance(simulation, 20);
  assert.equal(stats.total, 16);
  assert.equal(stats.detached, 0);
  assert.equal(stats.stable, 4);
});

test("the default tornado removes most of the roof without toppling the walls", () => {
  const simulation = new Simulation();
  const stats = advance(simulation, 20);
  assert.ok(stats.detached >= 13, `${stats.detached}/16 panels detached`);
  assert.equal(stats.stable, 4);
  for (const { body } of simulation.pieces) {
    for (const value of [
      ...body.position.toArray(),
      ...body.quaternion.toArray(),
    ])
      assert.ok(Number.isFinite(value));
    assert.ok(
      body.position.y > -0.5,
      "bodies do not tunnel through the ground",
    );
  }
});

test("stronger fastenings reduce roof loss, and extreme winds preserve wall stability", () => {
  const normal = advance(new Simulation(), 20);
  const reinforced = advance(new Simulation({ fastening: 160 }), 20);
  assert.ok(reinforced.detached < normal.detached);
  const extreme = advance(new Simulation({ wind: 280, radius: 12 }), 20);
  assert.equal(extreme.detached, 16);
  assert.equal(extreme.stable, 4);
});

test("reset reconstructs all bodies and allows a second run", () => {
  const simulation = new Simulation();
  advance(simulation, 12);
  assert.ok(simulation.stats.detached > 0);
  simulation.reset();
  assert.deepEqual(simulation.stats, {
    detached: 0,
    total: 16,
    stable: 4,
    elapsed: 0,
  });
  for (const piece of simulation.pieces) {
    assert.deepEqual(piece.body.position, piece.origin);
    assert.deepEqual(piece.body.quaternion, piece.orientation);
    assert.equal(piece.body.velocity.length(), 0);
    assert.equal(piece.body.angularVelocity.length(), 0);
    if (piece.kind === "roof") assert.equal(piece.body.mass, 0);
  }
  simulation.config.wind = 0;
  assert.equal(advance(simulation, 5).detached, 0);
  simulation.config.wind = 250;
  const stats = advance(simulation, 20);
  assert.equal(stats.detached, 16);
  assert.equal(stats.stable, 4);
});
