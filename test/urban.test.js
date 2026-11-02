import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  generateNeighborhood,
  housePlacements,
  rotatePoint,
  URBAN_DEFAULTS,
  URBAN_RULES,
} from "../src/urban.js";
import { Experiment } from "../src/district.js";
import {
  applyFrame,
  configurationDocument,
  parseDocument,
  parcelsCSV,
  parseShareHash,
  shareLink,
  htmlReport,
} from "../src/records.js";
import { recalculate, compareScenarios } from "../src/runs.js";
const decode = (r) => parseDocument(JSON.stringify(r));
const advance = (e, n) => {
  for (let i = 0; i < n; i++) e.step();
};

test("a seed reconstructs all parcels, land uses, roads and house profiles", () => {
  const a = generateNeighborhood({ ...URBAN_DEFAULTS, seed: 638727 }),
    b = generateNeighborhood({ ...URBAN_DEFAULTS, seed: 638727 });
  assert.deepEqual(a, b);
  assert.equal(new Set(a.parcels.map((p) => p.id)).size, 12);
  assert.notDeepEqual(
    a.parcels.map((p) => p.type),
    generateNeighborhood({ ...URBAN_DEFAULTS, seed: 638728 }).parcels.map(
      (p) => p.type,
    ),
  );
  assert.deepEqual(a.counts, { house: 8, green: 3, building: 1, vacant: 0 });
});

test("every supported grid has one or more houses and counts match the requested rounding rules", () => {
  for (const rows of [2, 3, 4])
    for (const columns of [2, 3, 4])
      for (const density of [25, 100])
        for (const [greenPercent, buildingPercent] of [
          [0, 0],
          [50, 25],
          [25, 50],
        ]) {
          const layout = generateNeighborhood({
            ...URBAN_DEFAULTS,
            rows,
            columns,
            density,
            greenPercent,
            buildingPercent,
          });
          assert.equal(layout.parcels.length, rows * columns);
          assert.ok(layout.counts.house >= 1);
          assert.equal(
            Object.values(layout.counts).reduce((a, b) => a + b, 0),
            rows * columns,
          );
          assert.equal(
            layout.counts.green,
            Math.floor((rows * columns * greenPercent) / 100),
          );
          assert.equal(
            layout.counts.building,
            Math.floor((rows * columns * buildingPercent) / 100),
          );
          for (const [type, count] of Object.entries(layout.counts))
            assert.equal(
              layout.parcels.filter((p) => p.type === type).length,
              count,
            );
        }
});

test("parcels, setbacks, sidewalks and roads stay separate at all rotations and allowed dimensions", () => {
  for (const orientation of [0, 45, 90, 135, 180, 225, 270, 315])
    for (const lotSize of [12, 16, 20])
      for (const roadWidth of [4, 6, 8]) {
        const l = generateNeighborhood({
          ...URBAN_DEFAULTS,
          orientation,
          lotSize,
          roadWidth,
        });
        for (const [i, p] of l.parcels.entries()) {
          for (const q of l.parcels.slice(i + 1))
            assert.ok(
              Math.abs(p.x - q.x) >= lotSize + 2 * URBAN_RULES.sidewalk ||
                Math.abs(p.z - q.z) >= lotSize + 2 * URBAN_RULES.sidewalk,
            );
          for (const r of l.roads)
            assert.ok(
              Math.abs(p.x - r.x) >=
                (lotSize + r.width) / 2 + URBAN_RULES.sidewalk - 1e-8 ||
                Math.abs(p.z - r.z) >=
                  (lotSize + r.depth) / 2 + URBAN_RULES.sidewalk - 1e-8,
            );
          const local = rotatePoint(p.world.x, p.world.z, -l.yaw);
          assert.ok(
            Math.abs(local.x - p.x) < 1e-5 && Math.abs(local.z - p.z) < 1e-5,
          );
          assert.ok(
            Math.abs(p.world.x) + lotSize / Math.SQRT2 <=
              l.bounds.width / 2 + 1e-5,
          );
          assert.ok(
            Math.abs(p.world.z) + lotSize / Math.SQRT2 <=
              l.bounds.depth / 2 + 1e-5,
          );
          assert.ok((lotSize - URBAN_RULES.houseFootprint) / 2 > 2);
          assert.ok((lotSize - URBAN_RULES.reserveFootprint) / 2 >= 2);
        }
      }
});

test("rotation preserves parcel identities and profiles while rotating the actual physical house bodies", () => {
  const a = new Experiment({ mode: "neighborhood", orientation: 0, wind: 0 }),
    b = new Experiment({ ...a.config, orientation: 90 });
  assert.deepEqual(
    a.active.layout.parcels.map((p) => [p.id, p.type]),
    b.active.layout.parcels.map((p) => [p.id, p.type]),
  );
  assert.equal(a.houses.length, b.houses.length);
  a.houses.forEach((h, i) => {
    assert.equal(h.parcelId, b.houses[i].parcelId);
    assert.equal(h.simulation.profile.id, b.houses[i].simulation.profile.id);
    h.simulation.pieces.forEach((p, j) => {
      const point = rotatePoint(p.origin.x, p.origin.z, Math.PI / 2),
        q = b.houses[i].simulation.pieces[j];
      assert.ok(
        Math.abs(q.origin.x - point.x) < 1e-5 &&
          Math.abs(q.origin.z - point.z) < 1e-5,
      );
    });
  });
  advance(b, 30);
  assert.equal(b.stats.broken, 0);
  assert.equal(b.stats.houseTotal, b.active.layout.counts.house);
});

test("only residential lots add physical bodies; park and building reservations do not add simulated structures", () => {
  const e = new Experiment({
    mode: "neighborhood",
    environment: "visual",
    greenPercent: 50,
    buildingPercent: 25,
    density: 25,
    wind: 0,
  });
  assert.equal(e.houses.length, 1);
  assert.equal(new Set(e.houses.map((h) => h.simulation.world)).size, 1);
  assert.equal(e.active.world.bodies.length, e.pieces.length + 1);
  for (const h of e.houses)
    assert.equal(
      e.active.layout.parcels.find((p) => p.id === h.parcelId).type,
      "house",
    );
  const r = decode(e.document());
  assert.equal(r.results.rows.length, 1);
  assert.equal(r.results.rows[0].parcelId, e.houses[0].parcelId);
});

test("urban JSON, CSV, links, frames and recalculation preserve the generated plan", () => {
  const e = new Experiment({
    mode: "neighborhood",
    rows: 2,
    columns: 3,
    orientation: 45,
    seed: 12,
    wind: 280,
    radius: 12,
    reinforcement: 50,
  });
  advance(e, 240);
  e.setParameter("wind", 240);
  advance(e, 60);
  const r = decode(e.document("Barrio reproducible")),
    copy = new Experiment(r.initial, { record: false });
  assert.equal(r.schemaVersion, 3);
  assert.deepEqual(r.layout, e.active.layout);
  assert.deepEqual(recalculate(r), r.results);
  applyFrame(copy, r, r.frames.length - 1);
  assert.deepEqual(
    copy.pieces.map((p) => p.body.position.toArray()),
    e.pieces.map((p) => p.body.position.toArray()),
  );
  const conf = decode(configurationDocument(e.config, "Plano"));
  assert.deepEqual(conf.layout, r.layout);
  const shared = parseShareHash(
    new URL(shareLink("https://example.org/", e.config, "Barrio")).hash,
  );
  assert.deepEqual(new Experiment(shared.config).active.layout, r.layout);
  assert.equal(parcelsCSV(r).split("\r\n").length, r.layout.parcels.length + 1);
  assert.ok(htmlReport(r).includes("<h2>Plano del barrio</h2>"));
});

test("a tornado produces recorded damage in a generated neighborhood and can be recalculated", () => {
  const e = new Experiment({
    mode: "neighborhood",
    rows: 2,
    columns: 2,
    lotSize: 12,
    roadWidth: 4,
    greenPercent: 0,
    buildingPercent: 0,
    wind: 280,
    radius: 12,
    reinforcement: 50,
    seed: 12,
  });
  advance(e, 1800);
  assert.ok(e.stats.broken > 0);
  assert.ok(e.events.length > 0);
  const run = decode(e.document());
  assert.deepEqual(recalculate(run), run.results);
  assert.ok(
    run.events.every((event) => e.houses.some((h) => h.label === event.house)),
  );
});

test("v2.2 execution files migrate without changing their physical results", () => {
  const legacy = parseDocument(
    fs.readFileSync(
      new URL("./fixtures/v2.2-run.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(legacy.schemaVersion, 3);
  assert.equal(legacy.layout, null);
  assert.deepEqual(recalculate(legacy), legacy.results);
});

test("mismatched saved layouts and invalid planning parameters are rejected atomically", () => {
  const e = new Experiment({ mode: "neighborhood" }),
    active = e.active;
  for (const changes of [
    { rows: 5 },
    { columns: 1 },
    { seed: -1 },
    { seed: 1.5 },
    { lotSize: 8 },
    { roadWidth: 0 },
    { orientation: 1 },
    { greenPercent: 50, buildingPercent: 50 },
    { density: 0 },
  ]) {
    assert.throws(() => e.reset(changes));
    assert.equal(e.active, active);
  }
  for (const alter of [
    (r) => r.layout.parcels[0].world.x++,
    (r) => (r.layout.version = "unknown"),
    (r) => delete r.layout,
  ]) {
    const r = e.document();
    alter(r);
    assert.throws(() => decode(r));
  }
});

test("urban comparisons change one planning condition and retain the same seed", () => {
  const config = {
    mode: "neighborhood",
    rows: 2,
    columns: 2,
    greenPercent: 50,
    buildingPercent: 25,
    wind: 0,
  };
  for (const [key, value] of [
    ["lotSize", 12],
    ["orientation", 90],
  ]) {
    const [a, b] = [...compareScenarios(config, key, value, 5)];
    assert.equal(a.config.seed, b.config.seed);
    assert.deepEqual(
      Object.keys(a.config).filter((k) => a.config[k] !== b.config[k]),
      [key],
    );
    assert.equal(a.stats.broken, 0);
    assert.equal(b.stats.broken, 0);
  }
});
