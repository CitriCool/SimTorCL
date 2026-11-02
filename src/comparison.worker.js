import { compareProfiles } from "./comparison.js";
self.onmessage = ({ data }) => {
  try {
    const results = [];
    for (const result of compareProfiles(data.config, data.seconds)) {
      results.push(result);
      self.postMessage({
        type: "progress",
        completed: results.length,
        profile: result.profile,
      });
    }
    self.postMessage({ type: "complete", results });
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
