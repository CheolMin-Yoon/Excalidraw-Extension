import { readSettings } from "../settings";
import { normalizeSvg } from "./svg";
import { renderLatexToSvg } from "./renderer";

let generation = 0;
let nativeQueue: Promise<unknown> = Promise.resolve();

export async function renderWithSelectedFont(latex: string) {
  const requestGeneration = ++generation;
  const settings = await readSettings();
  if (settings.engine === "mathjax") return renderLatexToSvg(latex);
  // Coalesce typing and keep at most one local TeX process active per canvas.
  await new Promise(resolve => setTimeout(resolve, 200));
  const request = nativeQueue.then(async () => {
    if (requestGeneration !== generation) throw new Error("수식이 변경되어 이전 렌더링을 취소했습니다.");
    return chrome.runtime.sendMessage({ type: "render-native", latex, settings }) as Promise<unknown>;
  });
  nativeQueue = request.catch(() => undefined);
  const response = await request;
  if (!response || typeof response !== "object") throw new Error("로컬 렌더러 응답이 없습니다.");
  const result = response as { ok?: boolean; svg?: string; error?: string };
  if (!result.ok || typeof result.svg !== "string") {
    throw new Error(result.error || "로컬 수식 렌더링에 실패했습니다.");
  }
  return normalizeSvg(result.svg, latex, settings);
}
