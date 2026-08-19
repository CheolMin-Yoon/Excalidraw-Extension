import { describe, expect, it } from "vitest";

import { renderLatexToSvg } from "../src/latex/renderer";

function parseSvg(svg: string): SVGSVGElement {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsed.documentElement;
  if (!(root instanceof SVGSVGElement)) {
    throw new Error("Expected an SVG root");
  }
  return root;
}

describe("renderLatexToSvg", () => {
  it.each([
    String.raw`\frac{a}{b}`,
    String.raw`\begin{bmatrix}1 & 2 \\ 3 & 4\end{bmatrix}`,
    String.raw`\alpha + \beta = \gamma`,
    String.raw`\sum_{i=1}^{n} i`,
  ])("renders standard LaTeX as self-contained SVG: %s", async (latex) => {
    const rendered = await renderLatexToSvg(latex);
    const svg = parseSvg(rendered.svg);
    const metadata = svg.querySelector("metadata#excalidraw-vector-latex");

    expect(svg.getAttribute("viewBox")).toBeTruthy();
    expect(Number(svg.getAttribute("width"))).toBeGreaterThan(0);
    expect(Number(svg.getAttribute("height"))).toBeGreaterThan(0);
    expect(rendered.width).toBeGreaterThan(0);
    expect(rendered.height).toBeGreaterThan(0);
    expect(svg.querySelector("defs path, path")).not.toBeNull();
    expect(metadata).not.toBeNull();
    expect(JSON.parse(metadata?.textContent ?? "{}")).toMatchObject({
      schema: "excalidraw-vector-latex",
      version: 1,
      latex,
    });
    expect(rendered.svg).not.toMatch(/<canvas|data:image|background:\s*(?:#fff|white)/iu);
    expect(rendered.svg).not.toMatch(/(?:href|src)=["'](?:https?:|\/\/|data:)/iu);
    expect(rendered.svg).not.toContain("currentColor");
  });

  it("rejects invalid TeX instead of producing an error image", async () => {
    await expect(renderLatexToSvg(String.raw`\definitelyUnknownCommand{x}`)).rejects.toThrow();
  });
});
