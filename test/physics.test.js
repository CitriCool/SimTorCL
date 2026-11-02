import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, FIXED_STEP, RULES, windAt } from "../src/physics.js";
import { PROFILES, ROOFS, CENSUS, validateConfig } from "../src/catalog.js";
import { compareProfiles } from "../src/comparison.js";

function advance(s, seconds) {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) s.step();
  return s.stats;
}
function assertFinite(s) {
  for (const { body } of s.pieces) {
    for (const v of [
      ...body.position.toArray(),
      ...body.quaternion.toArray(),
      ...body.velocity.toArray(),
    ])
      assert.ok(Number.isFinite(v));
    body.updateAABB();
    assert.ok(
      body.aabb.lowerBound.y >= -0.011,
      "no fragment is below the floor",
    );
  }
}

test("catalog profiles map to census categories without splitting the timber/steel census category", () => {
  for (const profile of Object.values(PROFILES)) {
    assert.ok(CENSUS.walls.includes(profile.censusWall));
    assert.ok(profile.roofs.includes(profile.defaultRoof));
  }
  assert.equal(PROFILES.timber.censusWall, PROFILES.steel.censusWall);
  for (const roof of Object.values(ROOFS))
    assert.ok(CENSUS.roofs.includes(roof.censusRoof));
});

test("invalid or incompatible scenarios are rejected before simulation", () => {
  for (const config of [
    { profile: "unknown" },
    { profile: "__proto__" },
    { roof: "unknown" },
    { profile: "timber", roof: "slab" },
    { wind: NaN },
    { wind: -1 },
    { wind: 285 },
    { radius: Infinity },
    { radius: 0 },
    { reinforcement: 0 },
  ])
    assert.throws(() => new Simulation(config), RangeError);
  assert.equal(validateConfig().profile, "masonry");
});

test("wind pressure scales with speed squared and vanishes outside the field", () => {
  const point = { x: 2, y: 2, z: 0 },
    center = { x: 0, z: 0 };
  const low = windAt(point, center, { wind: 80, radius: 8 }),
    high = windAt(point, center, { wind: 160, radius: 8 });
  assert.ok(Math.abs(high.y / low.y - 4) < 1e-9);
  assert.equal(
    windAt({ x: 8, z: 0 }, center, { wind: 160, radius: 8 }).length(),
    0,
  );
  assert.equal(
    windAt({ x: 0, y: 32, z: 0 }, center, { wind: 160, radius: 8 }).length(),
    0,
  );
  assert.equal(windAt(point, center, { wind: 0, radius: 8 }).length(), 0);
  assert.ok(
    Number.isFinite(windAt(center, center, { wind: 160, radius: 8 }).y),
  );
});

for (const profile of Object.values(PROFILES))
  for (const roof of profile.roofs) {
    test(`${profile.id}/${roof}: all attachments remain intact without wind`, () => {
      const s = new Simulation({ profile: profile.id, roof, wind: 0 });
      const stats = advance(s, 5);
      assert.equal(stats.broken, 0);
      assert.equal(stats.detached, 0);
      assert.equal(stats.wallDetached, 0);
      assert.equal(stats.secondaryDetached, 0);
      assert.equal(stats.stable, stats.facadeTotal);
      assert.equal(stats.state, "Estable");
      for (const piece of s.pieces)
        assert.deepEqual(piece.body.position, piece.origin);
      assertFinite(s);
    });
  }

test("roof loss alone does not classify the structure as collapsed", () => {
  const s = new Simulation();
  const stats = advance(s, 12);
  assert.ok(stats.detached > 0);
  assert.equal(stats.structuralBroken, 0);
  assert.equal(stats.wallDetached, 0);
  assert.equal(stats.state, "Estable");
  assert.equal(stats.stable, 4);
  assertFinite(s);
});

test("reinforcing the same scenario reduces roof detachment", () => {
  const normal = advance(new Simulation(), 12);
  const reinforced = advance(new Simulation({ reinforcement: 200 }), 12);
  assert.ok(reinforced.detached < normal.detached);
});

test("masonry: extreme loading can break structural bonds and topple segments", () => {
  const s = new Simulation({ wind: 280, radius: 12 });
  const stats = advance(s, 20);
  assert.ok(stats.structuralBroken > 0);
  assert.ok(stats.wallDetached > 0);
  assert.ok(stats.maxDisplacement > RULES.stableDisplacement);
  assert.ok(stats.maxTilt > RULES.collapseTilt);
  assert.equal(stats.state, "Colapso del modelo");
  assertFinite(s);
});

test("timber: cladding and frame have independent failures", () => {
  const s = new Simulation({ profile: "timber", wind: 280, radius: 12 });
  let claddingFirst = false;
  for (let i = 0; i < Math.round(20 / FIXED_STEP); i++) {
    s.step();
    if (!s.stats.wallDetached && s.stats.secondaryDetached)
      claddingFirst = true;
  }
  assert.ok(claddingFirst);
  assert.ok(s.stats.secondaryDetached > 0);
  assert.ok(s.stats.wallDetached > 0);
  assertFinite(s);
});

test("concrete: secondary windows can detach while structural panels remain supported", () => {
  const s = new Simulation({
    profile: "concrete",
    roof: "slab",
    wind: 280,
    radius: 12,
  });
  const stats = advance(s, 20);
  assert.ok(stats.secondaryDetached > 0);
  assert.equal(stats.wallDetached, 0);
  assert.equal(stats.state, "Estable");
  assert.equal(stats.total, 1);
  assert.equal(stats.detached, 0);
  assertFinite(s);
});

test("a slab loses support as one heavy body, not a set of metal sheets", () => {
  const s = new Simulation({ profile: "concrete", roof: "slab", wind: 0 });
  const slab = s.pieces.find((p) => p.kind === "roof");
  assert.ok(slab.mass > 10000);
  const mounts = slab.connections.filter((c) => c.kind === "roof");
  mounts[0].broken = true;
  mounts[1].broken = true;
  s.resolveSupports();
  assert.equal(slab.detached, true);
  assert.ok(mounts.every((c) => c.broken));
  advance(s, 2);
  assertFinite(s);
});

test("unbroken wall bonds remain physical constraints in unsupported clusters", () => {
  const s = new Simulation({ wind: 0 });
  s.connections
    .filter((c) => c.kind === "base")
    .forEach((c) => {
      c.broken = true;
    });
  s.resolveSupports();
  const clusterBonds = s.connections.filter((c) =>
    ["wall", "corner"].includes(c.kind),
  );
  assert.ok(clusterBonds.every((c) => c.constraint));
  assert.equal(s.stats.wallDetached, s.stats.wallTotal);
  clusterBonds[0].broken = true;
  s.resolveSupports();
  assert.equal(clusterBonds[0].constraint, null);
  advance(s, 1);
  assertFinite(s);
});

test("reset clears damage, clusters, velocities and peak metrics, and rebuilds a different profile", () => {
  const s = new Simulation({ profile: "timber", wind: 280, radius: 12 });
  advance(s, 8);
  assert.ok(s.stats.broken > 0);
  const oldWorld = s.world,
    oldRevision = s.revision;
  s.reset({ profile: "concrete", roof: "slab", wind: 0 });
  assert.notEqual(s.world, oldWorld);
  assert.equal(s.revision, oldRevision + 1);
  assert.equal(s.stats.broken, 0);
  assert.equal(s.stats.elapsed, 0);
  assert.equal(s.stats.maxTilt, 0);
  assert.equal(s.stats.maxDisplacement, 0);
  assert.equal(s.stats.total, 1);
  assert.equal(s.world.constraints.length, 0);
  for (const p of s.pieces) {
    assert.equal(p.body.velocity.length(), 0);
    assert.equal(p.body.angularVelocity.length(), 0);
    assert.deepEqual(p.body.quaternion, p.orientation);
  }
  assert.equal(advance(s, 3).broken, 0);
});

test("replaying the same damaged scenario is deterministic", () => {
  const s = new Simulation({ profile: "timber", wind: 250, radius: 10 });
  const first = advance(s, 10);
  const positions = s.pieces.map((p) => p.body.position.clone());
  s.reset();
  const second = advance(s, 10);
  assert.deepEqual(second, first);
  s.pieces.forEach((p, i) =>
    assert.ok(p.body.position.distanceTo(positions[i]) < 1e-8),
  );
});

test("comparison uses identical inputs/duration and explicitly skips unavailable combinations", () => {
  const config = { wind: 160, radius: 8, reinforcement: 100, roof: "slab" };
  const results = [...compareProfiles(config, 5)];
  assert.equal(results.length, 4);
  assert.equal(results.filter((r) => r.unavailable).length, 2);
  for (const result of results.filter((r) => !r.unavailable)) {
    assert.equal(result.seconds, 5);
    for (const [key, value] of Object.entries(config))
      assert.equal(result.config[key], value);
    assert.ok(Math.abs(result.stats.elapsed - 5) < 1e-9);
  }
  assert.throws(() => [...compareProfiles(config, 100)], RangeError);
});

test("all profile/roof combinations remain finite under intense wind with weak connections", () => {
  for (const profile of Object.values(PROFILES))
    for (const roof of profile.roofs) {
      const s = new Simulation({
        profile: profile.id,
        roof,
        wind: 280,
        radius: 12,
        reinforcement: 50,
      });
      advance(s, 20);
      assertFinite(s);
      assert.ok(s.stats.detached <= s.stats.total);
      assert.ok(s.stats.wallDetached <= s.stats.wallTotal);
    }
});
