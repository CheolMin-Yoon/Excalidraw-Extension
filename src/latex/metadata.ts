export interface LatexMetadataV1 {
  schema: "excalidraw-vector-latex";
  version: 1;
  latex: string;
  displayMode: true;
  color: "#000000";
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
