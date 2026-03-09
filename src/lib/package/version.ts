import type { TokenDiff } from "@/lib/tokens/types";
import type { ComponentDiff } from "@/lib/components/types";

export type SemverBump = "major" | "minor" | "patch" | "none";

export interface VersionResult {
  bump: SemverBump;
  version: string;
  reasons: string[];
}

/**
 * Determine the semver bump category from token + component diffs.
 *
 * Policy:
 * - major: tokens or components were removed (breaking change for consumers)
 * - minor: tokens or components were added, or component specs changed
 * - patch: only token values changed (non-breaking value updates)
 * - none: no diff (identical to previous build)
 */
export function determineBump(
  tokenDiff: TokenDiff,
  componentDiff: ComponentDiff
): SemverBump {
  const reasons = collectReasons(tokenDiff, componentDiff);
  if (reasons.length === 0) return "none";

  // Any removal is a breaking change
  if (tokenDiff.removed.length > 0 || componentDiff.removed.length > 0) {
    return "major";
  }

  // Additions or component spec changes are minor
  if (
    tokenDiff.added.length > 0 ||
    componentDiff.added.length > 0 ||
    componentDiff.changed.length > 0
  ) {
    return "minor";
  }

  // Only token value changes remain — that's a patch
  return "patch";
}

/**
 * Collect human-readable reasons for the version bump.
 */
function collectReasons(
  tokenDiff: TokenDiff,
  componentDiff: ComponentDiff
): string[] {
  const reasons: string[] = [];

  if (tokenDiff.added.length > 0) {
    reasons.push(`${tokenDiff.added.length} token(s) added`);
  }
  if (tokenDiff.removed.length > 0) {
    reasons.push(`${tokenDiff.removed.length} token(s) removed`);
  }
  if (tokenDiff.changed.length > 0) {
    reasons.push(`${tokenDiff.changed.length} token(s) changed`);
  }
  if (componentDiff.added.length > 0) {
    reasons.push(`${componentDiff.added.length} component(s) added`);
  }
  if (componentDiff.removed.length > 0) {
    reasons.push(`${componentDiff.removed.length} component(s) removed`);
  }
  if (componentDiff.changed.length > 0) {
    reasons.push(`${componentDiff.changed.length} component(s) changed`);
  }

  return reasons;
}

/**
 * Increment a semver string by the given bump category.
 * If previousVersion is null (first build), returns "0.1.0".
 */
export function incrementVersion(
  previousVersion: string | null,
  bump: SemverBump
): string {
  if (!previousVersion || bump === "none") {
    return previousVersion ?? "0.1.0";
  }

  const match = previousVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    // Not a valid semver — start fresh
    return "0.1.0";
  }

  const [, majorStr, minorStr, patchStr] = match;
  const major = parseInt(majorStr, 10);
  const minor = parseInt(minorStr, 10);
  const patch = parseInt(patchStr, 10);

  switch (bump) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      return previousVersion;
  }
}

/**
 * Compute the next version for a build given diffs and previous version.
 */
export function computeNextVersion(
  tokenDiff: TokenDiff,
  componentDiff: ComponentDiff,
  previousVersion: string | null
): VersionResult {
  const bump = determineBump(tokenDiff, componentDiff);
  const reasons = collectReasons(tokenDiff, componentDiff);
  const version =
    bump === "none"
      ? previousVersion ?? "0.1.0"
      : incrementVersion(previousVersion, bump);

  return { bump, version, reasons };
}
