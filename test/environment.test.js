import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as CANNON from "cannon-es";
import { Experiment } from "../src/district.js";
import { FIXED_STEP } from "../src/physics.js";
import { ENV_MODEL } from "../src/environment.js";
import {
  parseDocument,
  applyFrame,
  environmentCSV,
  eventsCSV,
  componentsCSV,
  htmlReport,
  configurationDocument,
  shareLink,
  parseShareHash,
} from "../src/records.js";
import { recalculate } from "../src/runs.js";
const config = {
  mode: "neighborhood",
  environment: "physical",
  rows: 2,
  columns: 2,
  lotSize: 12,
  roadWidth: 4,
  greenPercent: 25,
  buildingPercent: 25,
  buildingFloors: 2,
  seed: 12,
  wind: 0,
  radius: 12,
};
const advance = (e, n) => {
  for (let i = 0; i < n; i++) e.step();
};
function expose(e, p, wind, steps = 60) {
  e.config.wind = wind;
  const center = new CANNON.Vec3(p.origin.x + 1, 0, p.origin.z + 0.3);
  for (let i = 0; i < steps; i++) {
    e.environment.prepareStep(center, 10 + i * FIXED_STEP);
    e.active.world.step(FIXED_STEP);
    e.environment.finishStep();
  }
}
test("physical neighborhoods add identifiable trees, banks and multi-storey buildings to the common world", () => {
  const e = new Experiment(config),
    env = e.environment;
  assert.deepEqual(env.entities.map((e) => e.type).sort(), [
    "bench",
    "bench",
    "building",
    "tree",
    "tree",
  ]);
  assert.equal(e.active.world.bodies.length, e.pieces.length + 1);
  assert.equal(new Set(env.entities.map((e) => e.id)).size, 5);
  assert.ok(
    env.pieces.every(
      (p) => e.active.world.bodies.includes(p.body) && p.parcelId && p.entityId,
    ),
  );
  assert.equal(env.pieces.filter((p) => p.kind === "window").length, 8);
  const tall = new Experiment({ ...config, buildingFloors: 5 });
  assert.equal(
    tall.environment.pieces.find((p) => p.kind === "core").size[1],
    15,
  );
});
test("zero wind keeps all environmental connections intact and bodies at their origins", () => {
  const e = new Experiment(config);
  advance(e, 240);
  assert.equal(e.stats.environment.detached, 0);
  assert.equal(e.stats.environment.broken, 0);
  assert.ok(
    e.environment.pieces.every(
      (p) => p.body.position.distanceTo(p.origin) < 1e-8,
    ),
  );
});
test("wind load can break tree anchors, branches and benches; small loads preserve them", () => {
  const low = new Experiment(config),
    high = new Experiment(config);
  const trunk = low.environment.pieces.find((p) => p.kind === "trunk");
  expose(low, trunk, 10);
  assert.equal(low.stats.environment.broken, 0);
  expose(
    high,
    high.environment.pieces.find((p) => p.kind === "trunk"),
    280,
    180,
  );
  assert.ok(
    high.environment.pieces.some((p) => p.kind === "trunk" && p.detached),
  );
  assert.ok(
    high.environment.connections.some((c) => c.kind === "branch" && c.broken),
  );
  const bench = high.environment.pieces.find((p) => p.kind === "bench");
  expose(high, bench, 280);
  assert.ok(bench.detached);
  assert.ok(
    high.pieces.every((p) => p.body.position.toArray().every(Number.isFinite)),
  );
  for (const e of high.environment.events)
    if (e.type === "connection") assert.ok(["N", "N·m"].includes(e.unit));
  assert.match(eventsCSV({ events: high.environment.events }), /N·m/);
});
test("buildings lose envelope parts under high wind while the declared fixed structure stays anchored", () => {
  const e = new Experiment(config),
    facade = e.environment.pieces.find((p) => p.kind === "facade"),
    core = e.environment.pieces.find((p) => p.kind === "core");
  expose(e, facade, 280, 120);
  assert.ok(
    e.environment.pieces.some(
      (p) => ["facade", "window", "terrace"].includes(p.kind) && p.detached,
    ),
  );
  assert.equal(core.detached, false);
  assert.equal(core.body.type, CANNON.Body.STATIC);
  assert.ok(core.body.position.distanceTo(core.origin) < 1e-8);
});
test("released urban debris can physically collide with a dwelling", () => {
  const e = new Experiment(config),
    env = e.environment,
    p = env.pieces.find((p) => p.kind === "seat");
  env.breakConnection(
    p.connections.find((c) => c.a === p),
    10000,
  );
  env.resolveSupports();
  const target = e.houses[0].simulation.pieces.find(
    (p) => p.kind === "wall" && p.details.facade === 3 && p.details.bay === 1,
  );
  p.body.position.set(target.origin.x - 3, 1.5, target.origin.z);
  p.body.velocity.set(20, 0, 0);
  p.body.quaternion.set(0, 0, 0, 1);
  p.body.aabbNeedsUpdate = true;
  let collided = false;
  p.body.addEventListener("collide", (event) => {
    if (event.body === target.body) collided = true;
  });
  advance(e, 70);
  assert.ok(collided);
});
test("a damaged physical run preserves environmental events, frames, provenance and recalculated results", () => {
  const e = new Experiment({ ...config, wind: 280, reinforcement: 50 });
  advance(e, 3000);
  const original = e.document("Entorno físico"),
    run = parseDocument(JSON.stringify(original));
  assert.ok(run.results.environment.detached > 0);
  assert.ok(run.events.some((e) => e.house === "ENV"));
  const tampered = structuredClone(run);
  tampered.events.find(
    (e) => e.house === "ENV" && e.type === "connection",
  ).connectionId = 4999;
  assert.throws(() => parseDocument(JSON.stringify(tampered)));
  assert.deepEqual(recalculate(run), run.results);
  const copy = new Experiment(run.initial, { record: false });
  applyFrame(copy, run, run.frames.length - 1);
  assert.deepEqual(
    copy.pieces.map((p) => p.body.position.toArray()),
    e.pieces.map((p) => p.body.position.toArray()),
  );
  assert.equal(
    environmentCSV(run).split("\r\n").length,
    run.results.environment.rows.length + 1,
  );
  assert.match(eventsCSV(run), /ENV/);
  assert.equal(
    componentsCSV(run, copy).split("\r\n").length,
    e.pieces.length + 1,
  );
  assert.match(htmlReport(run), /Procedencia del entorno urbano/);
  const conf = parseDocument(
    JSON.stringify(configurationDocument(e.config, "Configuración")),
  );
  assert.equal(conf.environmentModel.version, ENV_MODEL.version);
  const shared = parseShareHash(
    new URL(shareLink("https://example.org/", e.config, "Compartido")).hash,
  );
  assert.equal(
    new Experiment(shared.config).environment.pieces.length,
    e.environment.pieces.length,
  );
});
test("v2.3 files migrate as visual environments without adding collisions or altering past results", () => {
  const r = parseDocument(
    fs.readFileSync(
      new URL("./fixtures/v2.3-neighborhood.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(r.initial.environment, "visual");
  assert.equal(r.environmentModel, null);
  assert.deepEqual(recalculate(r), r.results);
  const e = new Experiment(r.initial);
  assert.equal(e.environment, null);
  assert.equal(e.active.world.bodies.length, e.pieces.length + 1);
});
test("modified environment models and unsupported heights are rejected without replacing the active world", () => {
  const e = new Experiment(config),
    world = e.active;
  for (const buildingFloors of [0, 1, 6, 2.5]) {
    assert.throws(() => e.reset({ buildingFloors }));
    assert.equal(e.active, world);
  }
  const bad = e.document();
  bad.environmentInventory.pieces[0].mass++;
  assert.throws(() => parseDocument(JSON.stringify(bad)));
  const r = e.document();
  r.environmentModel.parameters.treeAnchor.value++;
  assert.throws(() => parseDocument(JSON.stringify(r)));
});
test("official references are distinguished from educational mechanical calibration", () => {
  assert.ok(
    ENV_MODEL.sources.every(
      (s) =>
        s.institution && s.url.startsWith("https://") && s.section && s.status,
    ),
  );
  assert.ok(
    Object.values(ENV_MODEL.parameters).every(
      (p) =>
        p.unit &&
        Number.isFinite(p.value) &&
        p.evidence === "illustrative" &&
        p.sourceIds.length === 0,
    ),
  );
});
