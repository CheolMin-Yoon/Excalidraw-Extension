import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const extension = resolve(import.meta.dirname, "../dist");
const profile = await mkdtemp(join(tmpdir(), "evl-font-ui-"));
const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.CHROME_PATH || chromium.executablePath(),
  headless: true, viewport: { width: 410, height: 920 },
  ignoreDefaultArgs: ["--disable-extensions"],
  args: ["--disable-extensions-except=" + extension, "--load-extension=" + extension],
});
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const id = new URL(worker.url()).hostname;
  const page = await context.newPage();
  await page.goto("chrome-extension://" + id + "/popup.html");
  await page.locator("#textFont").waitFor({ state: "attached" });
  await page.waitForFunction(() => document.querySelector("#textFont").value === "Cambria");
  for (const font of ["Cambria", "Arial", "Times New Roman"]) {
    await page.locator("#preset").selectOption(font);
    await page.locator("#preview-button").click();
    await page.waitForFunction(() => !document.querySelector("#preview-button").disabled, null, { timeout: 30000 });
    const status = await page.locator("#status").textContent();
    if (!status.includes("미리보기 완료")) throw new Error(font + ": " + status);
    await page.waitForFunction(() => document.querySelector("#preview").naturalWidth > 0);
    console.log(font + ": native font preview OK");
  }
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#status").textContent.includes("저장했습니다"));
  if (process.env.EVL_SCREENSHOT) await page.screenshot({ path: process.env.EVL_SCREENSHOT, fullPage: true });
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#textFont").value === "Times New Roman");
  await page.locator("#textFont").fill("Excalidraw Missing Font 12345");
  await page.locator("#preview-button").click();
  await page.waitForFunction(() => !document.querySelector("#preview-button").disabled, null, { timeout: 30000 });
  if (await page.locator("#preview").isVisible()) throw new Error("Missing font unexpectedly produced a preview");
  console.log("Settings persistence and missing-font error OK");
} finally {
  await context.close();
  // mkdtemp returned an immediate child of tmpdir with this fixed prefix.
  if (profile.startsWith(join(tmpdir(), "evl-font-ui-"))) await rm(profile, { recursive: true, force: true });
}
