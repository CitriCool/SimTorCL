import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EditorState } from "../src/editor-state.js";
import { Experiment } from "../src/district.js";
import { generateNeighborhood } from "../src/urban.js";
import { environmentBlueprint } from "../src/environment.js";
import {
  configurationDocument,
  parseDocument,
  shareLink,
  parseShareHash,
  applyFrame,
  parcelsCSV,
  htmlReport,
  MODEL_ID,
} from "../src/records.js";
import { recalculate, compareScenarios } from "../src/runs.js";
const config = {
  mode: "neighborhood",
  rows: 2,
  columns: 2,
  lotSize: 12,
  roadWidth: 4,
  greenPercent: 25,
  buildingPercent: 25,
  seed: 38,
  wind: 0,
  radius: 12,
};
const decode = (r) => parseDocument(JSON.stringify(r));
function blank(input = config) {
  const draft = new EditorState(input);
  for (const o of [...draft.plan.objects])
    draft.execute("remove", { id: o.id });
  return draft;
}
function mixed() {
  const d = blank();
  d.execute("place", { type: "house", parcelId: "P01" });
  d.execute("properties", {
    id: d.at("P01").id,
    profile: "concrete",
    roof: "slab",
    rotation: 90,
  });
  d.execute("place", { type: "building", parcelId: "P02" });
  d.execute("properties", { id: d.at("P02").id, floors: 5, rotation: 90 });
  d.execute("place", { type: "green", parcelId: "P03" });
  return d;
}

test("draft edits preserve object IDs, reject occupied/outside parcels atomically and support undo/redo", () => {
  const d = blank();
  d.execute("place", { type: "house", parcelId: "P01" });
  const id = d.at("P01").id;
  d.execute("move", { id, parcelId: "P02" });
  assert.equal(d.at("P02").id, id);
  d.execute("duplicate", { id, parcelId: "P03" });
  assert.notEqual(d.at("P03").id, id);
  assert.equal(d.at("P03").profile, d.at("P02").profile);
  const before = structuredClone(d.plan),
    history = d.past.length;
  for (const args of [
    { id, parcelId: "P03" },
    { id, parcelId: "P99" },
  ])
    assert.throws(() => d.execute("move", args), /parcela|cuadrícula/);
  assert.deepEqual(d.plan, before);
  assert.equal(d.past.length, history);
  d.execute("rotate", { id });
  assert.equal(d.at("P02").rotation, 90);
  d.undo();
  assert.deepEqual(d.plan, before);
  d.redo();
  assert.equal(d.at("P02").rotation, 90);
  d.undo();
  d.execute("remove", { id });
  assert.equal(d.future.length, 0);
  assert.equal(d.at("P02"), undefined);
  d.undo();
  assert.equal(d.at("P02").id, id);
});

test("the editor draft never mutates the paused source experiment or input configuration", () => {
  const source = new Experiment(config),
    original = structuredClone(source.config);
  source.step();
  const active = source.active,
    record = source.document();
  const d = new EditorState(source.config),
    selected = d.plan.objects[0];
  d.execute("remove", { id: selected.id });
  assert.equal(source.active, active);
  assert.equal(source.steps, 1);
  assert.deepEqual(source.config, original);
  assert.deepEqual(source.document().results, record.results);
});

test("manual layout regenerates declared geometry, counts and per-object physical properties", () => {
  const d = mixed(),
    c = d.config,
    layout = generateNeighborhood(c),
    e = new Experiment(c);
  assert.equal(layout.version, "urban-editor-v2");
  assert.equal(layout.source, "manual");
  assert.deepEqual(layout.counts, {
    house: 1,
    building: 1,
    green: 1,
    vacant: 1,
  });
  assert.equal(e.houses[0].simulation.profile.id, "concrete");
  assert.equal(e.houses[0].simulation.roof.id, "slab");
  assert.equal(e.houses[0].yaw, Math.PI / 2);
  assert.equal(e.houses[0].objectId, d.at("P01").id);
  const core = e.environment.pieces.find((p) => p.kind === "core");
  assert.equal(core.size[1], 15);
  assert.equal(core.entityId, `E-${d.at("P02").id}`);
  assert.ok(e.environment.entities.every((entity) => entity.id.includes("O")));
  assert.deepEqual(generateNeighborhood(JSON.parse(JSON.stringify(c))), layout);
});

test("moving and rotating a park translates and turns its physical pieces without changing entity identities", () => {
  const d = blank();
  d.execute("place", { type: "green", parcelId: "P01" });
  const id = d.at("P01").id,
    first = environmentBlueprint(d.config, d.layout);
  d.execute("move", { id, parcelId: "P04" });
  d.execute("rotate", { id });
  const second = environmentBlueprint(d.config, d.layout),
    p = d.layout.parcels[3];
  assert.deepEqual(
    second.entities.map((e) => e.id),
    first.entities.map((e) => e.id),
  );
  assert.ok(
    second.pieces.every(
      (piece) => piece.parcelId === "P04" && piece.yaw === Math.PI / 2,
    ),
  );
  for (const piece of second.pieces) {
    assert.ok(
      Math.abs(piece.position[0] - p.world.x) + piece.size[0] / 2 < p.size / 2,
    );
    assert.ok(
      Math.abs(piece.position[2] - p.world.z) + piece.size[2] / 2 < p.size / 2,
    );
  }
});

test("empty and housing-free manual scenarios remain finite and can be recorded and imported", () => {
  const d = blank();
  for (const type of [null, "building", "green"]) {
    if (type)
      d.execute("place", {
        type,
        parcelId: type === "building" ? "P01" : "P02",
      });
    const e = new Experiment(d.config);
    for (let i = 0; i < 30; i++) e.step();
    const r = decode(e.document());
    assert.equal(r.results.houseTotal, 0);
    assert.equal(r.results.state, "Sin viviendas");
    assert.equal(r.results.maxDisplacement, 0);
    assert.deepEqual(recalculate(r), r.results);
  }
});

test("invalid manual plans, incompatible roofs and grid changes cannot replace an active experiment", () => {
  const d = mixed(),
    e = new Experiment(d.config),
    active = e.active;
  for (const mutate of [
    (p) => p.objects.push({ ...p.objects[0] }),
    (p) => {
      p.objects[0].rotation = 45;
    },
    (p) => {
      p.objects[0].profile = "timber";
      p.objects[0].roof = "slab";
    },
    (p) => {
      p.objects[1].floors = 8;
    },
    (p) => {
      p.grid.lotSize = 20;
    },
    (p) => {
      p.objects[0].parcelId = "P99";
    },
    (p) => {
      p.objects[0].position = [0, 0, 0];
    },
    (p) => {
      p.version = "future";
    },
  ]) {
    const p = structuredClone(d.plan);
    mutate(p);
    assert.throws(() => e.reset({ sitePlan: p }));
    assert.equal(e.active, active);
  }
  assert.throws(() => e.reset({ mode: "single" }), /barrio/);
  assert.throws(() => e.reset({ environment: "visual" }), /físico/);
});

test("edited damaged runs retain custom roofs, object identities, events, poses and exact recalculation", () => {
  const d = mixed(),
    e = new Experiment({ ...d.config, wind: 280, reinforcement: 50 });
  e.recorder.sampleEvery = 120;
  for (let i = 0; i < 1500; i++) e.step();
  const r = decode(e.document("Manzana manual"));
  assert.ok(r.events.length > 0);
  assert.equal(r.schemaVersion, 10);
  assert.equal(r.environmentModel.version, "urban-environment-workshop-1");
  assert.deepEqual(recalculate(r), r.results);
  const copy = new Experiment(r.initial, { record: false });
  applyFrame(copy, r, r.frames.length - 1);
  assert.deepEqual(
    copy.pieces.map((p) => p.body.position.toArray()),
    e.pieces.map((p) => p.body.position.toArray()),
  );
  assert.deepEqual(r.initial.sitePlan, d.plan);
  const tampered = structuredClone(r);
  tampered.layout.parcels[0].houseRoof = "metal";
  assert.throws(() => decode(tampered), /distribución/);
  assert.match(parcelsCSV(r), /manual|O\d{6}/);
  assert.match(htmlReport(r), /manual/i);
});

test("configurations and links preserve all 16 edited objects and do not depend on the original generation session", () => {
  const d = blank({ ...config, rows: 4, columns: 4 });
  for (let i = 1; i <= 16; i++)
    d.execute("place", {
      type: "house",
      parcelId: `P${String(i).padStart(2, "0")}`,
    });
  const r = decode(configurationDocument(d.config)),
    loaded = new Experiment(r.initial);
  assert.deepEqual(loaded.active.layout, d.layout);
  const url = new URL(shareLink("https://example.org/", d.config, "Editada"));
  assert.deepEqual(parseShareHash(url.hash).config.sitePlan, d.plan);
});

test("comparisons preserve the edited plan when changing reinforcement and reject ignored global controls", () => {
  const d = mixed(),
    results = [...compareScenarios(d.config, "reinforcement", 150, 5)];
  assert.deepEqual(results[0].config.sitePlan, results[1].config.sitePlan);
  assert.deepEqual(
    results[0].stats.rows.map((r) => r.objectId),
    results[1].stats.rows.map((r) => r.objectId),
  );
  assert.throws(
    () => [...compareScenarios(d.config, "roof", "tile", 5)],
    /plano manual/,
  );
});

test("schema-4 v2.5 recordings preserve their library, generated layout, historical poses and exact results", () => {
  const original = JSON.parse(
    fs.readFileSync(
      new URL("./fixtures/v2.5-library.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(original.schemaVersion, 4);
  const r = decode(original);
  assert.equal(r.schemaVersion, 10);
  assert.equal(r.initial.sitePlan, null);
  assert.equal(r.appVersion, "2.5.0");
  assert.equal(MODEL_ID, "simtorcl-33082313");
  assert.deepEqual(r.parameterLibrary, original.parameterLibrary);
  assert.deepEqual(r.layout, original.layout);
  assert.deepEqual(r.frames, original.frames);
  assert.deepEqual(recalculate(r), original.results);
});
