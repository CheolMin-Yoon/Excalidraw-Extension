import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "assets/icon.svg");
const outputDirectory = resolve(root, "public/icons");
const sizes = [16, 32, 48, 128];

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  sizes.map((size) =>
    sharp(source)
      .resize(size, size)
      .png()
      .toFile(resolve(outputDirectory, `icon-${size}.png`)),
  ),
);
