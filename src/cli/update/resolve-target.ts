import { fetchManifest } from "../manifest";
import type { Manifest } from "../manifest";
import { CliError } from "../errors";

export interface ResolveTargetInput {
  apiUrl: string;
  org: string;
  project: string;
  buildId?: string;
}

export interface ResolvedTarget {
  manifest: Manifest;
  buildId: string;
  version: string;
}

/**
 * Resolve the target build for an update.
 * - If buildId is provided, fetches that specific build.
 * - Otherwise, fetches the latest build.
 * Throws if the target build does not exist or has not succeeded.
 */
export async function resolveTargetBuild(
  input: ResolveTargetInput
): Promise<ResolvedTarget> {
  const manifest = await fetchManifest(
    input.apiUrl,
    input.org,
    input.project,
    input.buildId ? { buildId: input.buildId } : undefined
  );

  if (!manifest.build) {
    throw new CliError(
      input.buildId
        ? `Build ${input.buildId} not found or has not succeeded.`
        : "No successful builds found for this project."
    );
  }

  return {
    manifest,
    buildId: manifest.build.id,
    version: manifest.build.version,
  };
}
