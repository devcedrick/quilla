import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    SEED_BOOTSTRAP_ENABLED: v.optional(v.string()),
  },
});

export default app;
