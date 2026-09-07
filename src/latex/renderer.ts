import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";

import { normalizeSvg } from "./svg";

const FONT_EM_PX = 32;
const FONT_EX_PX = 16;

export interface RenderedLatex {
  latex: string;
  svg: string;
  width: number;
  height: number;
}

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const inputJax = new TeX({
  packages: ["base", "ams", "newcommand", "textmacros"],
  maxBuffer: 10 * 1024,
  formatError: (_jax: unknown, error: Error) => {
    throw error;
  },
});
const outputJax = new SVG({
  // Inline every glyph path. Referenced <use>/<defs> glyphs are valid SVG,
  // but some image import/rasterization paths resolve fragment IDs poorly.
  fontCache: "none",
});
const mathDocument = mathjax.document("", {
  InputJax: inputJax,
  OutputJax: outputJax,
});

export async function renderLatexToSvg(latex: string): Promise<RenderedLatex> {
  if (latex.trim().length === 0) {
    throw new Error("LaTeX source cannot be empty.");
  }

  inputJax.reset();
  const node = await mathjax.handleRetriesFor(() =>
    mathDocument.convert(latex, {
      display: true,
      em: FONT_EM_PX,
      ex: FONT_EX_PX,
      containerWidth: 1600,
    }),
  );

  return normalizeSvg(adaptor.outerHTML(node), latex);
}

export async function warmMathJax(): Promise<void> {
  await renderLatexToSvg("x");
}
