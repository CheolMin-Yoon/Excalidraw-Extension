export interface ParsedLatexBlock {
  latex: string;
}

function isEscaped(value: string, index: number): boolean {
  let backslashes = 0;

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }

  return backslashes % 2 === 1;
}

function findDelimiters(value: string): number[] {
  const positions: number[] = [];

  for (let index = 0; index < value.length - 1; index += 1) {
    if (value[index] === "$" && value[index + 1] === "$" && !isEscaped(value, index)) {
      positions.push(index);
      index += 1;
    }
  }

  return positions;
}

export function parseLatexBlock(value: string): ParsedLatexBlock | null {
  const trimmed = value.trim();
  const delimiters = findDelimiters(trimmed);

  if (
    delimiters.length !== 2 ||
    delimiters[0] !== 0 ||
    delimiters[1] !== trimmed.length - 2
  ) {
    return null;
  }

  const latex = trimmed.slice(2, -2).trim();
  return latex.length > 0 ? { latex } : null;
}
