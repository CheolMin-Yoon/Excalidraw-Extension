import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../src/settings";
import { renderWithSelectedFont } from "../src/latex/selected-renderer";

afterEach(() => vi.unstubAllGlobals());
describe("renderer selection", () => {
  it("coalesces rapid changes before starting a local TeX process", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, svg: '<svg viewBox="0 0 10 10"><path d="M0 0L1 1"/></svg>' });
    vi.stubGlobal("chrome", {
      storage: { local: { get: vi.fn().mockResolvedValue({ renderSettings: { ...DEFAULT_SETTINGS, engine: "xelatex" } }) } },
      runtime: { sendMessage },
    });
    const results = await Promise.allSettled([renderWithSelectedFont("x"), renderWithSelectedFont("x+1")]);
    expect(results[0]?.status).toBe("rejected");
    expect(results[1]?.status).toBe("fulfilled");
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage.mock.calls[0]?.[0].latex).toBe("x+1");
  });
  it("keeps MathJax available without invoking a local application", async () => {
    const sendMessage = vi.fn();
    vi.stubGlobal("chrome", { storage: { local: { get: vi.fn().mockResolvedValue({}) } }, runtime: { sendMessage } });
    expect((await renderWithSelectedFont("x")).svg).toContain("<path");
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it("passes font choices to the local renderer and preserves them in the SVG", async () => {
    const settings = { ...DEFAULT_SETTINGS, engine: "xelatex", textFont: "Arial" };
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, svg: '<svg viewBox="0 0 20 10" width="20pt" height="10pt"><path d="M0 0L1 1"/></svg>' });
    vi.stubGlobal("chrome", { storage: { local: { get: vi.fn().mockResolvedValue({ renderSettings: settings }) } }, runtime: { sendMessage } });
    const result = await renderWithSelectedFont("x");
    expect(sendMessage).toHaveBeenCalledWith({ type: "render-native", latex: "x", settings });
    expect(result.svg).toContain("Arial");
  });
  it("surfaces native errors without silently replacing the selected font", async () => {
    vi.stubGlobal("chrome", {
      storage: { local: { get: vi.fn().mockResolvedValue({ renderSettings: { ...DEFAULT_SETTINGS, engine: "xelatex" } }) } },
      runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: false, error: "Missing font" }) },
    });
    await expect(renderWithSelectedFont("x")).rejects.toThrow("Missing font");
  });
});
