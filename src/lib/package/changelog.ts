import type { TokenDiff } from "@/lib/tokens/types";
import type { ComponentDiff } from "@/lib/components/types";
import type { SemverBump } from "./version";

export interface ChangelogOptions {
  version: string;
  bump: SemverBump;
  buildId: string;
  timestamp: string;
}

/**
 * Generate a markdown changelog section from token + component diffs.
 * Deterministic for identical inputs.
 */
export function generateChangelog(
  tokenDiff: TokenDiff,
  componentDiff: ComponentDiff,
  options: ChangelogOptions
): string {
  const lines: string[] = [];

  lines.push(`# Changelog`);
  lines.push("");
  lines.push(`## ${options.version} (${options.timestamp.slice(0, 10)})`);
  lines.push("");
  lines.push(`Build: \`${options.buildId.slice(0, 8)}\` | Bump: **${options.bump}**`);
  lines.push("");

  const hasTokenChanges =
    tokenDiff.added.length > 0 ||
    tokenDiff.removed.length > 0 ||
    tokenDiff.changed.length > 0;

  const hasComponentChanges =
    componentDiff.added.length > 0 ||
    componentDiff.removed.length > 0 ||
    componentDiff.changed.length > 0;

  if (!hasTokenChanges && !hasComponentChanges) {
    lines.push("No changes from previous build.");
    lines.push("");
    return lines.join("\n");
  }

  // Token changes
  if (hasTokenChanges) {
    lines.push("### Tokens");
    lines.push("");

    if (tokenDiff.added.length > 0) {
      lines.push("**Added:**");
      for (const entry of tokenDiff.added) {
        lines.push(`- \`${entry.name}\` (${entry.category})`);
      }
      lines.push("");
    }

    if (tokenDiff.removed.length > 0) {
      lines.push("**Removed:**");
      for (const entry of tokenDiff.removed) {
        lines.push(`- \`${entry.name}\` (${entry.category})`);
      }
      lines.push("");
    }

    if (tokenDiff.changed.length > 0) {
      lines.push("**Changed:**");
      for (const entry of tokenDiff.changed) {
        lines.push(`- \`${entry.name}\` (${entry.category})`);
      }
      lines.push("");
    }
  }

  // Component changes
  if (hasComponentChanges) {
    lines.push("### Components");
    lines.push("");

    if (componentDiff.added.length > 0) {
      lines.push("**Added:**");
      for (const entry of componentDiff.added) {
        lines.push(`- \`${entry.name}\``);
      }
      lines.push("");
    }

    if (componentDiff.removed.length > 0) {
      lines.push("**Removed:**");
      for (const entry of componentDiff.removed) {
        lines.push(`- \`${entry.name}\``);
      }
      lines.push("");
    }

    if (componentDiff.changed.length > 0) {
      lines.push("**Changed:**");
      for (const entry of componentDiff.changed) {
        const details =
          entry.changes && entry.changes.length > 0
            ? ` — ${entry.changes.join(", ")}`
            : "";
        lines.push(`- \`${entry.name}\`${details}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
