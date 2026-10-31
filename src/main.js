import "./style.css";
import { Simulation, FIXED_STEP, PRESETS } from "./physics.js";
import { SceneView } from "./scene.js";

const $ = (id) => document.getElementById(id);
const simulation = new Simulation();
let view;
let running = false;
let accumulator = 0;
let lastTime = null;
let frame;
let lastReadout = -1;
const dialog = $("about-dialog");

function updateReadout() {
  const { detached, total, stable, elapsed } = simulation.stats;
  const damage = Math.round((detached / total) * 100);
  $("roof-count").textContent = detached;
  $("damage-value").textContent = `${damage}%`;
  $("damage-bar").style.width = `${damage}%`;
  $("wall-count").textContent = stable;
  $("wall-description").textContent =
    stable === 4 ? "Estructura en equilibrio" : "Desplazamiento detectado";
  const seconds = Math.floor(elapsed);
  $("elapsed").textContent =
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function setRunning(value) {
  if (!view) return;
  running = value;
  lastTime = null;
  $("status").classList.toggle("running", running);
  $("status-text").textContent = running
    ? "Simulación en curso"
    : simulation.elapsed
      ? "Simulación pausada"
      : "Listo para iniciar";
  $("play-text").textContent = running
    ? "Pausar simulación"
    : simulation.elapsed
      ? "Reanudar simulación"
      : "Iniciar simulación";
  $("play-icon").textContent = running ? "Ⅱ" : "▶";
  $("play").setAttribute("aria-label", $("play-text").textContent);
  $("play").setAttribute("aria-pressed", String(running));
}

function reset() {
  setRunning(false);
  simulation.reset();
  accumulator = 0;
  lastReadout = -1;
  view.sync();
  updateReadout();
  setRunning(false);
}

function updateRange(id) {
  const input = $(id);
  simulation.config[id] = Number(input.value);
  $(`${id}-value`).value = input.value;
  input.style.setProperty(
    "--fill",
    `${((input.value - input.min) / (input.max - input.min)) * 100}%`,
  );
  if (id === "wind") {
    document.querySelectorAll("[data-preset]").forEach((button) => {
      const active = PRESETS[button.dataset.preset] === Number(input.value);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  view?.sync();
}

for (const id of ["wind", "radius", "fastening"]) {
  $(id).addEventListener("input", () => updateRange(id));
  updateRange(id);
}
document.querySelectorAll("[data-preset]").forEach((button) =>
  button.addEventListener("click", () => {
    $("wind").value = PRESETS[button.dataset.preset];
    updateRange("wind");
  }),
);
$("play").addEventListener("click", () => setRunning(!running));
$("reset").addEventListener("click", () => view && reset());
$("show-tornado").addEventListener("change", (event) => {
  if (view) view.vortex.visible = event.target.checked;
});
$("show-radius").addEventListener("change", (event) => {
  if (view) view.influence.visible = event.target.checked;
});
document.querySelectorAll("[data-view]").forEach((button) =>
  button.addEventListener("click", () => {
    view?.setView(button.dataset.view);
    document.querySelectorAll("[data-view]").forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
  }),
);
$("about-button").addEventListener("click", () => dialog.showModal());
$("close-about").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (
    event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom
  ) dialog.close();
});
window.addEventListener("keydown", (event) => {
  if (
    event.target.matches("input, button, a, textarea, select") ||
    dialog.open ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  )
    return;
  if (event.code === "Space") {
    event.preventDefault();
    setRunning(!running);
  }
  if (event.code === "KeyR" && view) reset();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) setRunning(false);
});

function animate(now) {
  frame = requestAnimationFrame(animate);
  const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (running) {
    accumulator += dt;
    while (accumulator >= FIXED_STEP) {
      simulation.step();
      accumulator -= FIXED_STEP;
    }
    view.sync();
  }
  if (now - lastReadout > 100) {
    updateReadout();
    lastReadout = now;
  }
  view.render();
}

try {
  view = new SceneView($("scene"), simulation);
  $("loading").hidden = true;
  frame = requestAnimationFrame(animate);
  updateReadout();
} catch (error) {
  $("loading").hidden = true;
  $("error").hidden = false;
  $("error").textContent =
    "No fue posible iniciar la escena 3D. Usa un navegador con WebGL 2 y aceleración gráfica activada. Puedes recargar para intentarlo de nuevo.";
  $("play").disabled = true;
  $("reset").disabled = true;
  console.error("No se pudo iniciar SimTorCL:", error);
}

$("scene").addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  setRunning(false);
  cancelAnimationFrame(frame);
  $("error").hidden = false;
  $("error").textContent =
    "Se perdió la conexión con la GPU. Recarga la página para reconstruir el escenario.";
  $("play").disabled = true;
  $("reset").disabled = true;
});

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(frame);
    view?.dispose();
  });
