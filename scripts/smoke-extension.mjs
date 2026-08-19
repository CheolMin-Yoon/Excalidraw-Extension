import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";

const root = resolve(import.meta.dirname, "..");
const extensionPath = resolve(root, "dist");
const chromePath = process.env.CHROME_PATH || chromium.executablePath();
const profilePath = await mkdtemp(join(tmpdir(), "evl-chrome-"));

await access(resolve(extensionPath, "manifest.json"));
await access(chromePath);

let context;
try {
  context = await chromium.launchPersistentContext(profilePath, {
    executablePath: chromePath,
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
    ],
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://excalidraw.com", {
    waitUntil: "commit",
    timeout: 30_000,
  });
  await page.waitForSelector(".excalidraw", { timeout: 20_000 });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const rootElement = document.querySelector(".excalidraw");
    if (!(rootElement instanceof HTMLElement)) {
      throw new Error("Missing Excalidraw root");
    }

    const state = { seen: false, fileName: "", fileType: "", svg: "" };
    window.__evlSmoke = state;
    rootElement.addEventListener(
      "paste",
      (event) => {
        const clipboardEvent = event;
        const file = clipboardEvent.clipboardData?.files[0];
        if (!file) {
          return;
        }
        state.seen = true;
        state.fileName = file.name;
        state.fileType = file.type;
        void file.text().then((svg) => {
          state.svg = svg;
        });
      },
      true,
    );

    const container = document.createElement("div");
    container.className = "excalidraw-textEditorContainer";
    const editor = document.createElement("textarea");
    container.appendChild(editor);
    rootElement.appendChild(container);
    editor.focus();
    editor.value = String.raw`$$\frac{a}{b}$$`;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    window.setTimeout(() => editor.blur(), 500);
  });

  await page.waitForFunction(() => window.__evlSmoke?.svg.length > 0, null, {
    timeout: 15_000,
  });
  const result = await page.evaluate(() => window.__evlSmoke);

  if (!result?.seen || result.fileName !== "latex.svg" || result.fileType !== "image/svg+xml") {
    throw new Error(`Unexpected paste payload: ${JSON.stringify(result)}`);
  }
  if (
    !result.svg.includes('id="excalidraw-vector-latex"') ||
    /background:\s*(?:white|#fff)/iu.test(result.svg) ||
    /data:image\/png/iu.test(result.svg)
  ) {
    throw new Error("The pasted SVG failed metadata, transparency, or vector checks.");
  }

  process.stdout.write(
    `${JSON.stringify({
      url: page.url(),
      fileName: result.fileName,
      fileType: result.fileType,
      metadata: true,
      transparent: true,
      vector: true,
    })}\n`,
  );
} finally {
  await context?.close();
  await rm(profilePath, { recursive: true, force: true });
}
