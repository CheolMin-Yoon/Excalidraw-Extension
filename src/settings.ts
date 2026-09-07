export interface RenderSettings {
  engine: "mathjax" | "xelatex";
  textFont: string;
  mathFont: string;
  italicFont: string;
  boldFont: string;
  boldItalicFont: string;
}

export const SETTINGS_KEY = "renderSettings";
export const DEFAULT_SETTINGS: RenderSettings = {
  engine: "mathjax",
  textFont: "Cambria",
  mathFont: "Cambria Math",
  italicFont: "Cambria Italic",
  boldFont: "Cambria Bold",
  boldItalicFont: "Cambria Bold Italic",
};

export function normalizeSettings(value: unknown): RenderSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result = { ...DEFAULT_SETTINGS };
  if (source.engine === "xelatex") result.engine = "xelatex";
  for (const key of ["textFont", "mathFont", "italicFont", "boldFont", "boldItalicFont"] as const) {
    if (typeof source[key] === "string") result[key] = source[key].trim();
  }
  return result;
}

export async function readSettings(): Promise<RenderSettings> {
  const saved = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(saved[SETTINGS_KEY]);
}
