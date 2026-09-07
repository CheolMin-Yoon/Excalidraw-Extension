import type { RenderSettings } from "../settings";

export interface LatexMetadataV1 {
  schema: "excalidraw-vector-latex";
  version: 1;
  latex: string;
  displayMode: true;
  color: "#000000";
}

export interface LatexMetadataV2 extends Omit<LatexMetadataV1, "version"> {
  version: 2;
  rendering: RenderSettings;
}

export function createLatexMetadataV2(latex: string, rendering: RenderSettings): LatexMetadataV2 {
  return { ...createLatexMetadata(latex), version: 2, rendering: { ...rendering } };
}

export function createLatexMetadata(latex: string): LatexMetadataV1 {
  return {
    schema: "excalidraw-vector-latex",
    version: 1,
    latex,
    displayMode: true,
    color: "#000000",
  };
}
