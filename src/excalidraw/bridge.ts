import type { RenderedLatex } from "../latex/renderer";

export const TEXT_EDITOR_SELECTOR = ".excalidraw-textEditorContainer > textarea";
const APP_SELECTOR = ".excalidraw";

export function getTextEditor(target: EventTarget | null): HTMLTextAreaElement | null {
  return target instanceof HTMLTextAreaElement && target.matches(TEXT_EDITOR_SELECTOR)
    ? target
    : null;
}

export function getActiveTextEditor(documentRef: Document): HTMLTextAreaElement | null {
  return getTextEditor(documentRef.activeElement);
}

export function clearTextEditor(editor: HTMLTextAreaElement): void {
  const setter = Object.getOwnPropertyDescriptor(
    editor.ownerDocument.defaultView?.HTMLTextAreaElement.prototype ?? HTMLTextAreaElement.prototype,
    "value",
  )?.set;

  if (!setter) {
    throw new Error("The browser does not expose the native textarea value setter.");
  }

  setter.call(editor, "");
  editor.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "deleteContentBackward",
      data: null,
    }),
  );
}

export function dispatchSvgPaste(rendered: RenderedLatex, documentRef: Document): void {
  const app = documentRef.querySelector<HTMLElement>(APP_SELECTOR);
  if (!app) {
    throw new Error("Could not find the Excalidraw application root.");
  }

  const file = new File([rendered.svg], "latex.svg", {
    type: "image/svg+xml",
    lastModified: Date.now(),
  });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData: dataTransfer,
  });

  app.dispatchEvent(pasteEvent);
}

export function afterEditorSubmit(callback: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}
