import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    target: "chrome120",
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      input: { popup: resolve(import.meta.dirname, "popup.html"), background: resolve(import.meta.dirname, "src/background.ts") },
      output: { entryFileNames: "[name].js" },
    },
  },
});
