import { normalizeSettings } from "./settings";

const HOST = "com.excalidraw.vector_latex";
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
    sendResponse(error ? {
      ok: false,
      error: "로컬 렌더러에 연결하지 못했습니다. 확장 설정의 설치 안내를 확인하세요. " + error.message,
    } : response);
  });
  return true;
});
