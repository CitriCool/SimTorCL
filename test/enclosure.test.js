import test from "node:test";
import assert from "node:assert/strict";
import { Vec3 } from "cannon-es";
import { balancePressure } from "../src/enclosure.js";
import { Simulation } from "../src/physics.js";
import { Experiment } from "../src/district.js";
import { parseDocument, parseShareHash, shareLink } from "../src/records.js";

test("pressure balance handles positive, negative and opposing openings", () => {
  assert.equal(balancePressure([]), 0);
  assert.ok(
    Math.abs(balancePressure([{ area: 1, pressure: 101 }]) - 100) < 1e-6,
  );
  assert.ok(
    Math.abs(balancePressure([{ area: 1, pressure: -101 }]) + 100) < 1e-6,
  );
  assert.equal(
    balancePressure([
      { area: 1, pressure: 100 },
      { area: 1, pressure: -100 },
    ]),
    0,
  );
});

test("an opening changes roof uplift in both directions and does not pressurize at zero wind", () => {
  for (const x of [4, -4]) {
    const center = new Vec3(x, 0, 0);
    const closed = new Simulation({
      wind: 160,
      radius: 12,
      enclosure: "closed",
    });
    const open = new Simulation({
      wind: 160,
      radius: 12,
      enclosure: "front-opening",
    });
    closed.prepareStep(center, 1.8);
    open.prepareStep(center, 1.8);
    assert.equal(closed.stats.enclosure.pressure, 0);
    assert.equal(open.stats.enclosure.openingArea, 1);
    assert.equal(Math.sign(open.stats.enclosure.pressure), Math.sign(x));
    const roof = (sim) => sim.pieces.find((p) => p.kind === "roof");
    assert.equal(
      Math.sign(roof(open).demand - roof(closed).demand),
      Math.sign(x),
    );
    open.config.wind = 0;
    open.prepareStep(center, 1.8);
    assert.equal(open.stats.enclosure.pressure, 0);
  }
});

test("detached cladding opens a bay and a missing wall replaces that aperture", () => {
  const sim = new Simulation({
    profile: "timber",
    wind: 160,
    radius: 12,
    enclosure: "closed",
  });
  const clad = sim.pieces.find(
    (p) => p.kind === "cladding" && p.details.front && p.details.bay === 1,
  );
  const wall = clad.connections[0].b;
  const center = new Vec3(4, 0, 0);
  sim.release(clad);
  sim.prepareStep(center, 1.8);
  assert.ok(sim.stats.enclosure.pressure > 0);
  assert.equal(sim.stats.enclosure.openingArea, clad.area);
  sim.release(wall);
  sim.prepareStep(center, 1.8);
  assert.equal(sim.stats.enclosure.openingArea, wall.area);
  const previousPressure = sim.stats.enclosure.pressure;
  const roof = sim.pieces.find((p) => p.kind === "roof");
  sim.release(roof);
  sim.prepareStep(center, 1.8);
  assert.equal(sim.stats.enclosure.openingArea, wall.area + roof.area);
  assert.ok(sim.stats.enclosure.pressure < previousPressure);
});

test("saved enclosure experiments reproduce their pressures, and v2.10 defaults to off", () => {
  function run(config) {
    const sim = new Experiment(config);
    for (let i = 0; i < 100; i++) sim.step();
    return sim.document();
  }
  const config = { wind: 160, radius: 12, enclosure: "front-opening" };
  const record = parseDocument(JSON.stringify(run(config)));
  assert.equal(record.enclosureModel.version, "single-zone-v1");
  assert.ok(
    record.frames.some((frame) => frame.stats.enclosure.pressure !== 0),
  );
  assert.deepEqual(run(record.initial).frames, record.frames);
  const link = new URL(shareLink("https://example.com", record.initial));
  assert.equal(parseShareHash(link.hash).config.enclosure, "front-opening");
  const legacy = run({ wind: 160 });
  legacy.schemaVersion = 8;
  delete legacy.enclosureModel;
  delete legacy.initial.enclosure;
  const imported = parseDocument(JSON.stringify(legacy));
  assert.equal(imported.initial.enclosure, "off");
  assert.deepEqual(run(imported.initial).frames, legacy.frames);
});
