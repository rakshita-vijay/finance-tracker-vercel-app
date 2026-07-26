/**
 * Agents are asked to "reproduce the transaction table exactly" in the
 * report's Appendix, but nothing forces them to wrap it in a ```code fence```
 * when they do. Standard Markdown treats single newlines as soft breaks (they
 * render as a plain space), so an un-fenced multi-line box-drawing table like:
 *
 *   +--------+------------+
 *   | S.NO   | DATE       |
 *   +--------+------------+
 *   | 01     | 2026-06-01 |
 *   +--------+------------+
 *
 * gets flattened into one long, wrapped paragraph the moment it's rendered
 * (or opened in any other Markdown viewer) - the exact "|Weekly groceries | |
 * 02 | 2026-06-02" garbling seen when a table like this loses its newlines.
 *
 * This scans the markdown for un-fenced runs of ASCII-table lines (detected
 * by the unambiguous "+---+---+" border row, which never appears in genuine
 * prose or in a GFM table) and wraps each run in a code fence, leaving
 * everything else - including tables the agent already fenced correctly -
 * untouched.
 */

const FENCE_RE = /^\s*```/;
const BORDER_RE = /^\+[-+]+\+\s*$/; // e.g. "+------+------+"
const PIPE_ROW_RE = /^\|.*\|\s*$/; // e.g. "| 01 | 2026-06-01 | ... |"

export function ensureAsciiTablesFenced(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inFence = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      out.push(line);
      i++;
      continue;
    }

    if (!inFence && BORDER_RE.test(line)) {
      // Found the start of an un-fenced ASCII table. Swallow every
      // subsequent border/pipe row until the pattern breaks.
      const block: string[] = [];
      while (i < lines.length && (BORDER_RE.test(lines[i]) || PIPE_ROW_RE.test(lines[i]))) {
        block.push(lines[i]);
        i++;
      }
      out.push("```", ...block, "```");
      continue;
    }

    out.push(line);
    i++;
  }

  return out.join("\n");
}
