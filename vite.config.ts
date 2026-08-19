import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  publicDir: "public",
  build: {
    target: "chrome120",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: "oxc",
    lib: {
      entry: resolve(import.meta.dirname, "src/content.ts"),
      name: "ExcalidrawVectorLatex",
      formats: ["iife"],
      fileName: () => "content.js",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
