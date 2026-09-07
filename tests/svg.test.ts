import { describe, expect, it } from "vitest";
import { normalizeSvg } from "../src/latex/svg";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("native SVG normalization", () => {
  it("inlines dvisvgm paths with glyph positions and converts point dimensions", () => {
    const result = normalizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="72pt" height="36pt" viewBox="0 0 72 36"><defs><path id="g0" d="M0 0L1 1"/></defs><use xlink:href="#g0" x="12" y="15"/></svg>',
      "x", { ...DEFAULT_SETTINGS, engine: "xelatex" },
    );
    expect(result.width).toBe(104);
    expect(result.height).toBe(56);
    expect(result.svg).not.toContain("<use");
    expect(result.svg).toContain("translate(12 15)");
    const doc = new DOMParser().parseFromString(result.svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelector("g path")).not.toBeNull();
    expect(JSON.parse(doc.querySelector("metadata")!.textContent!)).toMatchObject({
      version: 2, latex: "x", rendering: { engine: "xelatex", mathFont: "Cambria Math" },
    });
  });
  it("rejects missing or external glyph references and invalid dimensions", () => {
    expect(() => normalizeSvg('<svg viewBox="0 0 1 1"><use href="https://example.com/a"/></svg>', "x")).toThrow();
    expect(() => normalizeSvg('<svg viewBox="0 0 0 1"/>', "x")).toThrow();
  });
  it("expands scaled forward references and rejects cycles", () => {
    const svg = normalizeSvg('<svg viewBox="0 0 20 20"><defs><use id="scaled" href="#base" transform="scale(2)"/><path id="base" d="M0 0L1 1"/></defs><use href="#scaled" x="3" y="4"/></svg>', "x").svg;
    expect(svg).not.toContain("<use");
    expect(svg).toContain("scale(2)");
    expect(svg).toContain("translate(3 4)");
    expect(() => normalizeSvg('<svg viewBox="0 0 1 1"><defs><use id="a" href="#a"/></defs><use href="#a"/></svg>', "x")).toThrow("Cyclic");
  });
});
