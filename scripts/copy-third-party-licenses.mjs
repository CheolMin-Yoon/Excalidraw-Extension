import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(root, "dist/licenses");

await mkdir(outputDirectory, { recursive: true });
await copyFile(
  resolve(root, "node_modules/@mathjax/src/LICENSE"),
  resolve(outputDirectory, "MathJax-LICENSE.txt"),
);
