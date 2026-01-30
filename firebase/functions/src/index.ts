import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";

initializeApp();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options
setGlobalOptions({
  region: "europe-west1",
  maxInstances: 10
});

export * from "./analytics/recalculateScores";
export * from "./users/checkUsername";
export * from "./users/lookupEmail";
export * from "./users/syncUserRecord";
export * from "./auth/session";