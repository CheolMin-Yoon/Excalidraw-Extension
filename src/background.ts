import { normalizeSettings } from "./settings";

const HOST = "com.excalidraw.vector_latex";
const LOCAL_RENDERER = "http://127.0.0.1:18743/render";

async function renderThroughLocalServer(request: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(LOCAL_RENDERER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "render",
      latex: request.latex,
      settings: normalizeSettings(request.settings),
    }),
  });
  const result = await response.json() as unknown;
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result
      ? String((result as { error: unknown }).error)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return result;
}
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !sender.url) return false;
  const source = new URL(sender.url);
  const isPopup = source.protocol === "chrome-extension:" && source.hostname === chrome.runtime.id;
  const isCanvas = source.origin === "https://excalidraw.com";
  if (!isPopup && !isCanvas) return false;
  if (!message || typeof message !== "object") return false;
  const request = message as Record<string, unknown>;
  if (request.type !== "render-native") return false;
  if (typeof request.latex !== "string" || request.latex.length > 10240) {
    sendResponse({ ok: false, error: "수식은 10,240자 이내로 입력하세요." });
    return false;
  }
  chrome.runtime.sendNativeMessage(HOST, {
    type: "render", latex: request.latex, settings: normalizeSettings(request.settings),
  }, (response: unknown) => {
    const error = chrome.runtime.lastError;
    if (!error) {
      sendResponse(response);
      return;
    }
    void renderThroughLocalServer(request).then(sendResponse, (fallbackError: unknown) => {
      const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      sendResponse({
        ok: false,
        error: "로컬 렌더러에 연결하지 못했습니다. 설치 스크립트를 다시 실행하세요. " + message,
      });
    });
  });
  return true;
});
