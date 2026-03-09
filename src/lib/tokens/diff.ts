import type { CanonicalToken, TokenCategory, TokenDiff, TokenDiffEntry } from "./types";

/** Compare two sorted CanonicalToken arrays and produce a diff. */
export function computeTokenDiff(
  previous: CanonicalToken[],
  current: CanonicalToken[]
): TokenDiff {
  const prevMap = new Map(previous.map((t) => [t.name, t]));
  const currMap = new Map(current.map((t) => [t.name, t]));

  const added: TokenDiffEntry[] = [];
  const removed: TokenDiffEntry[] = [];
  const changed: TokenDiffEntry[] = [];

  // Find added and changed
  for (const [name, token] of currMap) {
    const prev = prevMap.get(name);
    if (!prev) {
      added.push({ name, category: token.category, newValue: token.value });
    } else if (JSON.stringify(prev.value) !== JSON.stringify(token.value)) {
      changed.push({
        name,
        category: token.category,
        oldValue: prev.value,
        newValue: token.value,
      });
    }
  }

  // Find removed
  for (const [name, token] of prevMap) {
    if (!currMap.has(name)) {
      removed.push({ name, category: token.category, oldValue: token.value });
    }
  }

  // Sort each array by name for determinism
  added.sort((a, b) => a.name.localeCompare(b.name));
  removed.sort((a, b) => a.name.localeCompare(b.name));
  changed.sort((a, b) => a.name.localeCompare(b.name));

  return { added, removed, changed };
}
