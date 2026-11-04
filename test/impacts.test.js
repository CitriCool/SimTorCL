import test from "node:test";
import assert from "node:assert/strict";
import { Experiment } from "../src/district.js";
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
