import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Experiment } from "../src/district.js";
import { ENV_MODEL } from "../src/environment.js";
import {
  MODEL,
  MODEL_ID,
  configurationDocument,
  parseDocument,
  parseShareHash,
  shareLink,
  htmlReport,
} from "../src/records.js";
import {
  parameterLibrary,
  libraryCSV,
  referenceCheck,
} from "../src/parameters.js";
import { windAt } from "../src/physics.js";
import { recalculate } from "../src/runs.js";
const decode = (record) => parseDocument(JSON.stringify(record));

test("library covers every declared numeric parameter with explicit dimensions and evidence", () => {
  const library = parameterLibrary(MODEL, ENV_MODEL);
  function numericCount(value) {
    return Object.values(value).reduce(
      (n, v) =>
        n +
        (typeof v === "number"
          ? 1
          : v && typeof v === "object" && !Array.isArray(v)
            ? numericCount(v)
            : 0),
      0,
    );
  }
  assert.equal(
    library.entries.length,
    numericCount(MODEL.parameters) + Object.keys(ENV_MODEL.parameters).length,
  );
  assert.equal(
    new Set(library.entries.map((p) => p.id)).size,
    library.entries.length,
  );
  for (const p of library.entries) {
    assert.ok(p.label && p.unit && p.applicability && p.status);
    assert.ok(Number.isFinite(p.value));
    assert.equal(p.calibratedRange, null);
    assert.deepEqual(p.sourceIds, []);
  }
  assert.equal(
    library.entries.find((p) => p.id === "model.house.pitch").unit,
    "rad",
  );
  assert.equal(
    library.entries.find((p) => p.id === "model.rules.stableTilt").unit,
    "°",
  );
  assert.equal(
    library.entries.find((p) => p.id === "environment.treeAnchor").unit,
    "N·m",
  );
  assert.ok(
    library.entries
      .find((p) => p.id === "environment.treeHeight")
      .note.includes("no controla"),
  );
  const future = structuredClone(MODEL);
  future.parameters.house.unknown = 1;
  assert.throws(() => parameterLibrary(future), /Falta describir/);
});

test("equation references cannot be mistaken for sourced resistances and snapshots are isolated", () => {
  const library = parameterLibrary(MODEL);
  assert.equal(library.environmentVersion, null);
  assert.ok(
    library.equations.every((eq) =>
      eq.sourceIds.every((id) => library.sources.some((s) => s.id === id)),
    ),
  );
  assert.ok(
    library.sources
      .find((s) => s.id === "nasa-drag")
      .supports.includes("no aporta"),
  );
  library.sources.find((s) => s.id === "nasa-drag").title = "Modified";
  library.entries[0].value = 999;
  const fresh = parameterLibrary(MODEL);
  assert.equal(
    fresh.sources.find((s) => s.id === "nasa-drag").title,
    "Drag Equation",
  );
  assert.equal(fresh.entries[0].value, MODEL.parameters.house.width);
});

test("analytical reference checks production loads, boundaries, units and quadratic scaling, detecting a faulty field", () => {
  const result = referenceCheck();
  assert.ok(result.passed);
  assert.equal(result.rows.length, 10);
  assert.ok(Math.abs(result.rows[0].actual - 61.25) < 1e-12);
  assert.ok(Math.abs(result.rows[1].actual - 85.75) < 1e-12);
  assert.ok(result.rows.every((r) => r.absoluteError <= r.tolerance));
  assert.match(result.scope, /No valida/);
  const wrong = referenceCheck((...args) => {
    const v = windAt(...args);
    v.x *= 3.6;
    return v;
  });
  assert.equal(wrong.passed, false);
  assert.equal(
    wrong.rows.find((r) => r.label === "Campo sintético: fuerza X").passed,
    false,
  );
});

test("new configurations and runs retain the library; altered values, units or source attribution are rejected", () => {
  const e = new Experiment({
    mode: "neighborhood",
    rows: 2,
    columns: 2,
    wind: 0,
  });
  const config = decode(configurationDocument(e.config));
  assert.equal(config.schemaVersion, 10);
  assert.deepEqual(config.parameterLibrary, parameterLibrary(MODEL, ENV_MODEL));
  e.step();
  const run = decode(e.document());
  assert.deepEqual(run.parameterLibrary, config.parameterLibrary);
  assert.match(htmlReport(run), /Biblioteca de parámetros parameters-1/);
  for (const mutate of [
    (r) => {
      r.parameterLibrary.entries[0].value = 999;
    },
    (r) => {
      r.parameterLibrary.entries[0].unit = "N";
    },
    (r) => {
      r.parameterLibrary.entries[0].sourceIds = ["nasa-drag"];
    },
    (r) => {
      delete r.parameterLibrary;
    },
  ]) {
    const altered = structuredClone(run);
    mutate(altered);
    assert.throws(() => decode(altered), /biblioteca/);
  }
  const csv = libraryCSV(run.parameterLibrary);
  assert.equal(
    csv.split("\r\n").length,
    run.parameterLibrary.entries.length + 1,
  );
  assert.match(csv, /"environment.treeAnchor"/);
});

test("v2.4 damaged urban run retains its mechanics, events and poses without retroactively adding evidence", () => {
  const original = JSON.parse(
    fs.readFileSync(
      new URL("./fixtures/v2.4-environment.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(original.schemaVersion, 3);
  assert.ok(original.events.some((e) => e.house === "ENV"));
  const migrated = decode(original);
  assert.equal(migrated.schemaVersion, 10);
  assert.equal(migrated.parameterLibrary, null);
  assert.equal(migrated.appVersion, "2.4.0");
  assert.equal(MODEL_ID, "simtorcl-33082313");
  assert.deepEqual(migrated.events, original.events);
  assert.deepEqual(migrated.frames, original.frames);
  assert.deepEqual(recalculate(migrated), original.results);
  assert.match(htmlReport(migrated), /archivo histórico no contiene/);
  assert.match(htmlReport(migrated), /SimTorCL 2.4.0/);
});

test("legacy configurations and schema-3 links preserve physical environments with no invented provenance", () => {
  const config = configurationDocument({ mode: "neighborhood" });
  config.schemaVersion = 3;
  config.appVersion = "2.4.0";
  delete config.parameterLibrary;
  const migrated = decode(config);
  assert.equal(migrated.parameterLibrary, null);
  assert.equal(migrated.appVersion, "2.4.0");
  assert.equal(migrated.initial.environment, "physical");
  assert.equal(decode(migrated).parameterLibrary, null);
  const url = new URL(shareLink("https://example.org/", config.initial));
  const data = JSON.parse(decodeURIComponent(url.hash.slice(10)));
  data.schemaVersion = 3;
  const shared = parseShareHash(
    "#simtorcl=" + encodeURIComponent(JSON.stringify(data)),
  );
  assert.equal(shared.config.environment, "physical");
});
