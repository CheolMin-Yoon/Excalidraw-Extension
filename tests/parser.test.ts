import { describe, expect, it } from "vitest";

import { parseLatexBlock } from "../src/latex/parser";

describe("parseLatexBlock", () => {
  it("parses a complete display block", () => {
    expect(parseLatexBlock("  $$ \\frac{a}{b} $$  ")).toEqual({ latex: "\\frac{a}{b}" });
  });

  it("parses multiline LaTeX", () => {
    expect(parseLatexBlock("$$\\begin{bmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{bmatrix}$$")).toEqual({
      latex: "\\begin{bmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{bmatrix}",
    });
  });

  it("keeps escaped dollar signs inside the formula", () => {
    expect(parseLatexBlock("$$x + \\$ + \\$ = y$$")).toEqual({ latex: "x + \\$ + \\$ = y" });
  });

  it.each([
    "",
    "$$$$",
    "$$   $$",
    "$$x",
    "x$$",
    "before $$x$$",
    "$$x$$ after",
    "$$x$$ and $$y$$",
    "$x$",
  ])("rejects non-convertible input: %s", (value) => {
    expect(parseLatexBlock(value)).toBeNull();
  });
});
