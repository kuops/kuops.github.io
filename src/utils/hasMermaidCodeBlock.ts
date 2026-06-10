const MERMAID_CODE_BLOCK_RE = /(^|\n)```mermaid(?:\r?\n|$)/;

export function hasMermaidCodeBlock(content: string) {
  return MERMAID_CODE_BLOCK_RE.test(content);
}
