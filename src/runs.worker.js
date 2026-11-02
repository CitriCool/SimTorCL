import { recalculate, compareScenarios } from "./runs.js";
self.onmessage = ({ data }) => {
  try {
    if (data.kind === "recalculate") {
      const stats = recalculate(data.record, (progress) =>
        self.postMessage({
          type: "progress",
          message: `Recalculando ${Math.round(progress * 100)} %`,
        }),
      );
      self.postMessage({ type: "recalculated", stats });
    } else {
      const results = [];
      for (const result of compareScenarios(
        data.config,
        data.key,
        data.value,
        data.seconds,
      )) {
        results.push(result);
        self.postMessage({
          type: "progress",
          message: `Escenario ${result.label} terminado`,
        });
      }
      self.postMessage({ type: "compared", results });
    }
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
