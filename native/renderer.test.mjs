import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDocument, validateLatex, renderNative } from "./renderer.mjs";

const settings = {
  textFont: "Times New Roman", mathFont: "Cambria Math",
  italicFont: "Times New Roman Italic",
  boldFont: "Times New Roman Bold", boldItalicFont: "Times New Roman Bold Italic",
};
test("accepts common equations and matrix environments", () => {
  for (const latex of ["\\frac{x^2}{2}+\\alpha", "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}", "\\text{rate}\\leq 5\\%"]) {
    assert.equal(validateLatex(latex), latex);
  }
});
test("blocks TeX file access, command execution, macro creation and token decoding", () => {
  for (const latex of [
    "\\input{secret}", "\\write18{calc}", "\\csname input\\endcsname{x}",
    "^^5cinput{x}", "\\def\\x{a}", "\\begin{document}x\\end{document}",
    "\\end{document}", "\\catcode1=2", "\\special{ps: run}", "\\newcommand{\\x}{x}",
    "\\text{\\openin1=secret}", "x$\\input{x}$", "x\u0000", "x%comment", "\\loop x\\repeat",
  ]) assert.throws(() => validateLatex(latex));
});
test("font names cannot inject TeX or load arbitrary paths", () => {
  for (const name of ["x}\\input{x}", "../secret", "C:\\Fonts\\a.ttf", "\\bad", ""]) {
    assert.throws(() => buildDocument("x", { ...settings, textFont: name }));
  }
  assert.throws(() => buildDocument("x", { ...settings, mathFont: "Symbol" }));
});
test("applies regular, italic and bold font ranges while preserving math symbols", () => {
  const source = buildDocument("x+1", settings);
  assert.ok(source.includes("\\setmathfont{Cambria Math}"));
  assert.ok(source.includes("\\setmathfont[range=it/{latin,Latin}]{Times New Roman Italic}"));
  assert.ok(source.includes("\\setmathfont[range=bfup/{latin,Latin,num}]{Times New Roman Bold}"));
  assert.ok(!source.includes("range=up/{greek"));
});
test("native renderer produces distinct outlines for installed fonts", {
  skip: process.env.EVL_NATIVE_TEST !== "1",
}, async () => {
  const shapes = [];
  for (const name of ["Times New Roman", "Arial", "Cambria"]) {
    const svg = await renderNative("\\frac{x^2+1}{2}+\\sum_{i=1}^n\\alpha_i+\\text{Sample}", {
      textFont: name, mathFont: "Cambria Math",
      italicFont: name + " Italic", boldFont: name + " Bold", boldItalicFont: name + " Bold Italic",
    });
    assert.match(svg, /<path/u);
    assert.doesNotMatch(svg, /<(?:text|image)\b/u);
    shapes.push(svg.match(/<path[^>]* d=['"]([^'"]+)/u)?.[1]);
  }
  assert.equal(new Set(shapes).size, 3);
  await assert.rejects(() => renderNative("x", { ...settings, textFont: "Excalidraw Missing Font 12345" }));
});
