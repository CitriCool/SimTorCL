import { Group } from "three";
import { HOUSE, roofHeightAt } from "./catalog.js";
import { Experiment } from "./district.js";
import { SceneView } from "./scene.js";

// Dimensions in metres from the MINVU assembly F.2.1.15.55.
const sheetThickness = 0.00035;
const trussSection = [0.074, 0.038];
const trussSpacing = 0.90;
const purlinSection = 0.045;
const purlinSpacing = 0.94;

function buildRoof(view) {
  const structure = new Group();
  const covering = new Group();
  const fixings = new Group();
  view.houseRoot.add(structure, covering, fixings);
  const pine = view.material("#bf8b58");
  const purlin = view.material("#e2b585");
  const zinc = view.material("#acbfc3", { metalness: 0.48 });
  const nail = view.material("#e7a34b");
  const halfWidth = HOUSE.width / 2;
  const eave = halfWidth + HOUSE.eave;
  const depth = HOUSE.depth + HOUSE.eave * 2;
  const rafterHeight = (x) => roofHeightAt(x) - 0.065;
  const trussCount = Math.floor(HOUSE.depth / trussSpacing) + 1;

  function member(x1, y1, x2, y2, z) {
    const beam = view.box(
      [Math.hypot(x2 - x1, y2 - y1), ...trussSection],
      [(x1 + x2) / 2, (y1 + y2) / 2, z],
      pine,
      structure,
    );
    beam.rotation.z = Math.atan2(y2 - y1, x2 - x1);
  }

  for (let i = 0; i < trussCount; i++) {
    const z = (i - (trussCount - 1) / 2) * trussSpacing;
    const base = HOUSE.height - 0.015;
    member(-halfWidth, base, halfWidth, base, z);
    member(-eave, rafterHeight(eave), 0, rafterHeight(0), z);
    member(0, rafterHeight(0), eave, rafterHeight(eave), z);
    member(0, base, 0, rafterHeight(0), z);
    for (const x of [-halfWidth / 2, halfWidth / 2])
      member(0, base, x, rafterHeight(x), z);
  }

  for (const side of [-1, 1]) {
    const angle = -side * HOUSE.pitch;
    for (
      let offset = purlinSpacing / 2;
      offset * Math.cos(HOUSE.pitch) < eave;
      offset += purlinSpacing
    ) {
      const x = side * offset * Math.cos(HOUSE.pitch);
      const beam = view.box(
        [purlinSection, purlinSection, depth],
        [x, roofHeightAt(x) - 0.008, 0],
        purlin,
        structure,
      );
      beam.rotation.z = angle;
      // Markers illustrate the connection between layers, not a fastening schedule.
      for (const z of [-2.7, -0.9, 0.9, 2.7])
        view.box([0.036, 0.09, 0.036], [x, roofHeightAt(x) + 0.08, z], nail, fixings);
    }
    const slope = eave / Math.cos(HOUSE.pitch);
    const panels = 8;
    for (let i = 0; i < panels; i++) {
      const z = (i - (panels - 1) / 2) * depth / panels;
      const x = side * eave / 2;
      const y = roofHeightAt(x) + 0.03;
      const panel = view.box([slope, sheetThickness, depth / panels - 0.012], [x, y, z], zinc, covering);
      panel.rotation.z = angle;
      for (let rib = -2; rib <= 2; rib++) {
        const ridge = view.box([slope, 0.018, 0.025], [x, y + 0.008, z + rib * 0.15], zinc, covering);
        ridge.rotation.z = angle;
      }
    }
  }
  for (const [piece, mesh] of view.meshes)
    if (piece.kind === "roof") mesh.visible = false;
  return { covering, fixings };
}

export function setupRoofReference() {
  const dialog = document.getElementById("roof-reference");
  const canvas = document.getElementById("roof-reference-canvas");
  const mode = document.getElementById("roof-reference-mode");
  const status = document.getElementById("roof-reference-status");
  let view, layers, frame;
  function updateMode() {
    if (!layers) return;
    layers.covering.visible = mode.value !== "frame";
    const exploded = mode.value === "exploded";
    layers.covering.position.set(0, exploded ? 1.35 : 0, exploded ? -2.3 : 0);
    layers.fixings.visible = mode.value !== "assembled";
  }
  mode.addEventListener("change", updateMode);
  dialog.addEventListener("close", () => {
    cancelAnimationFrame(frame);
    view?.dispose();
    view = layers = null;
  });
  return function open() {
    dialog.showModal();
    try {
      view = new SceneView(canvas, new Experiment({
        profile: "timber", roof: "metal", wind: 0,
      }, { record: false }));
      view.vortex.visible = view.influence.visible = view.rain.visible = false;
      view.camera.position.set(11, 10, 13);
      view.controls.target.set(0, 2.8, 0);
      view.controls.update();
      layers = buildRoof(view);
      mode.value = "exploded";
      mode.disabled = false;
      status.textContent = "";
      updateMode();
      const render = () => {
        if (!dialog.open) return;
        view.render();
        frame = requestAnimationFrame(render);
      };
      render();
    } catch (error) {
      mode.disabled = true;
      status.textContent = "No se pudo abrir la vista 3D. Las medidas de referencia están abajo.";
      console.error(error);
    }
  };
}
