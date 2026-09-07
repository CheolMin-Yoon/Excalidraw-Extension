import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium } from "playwright-core";
import sharp from "sharp";

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
    viewport: { width: 1200, height: 800 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
    ],
  });

  if (process.env.EVL_NATIVE_FONT) {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    await worker.evaluate(async (font) => {
      await globalThis.chrome.storage.local.set({ renderSettings: {
        engine: "xelatex", textFont: font, mathFont: "Cambria Math",
        italicFont: font + " Italic", boldFont: font + " Bold", boldItalicFont: font + " Bold Italic",
      } });
    }, process.env.EVL_NATIVE_FONT);
  }
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://excalidraw.com", {
    waitUntil: "commit",
    timeout: 30_000,
  });
  await page.waitForSelector(".excalidraw", { timeout: 20_000 });
  await page.waitForTimeout(1000);

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

  });

  await page.getByTestId("main-menu-trigger").click();
  await page.getByTestId("color-top-pick-#f5faff").click();
  await page.getByTestId("toolbar-text").click();
  await page.mouse.click(600, 350);
  await page.keyboard.type(String.raw`$$\frac{a}{b}$$`);
  await page.waitForTimeout(1500);
  await page.mouse.click(850, 550);

  await page.waitForFunction(() => window.__evlSmoke?.svg.length > 0, null, {
    timeout: 15_000,
  });
  await page.waitForFunction(
    () => {
      const elements = JSON.parse(localStorage.getItem("excalidraw") ?? "[]");
      return elements.some((element) => element.type === "image" && !element.isDeleted);
    },
    null,
    { timeout: 15_000 },
  );
  const result = await page.evaluate(() => window.__evlSmoke);
  const imageElement = await page.evaluate(() => {
    const elements = JSON.parse(localStorage.getItem("excalidraw") ?? "[]");
    return elements.find((element) => element.type === "image" && !element.isDeleted);
  });

  if (!result?.seen || result.fileName !== "latex.svg" || result.fileType !== "image/svg+xml") {
    throw new Error(`Unexpected paste payload: ${JSON.stringify(result)}`);
  }
  if (
    !result.svg.includes('id="excalidraw-vector-latex"') ||
    /(?:background|vertical-align)\s*:/iu.test(result.svg) ||
    /data:image\/png/iu.test(result.svg) ||
    /<use\b/iu.test(result.svg)
  ) {
    throw new Error("The pasted SVG failed metadata, transparency, or vector checks.");
  }

  await page.mouse.click(300, 600);
  await page.waitForTimeout(250);
  const screenshot = await page.screenshot();
  const { data: pixels, info } = await sharp(screenshot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const background = [245, 250, 255];
  const pixelAt = (x, y) => {
    const offset = (Math.round(y) * info.width + Math.round(x)) * info.channels;
    return [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
  };
  const corners = [
    [imageElement.x + 2, imageElement.y + 2],
    [imageElement.x + imageElement.width - 3, imageElement.y + 2],
    [imageElement.x + 2, imageElement.y + imageElement.height - 3],
    [imageElement.x + imageElement.width - 3, imageElement.y + imageElement.height - 3],
  ];
  if (
    corners.some(([x, y]) =>
      pixelAt(x, y).some((channel, index) => Math.abs(channel - background[index]) > 2),
    )
  ) {
    throw new Error("The inserted formula image does not preserve the canvas background.");
  }

  process.stdout.write(
    `${JSON.stringify({
      url: page.url(),
      fileName: result.fileName,
      fileType: result.fileType,
      metadata: true,
      transparent: true,
      vector: true,
      inlinePaths: true,
      insertedWidth: imageElement.width,
      insertedHeight: imageElement.height,
    })}\n`,
  );
} finally {
  await context?.close();
  await rm(profilePath, { recursive: true, force: true });
}
