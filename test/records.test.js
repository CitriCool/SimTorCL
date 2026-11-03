import test from "node:test";
import assert from "node:assert/strict";
import { Experiment } from "../src/district.js";
import { FIXED_STEP } from "../src/physics.js";
import {
  applyFrame,
  componentsCSV,
  configurationDocument,
  csv,
  eventsCSV,
  htmlReport,
  MODEL_ID,
  parseDocument,
  parseShareHash,
  resultsCSV,
  shareLink,
} from "../src/records.js";
import { compareScenarios, recalculate } from "../src/runs.js";

function advance(e, n) {
  for (let i = 0; i < n; i++) e.step();
}
function damaged(config = {}) {
  const e = new Experiment({ wind: 280, reinforcement: 50, ...config });
  advance(e, 360);
  return e;
}
function roundtrip(record) {
  return parseDocument(JSON.stringify(record));
}

test("execution retains its initial configuration, control history, events and exact reproducible results", () => {
  const e = damaged();
  e.setParameter("wind", 200);
  e.setParameter("radius", 12);
  advance(e, 240);
  e.setParameter("reinforcement", 150);
  e.realSeconds = 7;
  const r = roundtrip(e.document("Ensayo áéí"));
  assert.equal(r.initial.wind, 280);
  assert.equal(r.initial.reinforcement, 50);
  assert.equal(r.realSeconds, 7);
  assert.equal(r.steps, 600);
  assert.deepEqual(
    r.changes.map((c) => [c.step, c.key, c.value]),
    [
      [360, "wind", 200],
      [360, "radius", 12],
      [600, "reinforcement", 150],
    ],
  );
  assert.deepEqual(recalculate(r), r.results);
  assert.ok(r.events.length > 0);
  const ids = new Set();
  for (const event of r.events) {
    assert.ok(event.parents.every((id) => ids.has(id)));
    assert.ok(Math.abs(event.time - event.step * FIXED_STEP) < 1e-8);
    ids.add(event.id);
  }
  assert.equal(
    r.events.filter((e) => e.type === "connection").length,
    r.results.broken,
  );
  assert.equal(
    r.events.filter((e) => e.type === "release").length,
    e.pieces.filter((p) => p.detached).length,
  );
});

test("block recordings preserve house identities, final poses and aggregate results", () => {
  const e = damaged({ mode: "block9", spacing: 10, radius: 12 });
  advance(e, 720);
  const r = roundtrip(e.document("Manzana")),
    copy = new Experiment(r.initial, { record: false });
  assert.ok(r.events.length > 0);
  assert.equal(r.results.rows.length, 9);
  assert.deepEqual(recalculate(r), r.results);
  assert.deepEqual(applyFrame(copy, r, r.frames.length - 1), r.results);
  assert.deepEqual(
    copy.pieces.map((p) => p.body.position.toArray()),
    e.pieces.map((p) => p.body.position.toArray()),
  );
  assert.match(resultsCSV(r), /Conjunto/);
  assert.match(resultsCSV(r), /C09/);
  assert.equal(
    componentsCSV(r, copy).split("\r\n").length,
    copy.pieces.length + 1,
  );
});

test("recording is observational: enabling it does not change physics", () => {
  const a = new Experiment({ wind: 280, reinforcement: 50 }),
    b = new Experiment(a.config, { record: false });
  advance(a, 400);
  advance(b, 400);
  assert.deepEqual(a.stats, b.stats);
  assert.deepEqual(
    a.pieces.map((p) => p.body.position),
    b.pieces.map((p) => p.body.position),
  );
});

test("adaptive sampling bounds memory and retains both endpoints; reset clears history", () => {
  const e = new Experiment({ wind: 0 });
  e.recorder.frameLimit = 8;
  e.recorder.sampleEvery = 1;
  advance(e, 60);
  const r = roundtrip(e.document("Muestreo"));
  assert.ok(r.frames.length <= 8);
  assert.equal(r.frames[0].step, 0);
  assert.equal(r.frames.at(-1).step, 60);
  e.setParameter("wind", 200);
  e.reset();
  assert.equal(e.events.length, 0);
  assert.equal(e.recorder.changes.length, 0);
  assert.equal(e.recorder.frames.length, 1);
});

test("configuration-only format migrates v0 and never carries calculated results", () => {
  const r = roundtrip(
    configurationDocument({ mode: "block16", roof: "tile" }, "Configuración"),
  );
  assert.equal(r.kind, "configuration");
  assert.equal(r.results, undefined);
  const old = roundtrip({
    format: "simtorcl-experiment",
    schemaVersion: 0,
    kind: "configuration",
    name: "Anterior",
    config: { wind: 0 },
  });
  assert.equal(old.schemaVersion, 4);
  assert.equal(old.initial.wind, 0);
  assert.equal(old.modelId, MODEL_ID);
});

test("incompatible models and versions cannot silently alter the active experiment", () => {
  const e = damaged(),
    original = e.active,
    r = e.document();
  for (const mutate of [
    (r) => (r.modelId = "other"),
    (r) => (r.model.parameters.step = 0.1),
    (r) => (r.schemaVersion = 99),
    (r) => (r.initial.wind = -1),
    (r) => (r.initial.mode = "block100"),
  ]) {
    const bad = structuredClone(r);
    mutate(bad);
    assert.throws(() => roundtrip(bad));
    assert.equal(e.active, original);
  }
});

test("import rejects malformed trajectories, transforms, metrics and event references", () => {
  const r = damaged().document();
  for (const mutate of [
    (r) => r.frames[0].poses.pop(),
    (r) => (r.frames[0].poses[3] = 100),
    (r) => (r.frames[0].poses[7] = 2),
    (r) => (r.frames[0].stats.elapsed = -1),
    (r) => (r.events[0].parents = ["missing"]),
    (r) => (r.events[0].pieceId = 9999),
    (r) => (r.events[0].time = 999),
    (r) => (r.changes = [{ step: 0, key: "roof", value: "tile" }]),
    (r) => (r.steps = 864001),
  ]) {
    const bad = structuredClone(r);
    mutate(bad);
    assert.throws(() => roundtrip(bad));
  }
  assert.throws(() => parseDocument("{bad json"));
  assert.throws(() => parseDocument(" ".repeat(40 * 1024 * 1024 + 1)));
});

test("reports escape experiment text and CSV neutralizes spreadsheet formulas", () => {
  const r = damaged().document("<script>alert(1)</script>");
  const html = htmlReport(r, "data:image/png;base64,YQ==");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<img"));
  assert.ok(!htmlReport(r, "javascript:alert(1)").includes("<img"));
  assert.match(
    csv([["=1+1", "+cmd", "@evil", "-formula", -4, 'a;"b']]),
    /"'=1\+1"/,
  );
  assert.match(csv([[-4]]), /"-4"/);
  assert.ok(csv([[" =1+1", "\n=1+1"]]).includes("' =1+1"));
  assert.ok(csv([["\n=1+1"]]).includes("'\n=1+1"));
  assert.equal(eventsCSV(r).split("\r\n").length, r.events.length + 1);
});

test("configuration links roundtrip without any local session or calculated results", () => {
  const e = new Experiment({ mode: "block16", wind: 240 });
  const url = new URL(
    shareLink("https://example.org/sim/?old=1", e.config, "Casa & barrio"),
  );
  const shared = parseShareHash(url.hash);
  assert.deepEqual(shared.config, e.config);
  assert.equal(shared.name, "Casa & barrio");
  assert.equal(url.search, "");
  assert.equal(shared.results, undefined);
  assert.throws(() => parseShareHash("#simtorcl=%invalid"));
  assert.equal(parseShareHash("#other"), null);
});

test("comparisons keep common inputs and vary exactly one supported condition", () => {
  for (const [key, value] of [
    ["reinforcement", 150],
    ["distribution", "uniform"],
    ["spacing", 10],
    ["roof", "fiber"],
    ["trajectory", "horizontal"],
  ]) {
    const results = [
      ...compareScenarios({ mode: "block9", wind: 0 }, key, value, 5),
    ];
    assert.equal(results.length, 2);
    const [a, b] = results;
    assert.deepEqual(
      Object.keys(a.config).filter((k) => a.config[k] !== b.config[k]),
      [key],
    );
    assert.equal(a.stats.elapsed, b.stats.elapsed);
    assert.equal(a.stats.broken, 0);
    assert.equal(b.stats.broken, 0);
  }
  assert.throws(() => [...compareScenarios({}, "bad", 1, 5)]);
  assert.throws(() => [
    ...compareScenarios({ roof: "metal" }, "roof", "slab", 1),
  ]);
});
