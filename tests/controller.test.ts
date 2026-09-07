import { describe, expect, it, vi } from "vitest";

import {
  LatexConversionController,
  type ControllerDependencies,
} from "../src/controller";
import type { RenderedLatex } from "../src/latex/renderer";

const rendered: RenderedLatex = {
  latex: "x^2",
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>',
  width: 10,
  height: 10,
};

function flushPromises(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function makeFixture(render: ControllerDependencies["render"] = vi.fn().mockResolvedValue(rendered)) {
  document.body.innerHTML = [
    '<div class="excalidraw">',
    '  <div class="excalidraw-textEditorContainer">',
    "    <textarea></textarea>",
    "  </div>",
    "</div>",
  ].join("");
  const editor = document.querySelector("textarea") as HTMLTextAreaElement;
  const dependencies: ControllerDependencies = {
    render,
    paste: vi.fn(),
    clear: vi.fn((target) => {
      target.value = "";
      target.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }),
    notifyError: vi.fn(),
    afterSubmit: (callback) => callback(),
  };
  const controller = new LatexConversionController(document, window, dependencies);
  controller.start();
  return { controller, dependencies, editor };
}

describe("LatexConversionController", () => {
  it("ignores a stale render failure after the user changes the source", async () => {
    let rejectRender!: (reason: Error) => void;
    const { controller, editor, dependencies } = makeFixture(() => new Promise((_resolve, reject) => { rejectRender = reject; }));
    editor.value = "$$x^2$$";
    editor.dispatchEvent(new FocusEvent("blur"));
    editor.value = "corrected text";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    rejectRender(new Error("Old formula failed"));
    await flushPromises();
    expect(dependencies.notifyError).not.toHaveBeenCalled();
    expect(dependencies.clear).not.toHaveBeenCalled();
    controller.stop();
  });

  it("can retry the same formula after a renderer connection failure", async () => {
    const render = vi.fn().mockRejectedValueOnce(new Error("Host offline")).mockResolvedValueOnce(rendered);
    const { controller, editor, dependencies } = makeFixture(render);
    editor.value = "$$x^2$$";
    editor.dispatchEvent(new FocusEvent("blur"));
    await flushPromises();
    expect(editor.value).toBe("$$x^2$$");
    editor.dispatchEvent(new FocusEvent("blur"));
    await flushPromises();
    expect(render).toHaveBeenCalledTimes(2);
    expect(dependencies.paste).toHaveBeenCalledOnce();
    controller.stop();
  });

  it("does not paste twice when blur repeats during a slow native render", async () => {
    let resolveRender!: (result: RenderedLatex) => void;
    const { controller, editor, dependencies } = makeFixture(() => new Promise(resolve => { resolveRender = resolve; }));
    editor.value = "$$x^2$$";
    editor.dispatchEvent(new FocusEvent("blur"));
    editor.dispatchEvent(new FocusEvent("blur"));
    resolveRender(rendered);
    await flushPromises();
    expect(dependencies.clear).toHaveBeenCalledOnce();
    expect(dependencies.paste).toHaveBeenCalledOnce();
    controller.stop();
  });

  it("warms on input, clears once, and pastes once on blur", async () => {
    const { controller, dependencies, editor } = makeFixture();
    const submit = vi.fn();
    editor.onblur = submit;
    editor.value = "$$x^2$$";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await flushPromises();

    editor.dispatchEvent(new FocusEvent("blur"));
    await flushPromises();

    expect(dependencies.render).toHaveBeenCalledOnce();
    expect(dependencies.clear).toHaveBeenCalledOnce();
    expect(dependencies.paste).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
    controller.stop();
  });

  it("preserves the source and submits it after a rendering failure", async () => {
    const render = vi.fn().mockRejectedValue(new Error("Unknown command"));
    const { controller, dependencies, editor } = makeFixture(render);
    const submit = vi.fn();
    editor.onblur = submit;
    editor.value = "$$\\badcommand$$";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));

    editor.dispatchEvent(new FocusEvent("blur"));
    await flushPromises();

    expect(editor.value).toBe("$$\\badcommand$$");
    expect(dependencies.clear).not.toHaveBeenCalled();
    expect(dependencies.paste).not.toHaveBeenCalled();
    expect(dependencies.notifyError).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
    controller.stop();
  });

  it("leaves ordinary or mixed text untouched", async () => {
    const { controller, dependencies, editor } = makeFixture();
    const submit = vi.fn();
    editor.onblur = submit;
    editor.value = "answer: $$x^2$$";

    editor.dispatchEvent(new FocusEvent("blur"));
    await flushPromises();

    expect(dependencies.render).not.toHaveBeenCalled();
    expect(dependencies.clear).not.toHaveBeenCalled();
    expect(dependencies.paste).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledOnce();
    controller.stop();
  });

  it("does not attach duplicate listeners", async () => {
    const { controller, dependencies, editor } = makeFixture();
    controller.start();
    editor.value = "$$x^2$$";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await flushPromises();
    editor.dispatchEvent(new FocusEvent("blur"));
    await flushPromises();

    expect(dependencies.render).toHaveBeenCalledOnce();
    expect(dependencies.paste).toHaveBeenCalledOnce();
    controller.stop();
  });

  it("pastes a pre-rendered formula after a canvas pointerdown and blur", async () => {
    const { controller, dependencies, editor } = makeFixture();
    const app = document.querySelector(".excalidraw") as HTMLElement;
    editor.focus();
    editor.value = "$$x^2$$";
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await flushPromises();

    app.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    editor.dispatchEvent(new FocusEvent("blur"));
    await flushPromises();

    expect(dependencies.clear).toHaveBeenCalledOnce();
    expect(dependencies.paste).toHaveBeenCalledOnce();
    controller.stop();
  });
});
