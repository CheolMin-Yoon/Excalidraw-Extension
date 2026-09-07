import {
  afterEditorSubmit,
  clearTextEditor,
  dispatchSvgPaste,
  getActiveTextEditor,
  getTextEditor,
} from "./excalidraw/bridge";
import { parseLatexBlock } from "./latex/parser";
import type { RenderedLatex } from "./latex/renderer";
import { renderWithSelectedFont } from "./latex/selected-renderer";
import { showErrorNotice } from "./ui/notice";

interface EditorState {
  value: string;
  renderPromise: Promise<RenderedLatex>;
  rendered?: RenderedLatex;
  prepared?: RenderedLatex;
  finishing?: boolean;
}

export interface ControllerDependencies {
  render: (latex: string) => Promise<RenderedLatex>;
  paste: (rendered: RenderedLatex, documentRef: Document) => void;
  clear: (editor: HTMLTextAreaElement) => void;
  notifyError: (message: string, documentRef: Document) => void;
  afterSubmit: (callback: () => void) => void;
}

const defaultDependencies: ControllerDependencies = {
  render: renderWithSelectedFont,
  paste: dispatchSvgPaste,
  clear: clearTextEditor,
  notifyError: showErrorNotice,
  afterSubmit: afterEditorSubmit,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류";
}

function isTemporaryPropertiesInteraction(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest(".properties-trigger, .properties-content, .compact-shape-actions-island"))
  );
}

export class LatexConversionController {
  private readonly states = new WeakMap<HTMLTextAreaElement, EditorState>();
  private readonly clearingEditors = new WeakSet<HTMLTextAreaElement>();
  private replayingBlur = false;
  private started = false;

  public constructor(
    private readonly documentRef: Document = document,
    private readonly windowRef: Window = window,
    private readonly dependencies: ControllerDependencies = defaultDependencies,
  ) {}

  public start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.documentRef.addEventListener("input", this.onInput, true);
    this.documentRef.addEventListener("blur", this.onBlur, true);
    this.windowRef.addEventListener("pointerdown", this.onPointerDown, true);
  }

  public stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.documentRef.removeEventListener("input", this.onInput, true);
    this.documentRef.removeEventListener("blur", this.onBlur, true);
    this.windowRef.removeEventListener("pointerdown", this.onPointerDown, true);
  }

  private readonly onInput = (event: Event): void => {
    const editor = getTextEditor(event.target);
    if (editor && !this.clearingEditors.has(editor)) {
      this.prepareRender(editor);
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    const editor = getActiveTextEditor(this.documentRef);
    if (
      !editor ||
      event.target === editor ||
      editor.contains(event.target as Node | null) ||
      isTemporaryPropertiesInteraction(event.target)
    ) {
      return;
    }

    const state = this.prepareRender(editor);
    if (!state) {
      return;
    }

    if (state.rendered) {
      this.prepareEditorForSubmit(editor, state, state.rendered);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    void this.finishConversion(editor, state, true);
  };

  private readonly onBlur = (event: FocusEvent): void => {
    if (this.replayingBlur || isTemporaryPropertiesInteraction(event.relatedTarget)) {
      return;
    }

    const editor = getTextEditor(event.target);
    if (!editor) {
      return;
    }

    const existingState = this.states.get(editor);
    if (existingState?.prepared) {
      const rendered = existingState.prepared;
      this.dependencies.afterSubmit(() => this.safePaste(rendered));
      return;
    }

    const state = this.prepareRender(editor);
    if (!state) {
      return;
    }

    event.stopImmediatePropagation();
    void this.finishConversion(editor, state, false);
  };

  private prepareRender(editor: HTMLTextAreaElement): EditorState | null {
    const parsed = parseLatexBlock(editor.value);
    if (!parsed) {
      this.states.delete(editor);
      return null;
    }

    const existing = this.states.get(editor);
    if (existing?.value === editor.value) {
      return existing;
    }

    const state: EditorState = {
      value: editor.value,
      renderPromise: this.dependencies.render(parsed.latex),
    };
    this.states.set(editor, state);
    void state.renderPromise.then(
      (rendered) => {
        if (this.states.get(editor) === state) {
          state.rendered = rendered;
        }
      },
      () => {
        // The blur/pointer handler owns user-visible error reporting.
      },
    );
    return state;
  }

  private prepareEditorForSubmit(
    editor: HTMLTextAreaElement,
    state: EditorState,
    rendered: RenderedLatex,
  ): void {
    if (editor.value !== state.value) {
      return;
    }

    this.clearingEditors.add(editor);
    try {
      this.dependencies.clear(editor);
      state.prepared = rendered;
      this.states.set(editor, state);
    } finally {
      this.clearingEditors.delete(editor);
    }
  }

  private async finishConversion(
    editor: HTMLTextAreaElement,
    state: EditorState,
    pointerEventWasBlocked: boolean,
  ): Promise<void> {
    if (state.finishing) return;
    state.finishing = true;
    try {
      const rendered = await state.renderPromise;
      if (!editor.isConnected || editor.value !== state.value || this.states.get(editor) !== state) {
        return;
      }

      this.prepareEditorForSubmit(editor, state, rendered);
      this.replayBlur(editor);
      this.dependencies.afterSubmit(() => this.safePaste(rendered));
    } catch (error) {
      if (this.states.get(editor) !== state || editor.value !== state.value) return;
      this.states.delete(editor);
      this.dependencies.notifyError(errorMessage(error), this.documentRef);
      if (editor.isConnected) {
        this.replayBlur(editor);
        if (pointerEventWasBlocked) {
          editor.focus({ preventScroll: true });
        }
      }
    } finally {
      state.finishing = false;
    }
  }

  private replayBlur(editor: HTMLTextAreaElement): void {
    this.replayingBlur = true;
    try {
      editor.dispatchEvent(new FocusEvent("blur"));
    } finally {
      this.replayingBlur = false;
    }
  }

  private safePaste(rendered: RenderedLatex): void {
    try {
      this.dependencies.paste(rendered, this.documentRef);
    } catch (error) {
      this.dependencies.notifyError(errorMessage(error), this.documentRef);
    }
  }
}
