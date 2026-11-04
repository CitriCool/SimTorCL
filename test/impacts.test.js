import test from "node:test";
import assert from "node:assert/strict";
import { Experiment } from "../src/district.js";
import { Simulation } from "../src/physics.js";
import { lessonConfig } from "../src/lessons.js";
import { explainEvent } from "../src/explanations.js";
import {
  eventsCSV,
  parseDocument,
  parseShareHash,
  shareLink,
} from "../src/records.js";

const plaza = { ...lessonConfig("plaza"), wind: 280 };

function run(config, steps) {
  const experiment = new Experiment(config);
  for (let i = 0; i < steps; i++) experiment.step();
  return experiment.document();
}

test("an urban fragment causes a reproducible housing failure and loss of support", () => {
  const config = { ...plaza, impact: "contact-v1" };
  const original = run(config, 480);
  const record = parseDocument(JSON.stringify(original));
  const impact = record.events.find(
    (e) => e.house === "C01" && e.impact?.sourceReleaseId.startsWith("ENV:"),
  );
  assert.ok(impact, "the plaza produces an impact from the urban environment");
  const origin = record.events.find(
    (e) => e.id === impact.impact.sourceReleaseId,
  );
  assert.equal(origin.type, "release");
  assert.ok(impact.parents.includes(origin.id));
  assert.ok(impact.demand > impact.capacity);
  assert.ok(
    record.events.some(
      (e) => e.type === "release" && e.parents.includes(impact.id),
    ),
  );
  assert.match(
    explainEvent(impact, record.events).body,
    /Fragmento de origen.*Receptor C01/,
  );
  assert.ok(eventsCSV(record).includes("desprendimiento_origen"));

  const repeat = run(record.initial, record.steps);
  assert.deepEqual(repeat.events, original.events);
  assert.deepEqual(repeat.frames, original.frames);
  const link = shareLink("https://example.com", config, "Impactos");
  assert.equal(parseShareHash(new URL(link).hash).config.impact, "contact-v1");

  impact.impact.sourceReleaseId = "ENV:E99999";
  assert.throws(() => parseDocument(JSON.stringify(record)), /impacto/i);
});

test("legacy schema 6 retains its physics and still runs with impacts disabled", () => {
  const original = run(plaza, 480);
  assert.ok(original.events.some((e) => e.type === "release"));
  assert.ok(original.events.every((e) => e.cause !== "impact"));
  const legacy = structuredClone(original);
  legacy.schemaVersion = 6;
  delete legacy.initial.impact;
  delete legacy.impactModel;
  const migrated = parseDocument(JSON.stringify(legacy));
  assert.equal(migrated.initial.impact, "off");
  const repeat = run(migrated.initial, migrated.steps);
  assert.deepEqual(repeat.events, original.events);
  assert.deepEqual(repeat.frames, original.frames);
});

test("enabled impacts do not break intact stationary pieces at zero wind", () => {
  const record = run({ ...plaza, wind: 0, impact: "contact-v1" }, 240);
  assert.deepEqual(record.events, []);
});

function roofCrossing(mode, { miss = false, blocker = false } = {}) {
  const simulation = new Simulation({ wind: 0, impact: mode });
  const roof = simulation.addPiece(
    "roof",
    [1.4, 0.06, 1.4],
    [30, 10, 30],
    [0, Math.PI / 4, 0.2],
    20,
  );
  simulation.connect(
    "roof",
    roof,
    simulation.pieces.find((p) => p.kind === "wall"),
    500,
  );
  if (blocker)
    simulation.addPiece(
      "core",
      [1.4, 0.06, 1.4],
      [30, 10.45, 30],
      [0, 0, 0],
      200,
    );
  const horizontal = miss ? 30.9 : 30;
  const debris = simulation.addPiece(
    "roof",
    [0.3, 0.08, 0.3],
    [horizontal, 10.75, horizontal],
    [0, 0, 0],
    100,
  );
  simulation.release(debris);
  debris.body.velocity.set(0, -180, 0);
  simulation.step();
  return {
    roof,
    debris,
    impacts: simulation.events.filter((event) => event.cause === "impact"),
  };
}

test("a fast fragment crosses a thin rotated roof in v2.8 and is stopped by the sweep", () => {
  const discrete = roofCrossing("contact-v1");
  assert.ok(discrete.debris.body.position.y < 10);
  assert.equal(discrete.roof.detached, false);

  const swept = roofCrossing("swept-v2");
  assert.ok(swept.debris.body.position.y > 10);
  assert.equal(swept.roof.detached, true);
  assert.equal(swept.impacts.length, 1);
  assert.equal(swept.impacts[0].impact.targetPieceId, swept.roof.id);
  assert.ok(swept.impacts[0].impact.sweepFraction > 0);
});

test("a lateral pass clears a rotated roof and the nearest solid blocks a hit behind it", () => {
  const miss = roofCrossing("swept-v2", { miss: true });
  assert.ok(miss.debris.body.position.y < 10);
  assert.equal(miss.roof.detached, false);
  assert.deepEqual(miss.impacts, []);

  const blocked = roofCrossing("swept-v2", { blocker: true });
  assert.ok(blocked.debris.body.position.y > 10.45);
  assert.equal(blocked.roof.detached, false);
  assert.deepEqual(blocked.impacts, []);
});

test("a swept plaza impact survives export, import and recalculation", () => {
  const original = run({ ...plaza, impact: "swept-v2" }, 420);
  const record = parseDocument(JSON.stringify(original));
  const impact = record.events.find(
    (e) => e.impact?.sweepFraction !== undefined,
  );
  assert.ok(impact);
  assert.match(explainEvent(impact, record.events).body, /barrido detectó/);
  const repeat = run(record.initial, record.steps);
  assert.deepEqual(repeat.events, original.events);
  assert.deepEqual(repeat.frames, original.frames);
  const share = shareLink("https://example.com", record.initial);
  assert.equal(parseShareHash(new URL(share).hash).config.impact, "swept-v2");
  impact.impact.sweepFraction = 1.1;
  assert.throws(() => parseDocument(JSON.stringify(record)), /barrido/i);
});
