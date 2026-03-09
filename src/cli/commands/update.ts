import { join, dirname } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import {
  findConfigPath,
  readConfig,
  readLockfile,
} from "../config";
import {
  parseManifest,
  manifestTokensToCanonical,
  manifestComponentsToSpecs,
} from "../manifest";
import type { Manifest } from "../manifest";
import { computeTokenDiff } from "@/lib/tokens/diff";
import { computeComponentDiff } from "@/lib/components/diff";
import { summarizeDiff } from "../diff/summary";
import { renderDiffText } from "../diff/render";
import { resolveTargetBuild } from "../update/resolve-target";
import { applyManifest } from "../update/apply";
import { CliError } from "../errors";
import { reportInstallation } from "../report-installation";
import { reportEvent } from "../report-event";

export interface UpdateOptions {
  buildId?: string;
}

export async function updateCommand(opts: UpdateOptions): Promise<void> {
  const configPath = findConfigPath();
  if (!configPath) {
    throw new CliError('No designsystem.config.json found. Run "figmo init" first.');
  }

  const configDir = dirname(configPath);
  const config = readConfig(configPath);
  const outDir = join(configDir, config.outDir);
  const lock = readLockfile(configDir);

  if (!lock) {
    throw new CliError('No lockfile found. Run "figmo pull" first.');
  }

  // Step 1: Resolve target build
  const label = opts.buildId
    ? `build ${opts.buildId.slice(0, 8)}`
    : "latest build";
  process.stdout.write(
    `Resolving ${label} for ${config.org}/${config.project}...\n`
  );

  const target = await resolveTargetBuild({
    apiUrl: config.apiUrl,
    org: config.org,
    project: config.project,
    buildId: opts.buildId,
  });

  // Step 2: Check if already at target
  if (target.buildId === lock.buildId) {
    process.stdout.write(`Already up to date (build ${lock.version})\n`);
    return;
  }

  // Step 3: Show diff preview
  const localManifestPath = join(outDir, ".manifest.json");
  let localManifest: Manifest | null = null;
  if (existsSync(localManifestPath)) {
    try {
      localManifest = parseManifest(
        JSON.parse(readFileSync(localManifestPath, "utf-8"))
      );
    } catch {
      // Skip detailed diff on corrupt manifest
    }
  }

  if (localManifest) {
    const prevTokens = manifestTokensToCanonical(localManifest.tokens);
    const currTokens = manifestTokensToCanonical(target.manifest.tokens);
    const tokenDiff = computeTokenDiff(prevTokens, currTokens);

    const prevSpecs = manifestComponentsToSpecs(localManifest.components);
    const currSpecs = manifestComponentsToSpecs(target.manifest.components);
    const componentDiff = computeComponentDiff(prevSpecs, currSpecs);

    const summary = summarizeDiff({
      localBuildId: lock.buildId,
      localVersion: lock.version,
      remoteBuildId: target.buildId,
      remoteVersion: target.version,
      tokenDiff,
      componentDiff,
    });

    process.stdout.write("\n" + renderDiffText(summary) + "\n\n");
  } else {
    process.stdout.write(
      `\nUpdating from build ${lock.version} to ${target.version}\n\n`
    );
  }

  // Step 4: Apply artifacts (transactional — lockfile written last)
  process.stdout.write("Applying update...\n");

  const result = applyManifest(target.manifest, {
    outDir,
    configDir,
    org: config.org,
    project: config.project,
  });

  process.stdout.write(`\nUpdated to build ${target.version}\n`);
  process.stdout.write(
    `  ${result.tokenCount} tokens, ${result.componentCount} components\n`
  );
  process.stdout.write(`  ${result.fileCount} files written to ${config.outDir}/\n`);
  process.stdout.write(`  Lockfile updated\n`);

  // Fire-and-forget heartbeat
  reportInstallation({ config, buildId: target.buildId, version: target.version }).catch(() => {});
  reportEvent({ config, buildId: target.buildId, version: target.version, eventType: "update" }).catch(() => {});
}
