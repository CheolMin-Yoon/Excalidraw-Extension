import "./popup.css";
import { DEFAULT_SETTINGS, readSettings, SETTINGS_KEY, type RenderSettings } from "./settings";
import { normalizeSvg } from "./latex/svg";
import { renderLatexToSvg } from "./latex/renderer";

const form = document.querySelector<HTMLFormElement>("#settings")!;
const preset = document.querySelector<HTMLSelectElement>("#preset")!;
const nativeFields = document.querySelector<HTMLFieldSetElement>("#native-fields")!;
const status = document.querySelector<HTMLElement>("#status")!;
const preview = document.querySelector<HTMLImageElement>("#preview")!;
const previewButton = document.querySelector<HTMLButtonElement>("#preview-button")!;
const sample = document.querySelector<HTMLTextAreaElement>("#sample")!;
const fontKeys = ["textFont", "mathFont", "italicFont", "boldFont", "boldItalicFont"] as const;
const inputs = Object.fromEntries(fontKeys.map(key => [key, document.getElementById(key)])) as Record<typeof fontKeys[number], HTMLInputElement>;
let imageUrl = "";
let revision = 0;

function values(): RenderSettings {
  return {
    ...DEFAULT_SETTINGS,
    engine: preset.value === "mathjax" ? "mathjax" : "xelatex",
    ...Object.fromEntries(fontKeys.map(key => [key, inputs[key].value.trim()])),
  };
}
function fill(settings: RenderSettings): void {
  for (const key of fontKeys) inputs[key].value = settings[key];
  nativeFields.hidden = settings.engine === "mathjax";
}
function clearPreview(): void {
  revision++;
  preview.hidden = true;
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = "";
  status.textContent = "";
}
preset.addEventListener("change", () => {
  clearPreview();
  nativeFields.hidden = preset.value === "mathjax";
  if (preset.value !== "custom" && preset.value !== "mathjax") {
    const name = preset.value;
    fill({
      engine: "xelatex", textFont: name, mathFont: "Cambria Math",
      italicFont: name + (name === "Helvetica" ? " Oblique" : " Italic"),
      boldFont: name + " Bold",
      boldItalicFont: name + (name === "Helvetica" ? " Bold Oblique" : " Bold Italic"),
    });
  }
});
for (const input of Object.values(inputs)) input.addEventListener("input", () => {
  preset.value = "custom";
  clearPreview();
});
sample.addEventListener("input", clearPreview);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  void chrome.storage.local.set({ [SETTINGS_KEY]: values() }).then(() => {
    status.textContent = "저장했습니다. 다음 수식부터 적용됩니다.";
  }).catch((error: unknown) => {
    status.textContent = String(error);
  });
});
previewButton.addEventListener("click", () => {
  void (async () => {
    clearPreview();
    const currentRevision = revision;
    const settings = values();
    previewButton.disabled = true;
    status.textContent = "수식을 만드는 중…";
    try {
      const latex = sample.value.trim();
      let svg: string;
      if (settings.engine === "mathjax") {
        svg = (await renderLatexToSvg(latex)).svg;
      } else {
        const response = await chrome.runtime.sendMessage({ type: "render-native", latex, settings }) as { ok?: boolean; svg?: string; error?: string };
        if (!response?.ok || !response.svg) throw new Error(response?.error || "로컬 렌더러 응답이 없습니다.");
        svg = normalizeSvg(response.svg, latex, settings).svg;
      }
      if (currentRevision !== revision) return;
      imageUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      preview.src = imageUrl;
      preview.hidden = false;
      status.textContent = "미리보기 완료. 저장하면 다음 수식에 적용됩니다.";
    } catch (error) {
      if (currentRevision === revision) status.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      previewButton.disabled = false;
    }
  })();
});
document.querySelector("#install-command")!.textContent =
  `powershell -ExecutionPolicy Bypass -File .\\native\\install.ps1 -ExtensionId ${chrome.runtime.id}`;
void readSettings().then(settings => {
  // Show custom when settings contain a user-selected font combination.
  preset.value = settings.engine === "mathjax" ? "mathjax" : "custom";
  fill(settings);
}).catch((error: unknown) => { status.textContent = String(error); });
