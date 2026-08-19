import { describe, expect, it } from "vitest";

import { createLatexMetadata } from "../src/latex/metadata";

describe("createLatexMetadata", () => {
  it("creates the stable v1 editing payload", () => {
    expect(createLatexMetadata("x^2")).toEqual({
      schema: "excalidraw-vector-latex",
      version: 1,
      latex: "x^2",
      displayMode: true,
      color: "#000000",
    });
  });
});
