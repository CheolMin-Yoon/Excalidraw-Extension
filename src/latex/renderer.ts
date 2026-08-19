import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";

import { createLatexMetadata } from "./metadata";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
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
  fontCache: "local",
  localID: "evl",
});
const mathDocument = mathjax.document("", {
  InputJax: inputJax,
  OutputJax: outputJax,
});

function numericLength(value: string | null, viewBoxLength: number): number {
  if (value) {
    const match = /^([0-9]+(?:\.[0-9]+)?)(ex|em|px)?$/.exec(value.trim());
    if (match) {
      const amount = Number(match[1]);
      const unit = match[2] ?? "px";
      const multiplier = unit === "ex" ? FONT_EX_PX : unit === "em" ? FONT_EM_PX : 1;
      return Math.max(1, amount * multiplier);
    }
  }

  return Math.max(1, (viewBoxLength / 1000) * FONT_EX_PX);
}

function roundDimension(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sanitizeSvg(svg: SVGSVGElement): void {
  svg.querySelectorAll("script, foreignObject, iframe, object, embed, image").forEach((node) => {
    node.remove();
  });

  for (const element of [svg, ...svg.querySelectorAll("*")]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (name === "xmlns" || name.startsWith("xmlns:")) {
        continue;
      }

      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if ((name === "href" || name === "xlink:href") && !value.startsWith("#")) {
        element.removeAttribute(attribute.name);
        continue;
      }

      const urlTargets = Array.from(value.matchAll(/url\s*\(\s*["']?([^)'"\s]+)/giu)).map(
        (match) => match[1] ?? "",
      );
      if (urlTargets.some((target) => !target.startsWith("#"))) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (["fill", "stroke", "color"].includes(name) && value === "currentColor") {
        element.setAttribute(attribute.name, "#000000");
      }
    }
  }
}

function normalizeSvg(markup: string, latex: string): RenderedLatex {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  const sourceSvg = parsed.querySelector("svg");

  if (!(sourceSvg instanceof SVGSVGElement)) {
    throw new Error("MathJax did not produce an SVG element.");
  }

  const viewBox = sourceSvg
    .getAttribute("viewBox")
    ?.trim()
    .split(/[ ,]+/u)
    .map(Number);

  if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) {
    throw new Error("MathJax SVG is missing a valid viewBox.");
  }

  const viewBoxWidth = viewBox[2];
  const viewBoxHeight = viewBox[3];
  if (viewBoxWidth === undefined || viewBoxHeight === undefined) {
    throw new Error("MathJax SVG has incomplete dimensions.");
  }

  const width = roundDimension(numericLength(sourceSvg.getAttribute("width"), viewBoxWidth));
  const height = roundDimension(numericLength(sourceSvg.getAttribute("height"), viewBoxHeight));
  const svg = sourceSvg.cloneNode(true) as SVGSVGElement;

  svg.setAttribute("xmlns", SVG_NAMESPACE);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "LaTeX formula");
  svg.setAttribute("focusable", "false");
  svg.style.color = "#000000";
  svg.style.background = "transparent";

  sanitizeSvg(svg);

  const metadata = parsed.createElementNS(SVG_NAMESPACE, "metadata");
  metadata.setAttribute("id", "excalidraw-vector-latex");
  metadata.textContent = JSON.stringify(createLatexMetadata(latex));
  svg.insertBefore(metadata, svg.firstChild);

  return {
    latex,
    svg: new XMLSerializer().serializeToString(svg),
    width,
    height,
  };
}

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
