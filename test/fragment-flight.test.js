import test from "node:test";
import assert from "node:assert/strict";
import { Body, Box, Vec3 } from "cannon-es";
import { applyFragmentAir } from "../src/fragment-flight.js";
import { compareFragmentFlight } from "../src/fragment-trial.js";
import { Experiment } from "../src/district.js";
import { parseDocument, parseShareHash, shareLink } from "../src/records.js";
import { lessonConfig } from "../src/lessons.js";

test("projected drag distinguishes face-on and edge-on exposure and vanishes at wind speed", () => {
  const size = [2, 1, 0.05];
  const body = new Body({ mass: 20, shape: new Box(new Vec3(1, 0.5, 0.025)) });
  const air = new Vec3(0, 0, 20);
  applyFragmentAir(body, size, air, 1 / 120);
  const faceOn = body.force.z;
  body.force.setZero();
  body.quaternion.setFromEuler(0, Math.PI / 2, 0);
  body.updateInertiaWorld(true);
  applyFragmentAir(body, size, air, 1 / 120);
  assert.ok(faceOn > 10 * body.force.z);
  assert.ok(body.force.z > 0);
  body.force.setZero();
  body.velocity.copy(air);
  applyFragmentAir(body, size, air, 1 / 120);
  assert.equal(body.force.length(), 0);
});

test("both catalog fragments contact the ground and fly differently under the same wind", () => {
  const [sheet, panel] = compareFragmentFlight(160);
  assert.ok(sheet.mass < panel.mass);
  assert.ok(sheet.distance > panel.distance);
  assert.ok(sheet.turn > panel.turn && panel.turn > 0);
  assert.ok(sheet.speed > panel.speed && panel.speed > 0);
  assert.ok(sheet.time < 10 && panel.time < 10);
  assert.ok(compareFragmentFlight(0).every((piece) => piece.distance < 1e-6));
});

test("new urban flight can be replayed and schema 7 keeps its original flight model", () => {
  const config = { ...lessonConfig("plaza"), wind: 280, impact: "swept-v2" };
  function run(settings) {
    const experiment = new Experiment(settings);
    for (let i = 0; i < 480; i++) experiment.step();
    return experiment.document();
  }
  const original = run({ ...config, fragmentFlight: "projected-v1" });
  const saved = parseDocument(JSON.stringify(original));
  assert.equal(saved.fragmentModel.version, "projected-v1");
  assert.ok(saved.events.some((event) => event.impact));
  const replay = run(saved.initial);
  assert.deepEqual(replay.events, original.events);
  assert.deepEqual(replay.frames, original.frames);
  const share = new URL(shareLink("https://example.com", saved.initial));
  assert.equal(
    parseShareHash(share.hash).config.fragmentFlight,
    "projected-v1",
  );

  const legacy = run(config);
  legacy.schemaVersion = 7;
  delete legacy.initial.fragmentFlight;
  delete legacy.fragmentModel;
  const restored = parseDocument(JSON.stringify(legacy));
  assert.equal(restored.initial.fragmentFlight, "legacy");
  const legacyReplay = run(restored.initial);
  assert.deepEqual(legacyReplay.events, legacy.events);
  assert.deepEqual(legacyReplay.frames, legacy.frames);
  assert.notDeepEqual(replay.frames, legacyReplay.frames);
});
