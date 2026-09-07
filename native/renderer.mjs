import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const COMMANDS = new Set((
  "frac dfrac tfrac cfrac binom dbinom tbinom sqrt " +
  "left right middle big Big bigg Bigg bigl bigr Bigl Bigr biggl biggr Biggl Biggr " +
  "sum prod coprod int iint iiint iiiint oint oiint oiiint lim limsup liminf " +
  "sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh coth log ln exp " +
  "min max inf sup det gcd Pr arg dim ker hom mod bmod pmod pod " +
  "alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa varkappa " +
  "lambda mu nu xi omicron pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi psi omega " +
  "Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega " +
  "infty partial nabla ell hbar imath jmath Re Im wp emptyset varnothing " +
  "times cdot div pm mp ast star circ bullet otimes oplus odot land lor neg lnot " +
  "le leq ge geq ne neq approx sim simeq equiv cong propto ll gg prec succ preceq succeq " +
  "in notin ni subset supset subseteq supseteq subsetneq supsetneq sqsubseteq sqsupseteq " +
  "cup cap bigcup bigcap setminus backslash forall exists nexists top bot perp parallel mid nmid " +
  "to mapsto rightarrow leftarrow leftrightarrow Rightarrow Leftarrow Leftrightarrow " +
  "longrightarrow longleftarrow longleftrightarrow Longrightarrow Longleftarrow Longleftrightarrow " +
  "uparrow downarrow updownarrow Uparrow Downarrow Updownarrow hookrightarrow hookleftarrow " +
  "overrightarrow overleftarrow iff implies gets " +
  "langle rangle lbrace rbrace lvert rvert lVert rVert vert Vert " +
  "lfloor rfloor lceil rceil ldots cdots vdots ddots dots dotsc dotsb " +
  "hat widehat tilde widetilde bar overline underline vec dot ddot dddot breve check acute grave " +
  "overbrace underbrace overset underset stackrel boxed phantom hphantom vphantom smash " +
  "text textrm textsf texttt textnormal textbf textit emph operatorname " +
  "mathrm mathit mathbf mathsf mathtt mathnormal mathcal mathbb mathfrak boldsymbol " +
  "symup symit symbf symbfup symbfit symcal symbb symfrak " +
  "displaystyle textstyle scriptstyle scriptscriptstyle limits nolimits " +
  "quad qquad thinspace medspace thickspace negthinspace substack " +
  "begin end hline cline multicolumn hdotsfor nonumber notag tag"
).split(/\s+/u));
const ENVIRONMENTS = new Set("matrix pmatrix bmatrix Bmatrix vmatrix Vmatrix smallmatrix array cases aligned alignedat gathered split".split(" "));
const SYMBOL_COMMANDS = new Set(["\\", "{", "}", ",", ";", "!", ":", "|", " ", "%", "#", "_", "&"]);

export function validateLatex(latex) {
  if (typeof latex !== "string" || !latex.trim() || latex.length > 10240) {
    throw new Error("수식은 1~10,240자로 입력하세요.");
  }
  // Math-only input: no arbitrary TeX programs or ^^ character decoding.
  // eslint-disable-next-line no-control-regex
  if (latex.includes("^^") || /[\u0000-\u0008\u000b-\u001f\u007f$%#]/u.test(latex.replace(/\\[%#]/gu, ""))) {
    throw new Error("로컬 모드에서는 수식 본문만 입력할 수 있습니다 ($$, 주석, 매크로 정의 제외).");
  }
  for (const match of latex.matchAll(/\\([a-zA-Z]+|[^a-zA-Z])/gu)) {
    const command = match[1];
    if (!COMMANDS.has(command) && !SYMBOL_COMMANDS.has(command)) {
      throw new Error("로컬 모드에서 지원하지 않는 명령: \\" + command);
    }
    if (command === "begin" || command === "end") {
      const rest = latex.slice(match.index + match[0].length);
      const environment = /^\s*\{([A-Za-z]+)\}/u.exec(rest)?.[1];
      if (!ENVIRONMENTS.has(environment)) throw new Error("지원하지 않는 수식 환경입니다.");
    }
  }
  if (latex.endsWith("\\") && !latex.endsWith("\\\\")) throw new Error("완성되지 않은 LaTeX 명령입니다.");
  return latex;
}

function fontName(value, optional = false) {
  if (optional && value === "") return "";
  if (typeof value !== "string" || !/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,99}$/u.test(value)) {
    throw new Error("설치된 글꼴 이름을 입력하세요. 경로나 LaTeX 명령은 사용할 수 없습니다.");
  }
  return value;
}

export function buildDocument(latex, settings) {
  validateLatex(latex);
  const text = fontName(settings?.textFont);
  const math = fontName(settings?.mathFont);
  const italic = fontName(settings?.italicFont ?? "", true);
  const bold = fontName(settings?.boldFont ?? "", true);
  const boldItalic = fontName(settings?.boldItalicFont ?? "", true);
  if (math.toLowerCase() === "symbol") throw new Error("Symbol 대신 Cambria Math 같은 OpenType 수학 글꼴을 선택하세요.");
  return [
    "\\documentclass[border=1pt]{standalone}",
    "\\usepackage{amsmath}",
    "\\usepackage{unicode-math}",
    "\\setmainfont{" + text + "}",
    "\\setmathfont{" + math + "}",
    "\\setmathfont[range=up/{latin,Latin,num}]{" + text + "}",
    italic && "\\setmathfont[range=it/{latin,Latin}]{" + italic + "}",
    bold && "\\setmathfont[range=bfup/{latin,Latin,num}]{" + bold + "}",
    boldItalic && "\\setmathfont[range=bfit/{latin,Latin}]{" + boldItalic + "}",
    "\\begin{document}",
    "\\fontsize{24}{28.8}\\selectfont",
    "$\\displaystyle " + latex + "$",
    "\\end{document}",
  ].filter(Boolean).join("\n");
}

async function run(command, args, cwd) {
  try {
    return await exec(command, args, {
      cwd, windowsHide: true, timeout: 20000, maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, openin_any: "p", openout_any: "p" },
    });
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(command + " 실행 파일을 찾을 수 없습니다. 로컬 연결 도구를 다시 설치하세요.", { cause: error });
    const log = (error.stdout || "") + "\n" + (error.stderr || "");
    const detail = log.match(/^!.*(?:\r?\n.*){0,4}/mu)?.[0];
    throw new Error(error.killed ? "수식 렌더링 시간(20초)을 초과했습니다." : detail || "수식 변환 실패: " + log.slice(-1200), { cause: error });
  }
}

export async function renderNative(latex, settings, config = {}) {
  const document = buildDocument(latex, settings);
  const directory = await mkdtemp(join(tmpdir(), "excalidraw-latex-"));
  try {
    await writeFile(join(directory, "formula.tex"), document);
    const xelatex = config.xelatex || "xelatex";
    const version = await run(xelatex, ["--version"], directory);
    const args = ["-no-pdf", "-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error"];
    if (version.stdout.includes("MiKTeX")) args.push("-disable-installer");
    await run(xelatex, [...args, "formula.tex"], directory);
    const log = await readFile(join(directory, "formula.log"), "utf8");
    if (/Missing character:|does not contain requested Script "Math"|not a maths? font/iu.test(log)) {
      throw new Error("선택한 글꼴에 필요한 문자 또는 수학 데이터가 없습니다. 글꼴 설정을 바꿔 주세요.");
    }
    await run(config.dvisvgm || "dvisvgm", [
      "--no-fonts", "--no-styles", "--exact-bbox", "--bbox=min", "--page=1",
      "--output=formula.svg", "formula.xdv",
    ], directory);
    const svg = await readFile(join(directory, "formula.svg"), "utf8");
    if (Buffer.byteLength(svg) > 800000) throw new Error("수식 SVG가 너무 큽니다. 수식을 나누어 입력하세요.");
    if (/<(?:text|image|script|foreignObject)\b/iu.test(svg)) {
      throw new Error("독립적인 벡터 수식으로 변환하지 못했습니다.");
    }
    return svg;
  } finally {
    const child = relative(tmpdir(), directory);
    if (child && !child.startsWith("..") && !isAbsolute(child) && child.startsWith("excalidraw-latex-")) {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
