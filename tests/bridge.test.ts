import { describe, expect, it, vi } from "vitest";

import { clearTextEditor, dispatchSvgPaste } from "../src/excalidraw/bridge";
import type { RenderedLatex } from "../src/latex/renderer";

class TestDataTransfer {
  public readonly files: File[] = [];
  public readonly items = {
    add: (file: File): File => {
      this.files.push(file);
      return file;
    },
  };
}

class TestClipboardEvent extends Event {
  public readonly clipboardData: TestDataTransfer | null;

  public constructor(type: string, init: ClipboardEventInit) {
    super(type, init);
    this.clipboardData = init.clipboardData as unknown as TestDataTransfer;
  }
}

describe("Excalidraw bridge", () => {
  it("clears through the native setter and emits one input event", () => {
    document.body.innerHTML =
      '<div class="excalidraw-textEditorContainer"><textarea>$$x$$</textarea></div>';
    const editor = document.querySelector("textarea");
    const inputListener = vi.fn();
    editor?.addEventListener("input", inputListener);

    clearTextEditor(editor as HTMLTextAreaElement);

    expect(editor?.value).toBe("");
    expect(inputListener).toHaveBeenCalledOnce();
  });

  it("pastes one SVG file into the Excalidraw root", () => {
    vi.stubGlobal("DataTransfer", TestDataTransfer);
    vi.stubGlobal("ClipboardEvent", TestClipboardEvent);
    document.body.innerHTML = '<div class="excalidraw"></div>';
    const app = document.querySelector(".excalidraw");
    const listener = vi.fn((event: Event) => event.preventDefault());
    app?.addEventListener("paste", listener);
    const rendered: RenderedLatex = {
      latex: "x",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
      width: 1,
      height: 1,
    };

    dispatchSvgPaste(rendered, document);

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0]?.[0] as unknown as TestClipboardEvent;
    expect(event.clipboardData?.files).toHaveLength(1);
    expect(event.clipboardData?.files[0]?.name).toBe("latex.svg");
    expect(event.clipboardData?.files[0]?.type).toBe("image/svg+xml");
    vi.unstubAllGlobals();
  });
});
