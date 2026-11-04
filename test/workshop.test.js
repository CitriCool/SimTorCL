import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EditorState } from "../src/editor-state.js";
import { Experiment } from "../src/district.js";
import { lessonConfig, LESSONS } from "../src/lessons.js";
import { alongRoute } from "../src/route.js";
import { explainEvent } from "../src/explanations.js";
import {
  cleanConfig,
  parseDocument,
  configurationDocument,
  shareLink,
  parseShareHash,
  MODEL_ID,
  htmlReport,
  parcelsCSV,
} from "../src/records.js";
import { recalculate, compareScenarios } from "../src/runs.js";
const base = {
  mode: "neighborhood",
  rows: 2,
  columns: 2,
  lotSize: 12,
  roadWidth: 4,
  greenPercent: 0,
  buildingPercent: 0,
  wind: 0,
};
const decode = (r) => parseDocument(JSON.stringify(r));
function blank() {
  const d = new EditorState(base);
  for (const o of [...d.plan.objects]) d.execute("remove", { id: o.id });
  return d;
}

test("independent trees and benches have persistent identities, actual pieces and undoable positions", () => {
  const d = blank();
  d.execute("place-item", { type: "tree", parcelId: "P01", slot: 0 });
  d.execute("place-item", { type: "bench", parcelId: "P01", slot: 4 });
  const tree = d.plan.items[0],
    bank = d.plan.items[1],
    e = new Experiment(d.config);
  assert.equal(e.environment.entities.length, 2);
  assert.equal(e.environment.pieces.length, 8);
  assert.ok(
    e.environment.pieces.every((p) => [tree.id, bank.id].includes(p.objectId)),
  );
  d.execute("move", { id: tree.id, parcelId: "P04", slot: 8 });
  assert.equal(d.find(tree.id).parcelId, "P04");
  d.undo();
  assert.equal(d.find(tree.id).parcelId, "P01");
  d.redo();
  d.execute("rotate", { id: tree.id });
  const moved = new Experiment(d.config);
  assert.ok(moved.environment.entities.some((e) => e.id === `V-${tree.id}`));
  d.execute("remove", { id: bank.id });
  assert.equal(d.plan.items.length, 1);
  d.undo();
  assert.equal(d.plan.items.length, 2);
});
test("invalid slots, overlap, buildings and park obstacles reject placement without consuming history or identities", () => {
  const d = blank();
  d.execute("place", { type: "house", parcelId: "P02" });
  d.execute("place", { type: "green", parcelId: "P03" });
  d.execute("place-item", { type: "tree", parcelId: "P01", slot: 4 });
  const before = d.snapshot(),
    count = d.past.length;
  for (const [parcelId, slot] of [
    ["P02", 0],
    ["P03", 0],
    ["P01", 4],
    ["P99", 0],
    ["P01", 9],
  ])
    assert.throws(() =>
      d.execute("place-item", { type: "tree", parcelId, slot }),
    );
  assert.deepEqual(d.snapshot(), before);
  assert.equal(d.past.length, count);
  d.execute("place-item", { type: "tree", parcelId: "P03", slot: 2 });
  assert.throws(
    () => d.execute("place", { type: "building", parcelId: "P01" }),
    /parcela|árboles|bancas/,
  );
});
test("wind damage of individually placed objects records origins, capacities, units and reproducible results", () => {
  const d = blank();
  d.execute("place-item", { type: "tree", parcelId: "P01", slot: 4 });
  d.execute("properties", { id: d.plan.items[0].id, anchorage: "weak" });
  d.execute("place-item", { type: "bench", parcelId: "P01", slot: 2 });
  const p = d.layout.parcels[0];
  d.settings = {
    ...d.settings,
    wind: 280,
    travelSpeed: 1,
    duration: 30,
    route: [
      { x: p.x - 8, z: p.z },
      { x: p.x + 8, z: p.z },
    ],
  };
  const e = new Experiment(d.config);
  e.recorder.sampleEvery = 240;
  for (let i = 0; i < 3600; i++) e.step();
  const r = decode(e.document());
  assert.ok(r.events.some((e) => e.unit === "N·m"));
  assert.ok(r.events.some((e) => e.type === "release"));
  assert.ok(r.events.every((e) => e.objectId && e.parcelId));
  assert.deepEqual(recalculate(r), r.results);
  assert.equal(r.scenarioModel.version, "scenario-controls-1");
  assert.equal(r.environmentModel.version, "urban-environment-workshop-1");
  assert.match(htmlReport(r), /scenario-controls-1/);
  assert.match(htmlReport(r), /30 s de duración/);
  assert.match(parcelsCSV(r), /elementos_independientes/);
  assert.match(parcelsCSV(r), /:tree:punto5:giro0/);
});
test("piecewise routes use arc length, exact corner transitions, global orientation and constant translation speed", () => {
  const points = [
    [0, 0],
    [3, 0],
    [3, 4],
  ];
  assert.deepEqual(alongRoute(points, 3), {
    x: 3,
    z: 0,
    progress: 3 / 7,
    length: 7,
  });
  assert.equal(alongRoute(points, 5).z, 2);
  assert.equal(alongRoute(points, 99).progress, 1);
  const e = new Experiment({
    ...base,
    orientation: 90,
    travelSpeed: 3,
    route: [
      { x: 0, z: 0 },
      { x: 3, z: 0 },
      { x: 3, z: 4 },
    ],
  });
  for (let i = 0; i < 120; i++) e.step();
  assert.ok(Math.abs(e.center.x) < 1e-6);
  assert.ok(Math.abs(e.center.z + 3) < 1e-6);
  for (let i = 0; i < 160; i++) e.step();
  assert.ok(Math.abs(e.center.x - 4) < 1e-6);
  assert.ok(Math.abs(e.center.z + 3) < 1e-6);
});
test("declared duration stops the calculation on its exact step and imports cannot exceed it", () => {
  const e = new Experiment({ ...base, duration: 5, travelSpeed: 4 });
  for (let i = 0; i < 900; i++) e.step();
  assert.equal(e.steps, 600);
  assert.equal(e.finished, true);
  const r = decode(e.document());
  assert.equal(r.steps, 600);
  const before = JSON.stringify(e.stats);
  assert.equal(e.step(), false);
  assert.equal(JSON.stringify(e.stats), before);
  assert.deepEqual(recalculate(r), r.results);
  const bad = structuredClone(r);
  bad.initial.duration = 4;
  assert.throws(() => decode(bad));
  const altered = structuredClone(r);
  altered.scenarioModel.routeVersion = "future";
  assert.throws(() => decode(altered), /recorrido/);
});
test("one pending route point cannot be saved; invalid geometry and weather leave draft state untouched", () => {
  const d = blank();
  d.execute("route-point", { x: 0, z: 0 });
  assert.throws(() => d.assertReady(), /otro punto/);
  const before = d.snapshot();
  assert.throws(() => d.execute("route-point", { x: 0.1, z: 0 }));
  assert.deepEqual(d.snapshot(), before);
  assert.throws(() => d.execute("route-point", { x: 10000, z: 0 }));
  assert.throws(() => d.execute("weather", { travelSpeed: 0 }));
  assert.deepEqual(d.snapshot(), before);
  d.execute("route-point", { x: 10, z: 0 });
  d.execute("weather", { travelSpeed: 3, duration: 15, wind: 250 });
  assert.equal(d.assertReady().route.length, 2);
  d.undo();
  assert.equal(d.settings.duration, null);
  d.redo();
  assert.equal(d.settings.duration, 15);
  d.execute("route-clear");
  assert.equal(d.assertReady().route, null);
});
test("all four examples are valid, modifiable, undoable synthetic configurations with reproducible physics", () => {
  for (const id of Object.keys(LESSONS)) {
    const config = lessonConfig(id),
      e = new Experiment(config);
    for (let i = 0; i < 60; i++) e.step();
    assert.equal(e.config.lesson, id);
    assert.equal(e.environment.entities.length > 0, true);
    assert.equal(config.route.length, 3);
    assert.equal(config.sitePlan.items.length, 2);
    assert.deepEqual(decode(configurationDocument(config)).initial, config);
  }
  const d = blank(),
    old = d.snapshot();
  d.loadExample(lessonConfig("plaza"));
  d.undo();
  assert.deepEqual(d.snapshot(), old);
  d.redo();
  assert.equal(d.settings.lesson, "plaza");
});
test("explanations preserve force versus moment units and distinguish overload, support and absent evidence", () => {
  const parent = {
    id: "ENV:E1",
    kind: "branch",
    type: "connection",
    time: 2,
    step: 240,
    demand: 620,
    capacity: 500,
    unit: "N·m",
    parents: [],
    parcelId: "P01",
  };
  const first = explainEvent(parent);
  assert.match(first.body, /620 N·m/);
  assert.match(first.body, /500 N·m/);
  assert.match(first.body, /educativa/);
  const release = explainEvent(
    {
      id: "ENV:E2",
      kind: "crown",
      type: "release",
      time: 2,
      parents: ["ENV:E1"],
    },
    [parent],
  );
  assert.equal(release.parents[0].id, "ENV:E1");
  assert.match(release.body, /perdió sus apoyos/);
  assert.match(explainEvent(null).body, /ausencia de fallas no valida/);
});
test("the former v2.6 manual model preserves all numerical results, events, poses and provenance", () => {
  const old = JSON.parse(
    fs.readFileSync(
      new URL("./fixtures/v2.6-editor.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(old.schemaVersion, 5);
  const r = decode(old);
  assert.equal(r.schemaVersion, 10);
  assert.equal(r.scenarioModel, null);
  assert.equal(r.initial.route, null);
  assert.equal(r.initial.sitePlan.version, "parcel-editor-1");
  assert.equal(MODEL_ID, "simtorcl-33082313");
  assert.deepEqual(r.events, old.events);
  assert.deepEqual(r.frames, old.frames);
  assert.deepEqual(r.parameterLibrary, old.parameterLibrary);
  assert.deepEqual(recalculate(r), old.results);
});
test("links preserve independent items, lessons, controls and geometry; comparison changes reinforcement alone", () => {
  const c = lessonConfig("reinforced"),
    url = new URL(shareLink("https://example.org/", c)),
    shared = parseShareHash(url.hash);
  assert.deepEqual(shared.config, c);
  const results = [...compareScenarios(c, "reinforcement", 100, 5)];
  assert.deepEqual(results[0].config.sitePlan, results[1].config.sitePlan);
  assert.deepEqual(results[0].config.route, results[1].config.route);
  const paths = [...compareScenarios(c, "trajectory", "horizontal", 5)];
  assert.deepEqual(paths[0].config.route, c.route);
  assert.equal(paths[1].config.route, null);
  assert.deepEqual(paths[0].config.sitePlan, paths[1].config.sitePlan);
  assert.throws(() =>
    cleanConfig({
      ...c,
      route: [
        { x: 0, z: 0 },
        { x: 0, z: 0 },
      ],
    }),
  );
  assert.throws(() => cleanConfig({ ...c, duration: 181 }));
});
