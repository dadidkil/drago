import { defineConfig } from "tsup";

// Workspace-пакеты (@drago/*) встраиваются в бандл; npm-зависимости остаются внешними.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  sourcemap: true,
  clean: true,
  noExternal: [/^@drago\//],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
