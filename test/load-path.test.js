import test from "node:test";
import assert from "node:assert/strict";
import { Vec3 } from "cannon-es";
import { connectionLoads, createLoadNetwork } from "../src/load-path.js";
import { Experiment } from "../src/district.js";
import { parseDocument, parseShareHash, shareLink } from "../src/records.js";

test("roof uplift reaches the anchors and redistributes through the wall link after failure", () => {
  const pieces = ["wall", "wall", "roof", "cladding"].map((kind, id) => ({
    id,
    kind,
    load: new Vec3(),
    demand: 0,
    details: {},
    connections: [],
  }));
  const connections = [];
  function link(kind, a, b = null) {
    const connection = { kind, a, b, broken: false };
    connections.push(connection);
    a.connections.push(connection);
    b?.connections.push(connection);
    return connection;
  }
  const [left, right, roof, cladding] = pieces;
  const leftAnchor = link("base", left);
  const rightAnchor = link("base", right);
  const wallLink = link("wall", left, right);
  const leftMount = link("roof", roof, left);
  const rightMount = link("roof", roof, right);
  const claddingMount = link("cladding", cladding, right);
  roof.demand = 1200;
  right.load.x = -240;
  cladding.load.z = 90;
  const route = () => connectionLoads(createLoadNetwork(pieces, connections));
  const near = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) < 1e-8);
  let loads = route();
  near(loads.get(leftMount).y, 600);
  near(loads.get(rightMount).y, 600);
  near(loads.get(leftAnchor).y, 600);
  near(loads.get(rightAnchor).y, 600);
  near(loads.get(wallLink).y, 0);
  near(loads.get(claddingMount).z, 90);

  rightAnchor.broken = true;
  loads = route();
  assert.ok(!loads.has(rightAnchor));
  near(loads.get(leftAnchor).y, 1200);
  near(loads.get(leftAnchor).x, -240);
  near(loads.get(leftAnchor).z, 90);
  near(loads.get(wallLink).y, -600);

  leftMount.broken = true;
  loads = route();
  assert.ok(!loads.has(leftMount));
  near(loads.get(rightMount).y, 1200);
  near(loads.get(wallLink).y, -1200);
  near(loads.get(leftAnchor).y, 1200);

  wallLink.broken = true;
  loads = route();
  assert.ok(!loads.has(rightMount));
  near(loads.get(leftAnchor).y, 0);
});

test("load transfer drives connection failures and survives saving and recalculation", () => {
  const config = {
    loadPath: "grounded-graph-v1",
    wind: 280,
    radius: 12,
    reinforcement: 50,
    enclosure: "front-opening",
  };
  function run(settings) {
    const experiment = new Experiment(settings);
    for (let i = 0; i < 300; i++) experiment.step();
    return experiment.document();
  }
  const saved = parseDocument(JSON.stringify(run(config)));
  assert.equal(saved.loadPathModel.version, "grounded-graph-v1");
  assert.ok(
    saved.events.some(
      (event) => event.cause === "overload" && event.kind === "base",
    ),
  );
  const repeat = run(saved.initial);
  assert.deepEqual(repeat.events, saved.events);
  assert.deepEqual(repeat.frames, saved.frames);
  const url = new URL(shareLink("https://example.com", saved.initial));
  assert.equal(parseShareHash(url.hash).config.loadPath, config.loadPath);

  const legacy = run({ ...config, loadPath: "off" });
  legacy.schemaVersion = 9;
  delete legacy.initial.loadPath;
  delete legacy.loadPathModel;
  const restored = parseDocument(JSON.stringify(legacy));
  assert.equal(restored.initial.loadPath, "off");
  assert.deepEqual(run(restored.initial).frames, legacy.frames);
});
