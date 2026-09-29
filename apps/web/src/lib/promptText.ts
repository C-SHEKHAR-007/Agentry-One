/** Helpers for the prompt library: placeholder detection, template
 * segmentation for highlighting, and a line diff between versions. */

const PLACEHOLDER = /\{\{\s*([a-zA-Z_][\w.-]*)\s*\}\}/g;

/** Unique `{{name}}` placeholders in order of first appearance. */
export function extractPlaceholders(template: string): string[] {
  const seen = new Set<string>();
  for (const m of template.matchAll(PLACEHOLDER)) seen.add(m[1]);
  return [...seen];
}

export type Segment = { kind: "text"; value: string } | { kind: "placeholder"; value: string; name: string };

/** Splits a template into literal text and placeholder segments. */
export function segmentTemplate(template: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of template.matchAll(PLACEHOLDER)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ kind: "text", value: template.slice(last, start) });
    out.push({ kind: "placeholder", value: m[0], name: m[1] });
    last = start + m[0].length;
  }
  if (last < template.length) out.push({ kind: "text", value: template.slice(last) });
  return out;
}

export function textStats(template: string): { characters: number; words: number; lines: number } {
  const trimmed = template.trim();
  return {
    characters: template.length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    lines: template ? template.split("\n").length : 0,
  };
}

export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

/** Line-level diff (LCS). Prompts are short, so O(n·m) is fine. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "removed", text: a[i++] });
    } else {
      out.push({ kind: "added", text: b[j++] });
    }
  }
  while (i < a.length) out.push({ kind: "removed", text: a[i++] });
  while (j < b.length) out.push({ kind: "added", text: b[j++] });
  return out;
}

/** Normalizes a user-typed prompt key to the library's slug form. */
export function toPromptKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
