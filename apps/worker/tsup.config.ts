import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  // Bundle the workspace package (TypeScript sources); keep npm deps external.
  noExternal: ["@clipkarya/core"],
  sourcemap: true,
  clean: true,
});
