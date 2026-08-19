import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

interface ExtensionManifest {
  manifest_version: number;
  permissions?: string[];
  host_permissions?: string[];
  content_scripts?: Array<{
    matches: string[];
    js: string[];
  }>;
}

describe("extension manifest", () => {
  it("uses Manifest V3 with only the Excalidraw content-script scope", async () => {
    const manifestPath = resolve(import.meta.dirname, "../public/manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as ExtensionManifest;

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toBeUndefined();
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toEqual([
      {
        matches: ["https://excalidraw.com/*"],
        js: ["content.js"],
        run_at: "document_idle",
      },
    ]);
  });
});
