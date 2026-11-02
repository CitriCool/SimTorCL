import test from "node:test";
import assert from "node:assert/strict";
import { Experiment } from "../src/district.js";
import { FIXED_STEP } from "../src/physics.js";
function advance(s, seconds) {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) s.step();
}
for (const mode of ["block9", "block16"])
  test(`${mode}: shared world, distinct lots, zero-wind stability and aggregate counts`, () => {
    const s = new Experiment();
    s.reset({ mode, wind: 0 });
    advance(s, 2);
    assert.equal(s.houses.length, mode === "block9" ? 9 : 16);
    assert.equal(new Set(s.houses.map((h) => h.simulation.world)).size, 1);
    assert.equal(
      new Set(s.houses.map((h) => `${h.offset.x},${h.offset.z}`)).size,
      s.houses.length,
    );
    assert.equal(s.stats.broken, 0);
    assert.equal(s.stats.affected, 0);
    assert.equal(
      s.stats.total,
      s.stats.rows.reduce((sum, r) => sum + r.total, 0),
    );
    assert.ok(s.houses.every((h) => h.simulation.elapsed === s.elapsed));
  });
test("district traversal is linear, monotonic and stops at its end; reset rebuilds intact houses", () => {
  const s = new Experiment();
  s.reset({ mode: "block9", spacing: 10, wind: 250, radius: 12 });
  const start = s.center.clone();
  advance(s, 12);
  assert.ok(s.center.x > start.x);
  assert.ok(s.stats.affected > 0 && s.stats.affected < 9);
  for (const p of s.pieces)
    assert.ok(p.body.position.toArray().every(Number.isFinite));
  s.reset({ wind: 0 });
  assert.equal(s.elapsed, 0);
  assert.equal(s.stats.broken, 0);
  assert.deepEqual(s.center, start);
  advance(s, 60);
  const end = s.center.clone();
  advance(s, 1);
  assert.deepEqual(s.center, end);
  s.reset({ mode: "single" });
  assert.equal(s.houses, undefined);
  assert.equal(s.stats.total, 16);
});
test("a released fragment can collide with a different house in the shared world", () => {
  const s = new Experiment();
  s.reset({ mode: "block9", spacing: 10, wind: 0 });
  const owner = s.houses[0].simulation,
    target = s.houses[1].simulation.pieces.find(
      (p) => p.kind === "wall" && p.details.facade === 3 && p.details.bay === 1,
    );
  const projectile = owner.pieces.find((p) => p.kind === "roof");
  projectile.connections.forEach((c) => (c.broken = true));
  owner.resolveSupports();
  projectile.body.position.set(target.origin.x - 2, 1.5, target.origin.z);
  projectile.body.velocity.set(20, 0, 0);
  projectile.body.aabbNeedsUpdate = true;
  let contact = false;
  projectile.body.addEventListener("collide", (e) => {
    if (e.body === target.body) contact = true;
  });
  advance(s, 0.4);
  assert.ok(contact, "fragment collides across house ownership");
});
test("invalid district sizes and mixed slab configurations are rejected without losing the active scene", () => {
  const s = new Experiment();
  assert.throws(() => s.reset({ mode: "bad" }), RangeError);
  assert.equal(s.config.mode, "single");
  assert.throws(() => s.reset({ mode: "block9", spacing: 0 }), RangeError);
  assert.throws(() => s.reset({ mode: "block9", roof: "slab" }), RangeError);
});
