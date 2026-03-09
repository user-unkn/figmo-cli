import type {
  DiffSummary,
  TokenSummaryEntry,
  ComponentSummaryEntry,
} from "./summary";

const MAX_ITEMS = 10;

function renderList(
  prefix: string,
  items: { name: string }[],
  label: string
): string {
  const lines: string[] = [];
  lines.push(`  ${prefix} ${items.length} ${label}`);
  for (const item of items.slice(0, MAX_ITEMS)) {
    lines.push(`    ${prefix} ${item.name}`);
  }
  if (items.length > MAX_ITEMS) {
    lines.push(`    ... and ${items.length - MAX_ITEMS} more`);
  }
  return lines.join("\n");
}

function renderTokenSection(
  tokens: DiffSummary["tokens"]
): string {
  const lines: string[] = ["Tokens:"];

  if (tokens.totalChanges === 0) {
    lines.push("  No token changes");
    return lines.join("\n");
  }

  if (tokens.added.length > 0) {
    lines.push(renderList("+", tokens.added, "added"));
  }
  if (tokens.removed.length > 0) {
    lines.push(renderList("-", tokens.removed, "removed"));
  }
  if (tokens.changed.length > 0) {
    lines.push(renderList("~", tokens.changed, "changed"));
  }

  return lines.join("\n");
}

function renderComponentSection(
  components: DiffSummary["components"]
): string {
  const lines: string[] = ["Components:"];

  if (components.totalChanges === 0) {
    lines.push("  No component changes");
    return lines.join("\n");
  }

  if (components.added.length > 0) {
    lines.push(`  + ${components.added.length} added`);
    for (const c of components.added) {
      lines.push(`    + ${c.name}`);
    }
  }
  if (components.removed.length > 0) {
    lines.push(`  - ${components.removed.length} removed`);
    for (const c of components.removed) {
      lines.push(`    - ${c.name}`);
    }
  }
  if (components.changed.length > 0) {
    lines.push(`  ~ ${components.changed.length} changed`);
    for (const c of components.changed) {
      lines.push(`    ~ ${c.name}`);
      for (const change of c.changes) {
        lines.push(`      ${change}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Render a DiffSummary as human-readable text.
 * Returns the full output string (no trailing newline — caller adds it).
 */
export function renderDiffText(summary: DiffSummary): string {
  const lines: string[] = [];

  lines.push(
    `Local:  build ${summary.localVersion} (${summary.localBuildId.slice(0, 8)})`
  );
  lines.push(
    `Remote: build ${summary.remoteVersion} (${summary.remoteBuildId.slice(0, 8)})`
  );
  lines.push("");
  lines.push(renderTokenSection(summary.tokens));
  lines.push("");
  lines.push(renderComponentSection(summary.components));

  return lines.join("\n");
}

/**
 * Render a DiffSummary as a JSON string (compact, for piping/scripting).
 */
export function renderDiffJson(summary: DiffSummary): string {
  return JSON.stringify(summary, null, 2);
}
