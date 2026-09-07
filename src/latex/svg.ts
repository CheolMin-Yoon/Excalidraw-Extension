import { createLatexMetadata, createLatexMetadataV2 } from "./metadata";
import type { RenderSettings } from "../settings";
import type { RenderedLatex } from "./renderer";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const FONT_EM_PX = 32;
const FONT_EX_PX = 16;

function numericLength(value: string | null, viewBoxLength: number): number {
  if (value) {
    const match = /^([0-9]+(?:\.[0-9]+)?)(ex|em|px|pt)?$/.exec(value.trim());
    if (match) {
      const amount = Number(match[1]);
      const unit = match[2] ?? "px";
      const multiplier = unit === "ex" ? FONT_EX_PX : unit === "em" ? FONT_EM_PX : unit === "pt" ? 96 / 72 : 1;
      return Math.max(1, amount * multiplier);
    }
  }

  return Math.max(1, (viewBoxLength / 1000) * FONT_EX_PX);
}

function roundDimension(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function inlineGlyphs(svg: SVGSVGElement): void {
  // dvisvgm can reference another scaled <use>, including forward references.
  const glyphs = new Map(Array.from(svg.querySelectorAll("defs path[id], defs use[id]")).map(
    glyph => [glyph.id, glyph],
  ));
  function expand(node: Element, visited = new Set<Element>()): Element {
    if (visited.has(node) || visited.size > 16) throw new Error("Cyclic SVG glyph reference.");
    if (node.localName === "path") {
      const path = node.cloneNode(true) as Element;
      path.removeAttribute("id");
      return path;
    }
    const href = node.getAttribute("href") ?? node.getAttribute("xlink:href") ?? "";
    const target = glyphs.get(href.slice(1));
    if (!href.startsWith("#") || !target) throw new Error("SVG contains an unsupported glyph reference.");
    const group = svg.ownerDocument.createElementNS(SVG_NAMESPACE, "g");
    for (const attribute of Array.from(node.attributes)) {
      if (!["id", "href", "xlink:href", "x", "y"].includes(attribute.name)) {
        group.setAttribute(attribute.name, attribute.value);
      }
    }
    const x = Number(node.getAttribute("x") ?? 0);
    const y = Number(node.getAttribute("y") ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Invalid SVG glyph position.");
    const translated = svg.ownerDocument.createElementNS(SVG_NAMESPACE, "g");
    translated.setAttribute("transform", "translate(" + x + " " + y + ")");
    translated.append(expand(target, new Set([...visited, node])));
    group.append(translated);
    return group;
  }
  for (const use of svg.querySelectorAll("use")) use.replaceWith(expand(use));
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

export function normalizeSvg(markup: string, latex: string, settings?: RenderSettings): RenderedLatex {
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  const sourceSvg = parsed.querySelector("svg");

  if (!(sourceSvg instanceof SVGSVGElement)) {
    throw new Error("Renderer did not produce an SVG element.");
  }

  const viewBox = sourceSvg
    .getAttribute("viewBox")
    ?.trim()
    .split(/[ ,]+/u)
    .map(Number);

  if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) {
    throw new Error("Renderer SVG is missing a valid viewBox.");
  }

  const viewBoxWidth = viewBox[2];
  const viewBoxHeight = viewBox[3];
  if (viewBoxWidth === undefined || viewBoxHeight === undefined || viewBoxWidth <= 0 || viewBoxHeight <= 0) {
    throw new Error("Renderer SVG has incomplete dimensions.");
  }

  const sourceWidth = numericLength(sourceSvg.getAttribute("width"), viewBoxWidth);
  const sourceHeight = numericLength(sourceSvg.getAttribute("height"), viewBoxHeight);
  const padding = settings?.engine === "xelatex" ? 4 : 0;
  const width = roundDimension(sourceWidth + padding * 2);
  const height = roundDimension(sourceHeight + padding * 2);
  const svg = sourceSvg.cloneNode(true) as SVGSVGElement;
  if (padding) {
    const px = padding * viewBoxWidth / sourceWidth;
    const py = padding * viewBoxHeight / sourceHeight;
    svg.setAttribute("viewBox", [
      viewBox[0]! - px, viewBox[1]! - py, viewBoxWidth + 2 * px, viewBoxHeight + 2 * py,
    ].join(" "));
  }

  // MathJax adds CSS intended for inline HTML layout. A standalone image does
  // not need it, and keeping `background`/`vertical-align` here has produced
  // inconsistent results in Chromium SVG importers.
  svg.removeAttribute("style");
  svg.removeAttribute("class");
  svg.setAttribute("xmlns", SVG_NAMESPACE);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("shape-rendering", "geometricPrecision");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "LaTeX formula");
  svg.setAttribute("focusable", "false");

  inlineGlyphs(svg);
  sanitizeSvg(svg);

  const metadata = parsed.createElementNS(SVG_NAMESPACE, "metadata");
  metadata.setAttribute("id", "excalidraw-vector-latex");
  metadata.textContent = JSON.stringify(settings ? createLatexMetadataV2(latex, settings) : createLatexMetadata(latex));
  svg.insertBefore(metadata, svg.firstChild);

  return {
    latex,
    svg: new XMLSerializer().serializeToString(svg),
    width,
    height,
  };
}

