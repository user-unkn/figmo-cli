import { join, dirname } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { findConfigPath, readConfig, readLockfile } from "../config";
import {
  fetchManifest,
  parseManifest,
  manifestTokensToCanonical,
  manifestComponentsToSpecs,
} from "../manifest";
import type { Manifest } from "../manifest";
import { computeTokenDiff } from "@/lib/tokens/diff";
import { computeComponentDiff } from "@/lib/components/diff";
import { summarizeDiff } from "../diff/summary";
import { renderDiffText, renderDiffJson } from "../diff/render";
import { CliError } from "../errors";

export interface DiffOptions {
  exitCode?: boolean;
  json?: boolean;
}

export async function diffCommand(opts: DiffOptions): Promise<void> {
  const configPath = findConfigPath();
  if (!configPath) {
    throw new CliError('No designsystem.config.json found. Run "figmo init" first.');
  }

  const configDir = dirname(configPath);
  const config = readConfig(configPath);
  const lock = readLockfile(configDir);

  if (!lock) {
    throw new CliError('No lockfile found. Run "figmo pull" first.');
  }

  // Load local manifest snapshot if available
  const outDir = join(configDir, config.outDir);
  const localManifestPath = join(outDir, ".manifest.json");
  let localManifest: Manifest | null = null;
  if (existsSync(localManifestPath)) {
    try {
      localManifest = parseManifest(
        JSON.parse(readFileSync(localManifestPath, "utf-8"))
      );
    } catch {
      process.stderr.write(
        "Warning: Local .manifest.json is invalid, skipping detailed diff.\n"
      );
    }
  }

  if (!opts.json) {
    process.stdout.write(
      `Fetching latest manifest for ${config.org}/${config.project}...\n`
    );
  }
  const remoteManifest = await fetchManifest(
    config.apiUrl,
    config.org,
    config.project
  );

  if (!remoteManifest.build) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ upToDate: false, noBuild: true }) + "\n");
    } else {
      process.stdout.write("No builds available.\n");
    }
    return;
  }

  if (remoteManifest.build.id === lock.buildId) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ upToDate: true, version: lock.version }) + "\n");
    } else {
      process.stdout.write(`Up to date (build ${lock.version})\n`);
    }
    return;
  }

  // Compute detailed diff when local manifest is available
  if (localManifest) {
    const prevTokens = manifestTokensToCanonical(localManifest.tokens);
    const currTokens = manifestTokensToCanonical(remoteManifest.tokens);
    const tokenDiff = computeTokenDiff(prevTokens, currTokens);

    const prevSpecs = manifestComponentsToSpecs(localManifest.components);
    const currSpecs = manifestComponentsToSpecs(remoteManifest.components);
    const componentDiff = computeComponentDiff(prevSpecs, currSpecs);

    const summary = summarizeDiff({
      localBuildId: lock.buildId,
      localVersion: lock.version,
      remoteBuildId: remoteManifest.build.id,
      remoteVersion: remoteManifest.build.version,
      tokenDiff,
      componentDiff,
    });

    if (opts.json) {
      process.stdout.write(renderDiffJson(summary) + "\n");
    } else {
      process.stdout.write("\n" + renderDiffText(summary) + "\n");
    }
  } else {
    // Fallback: count-based comparison
    const tokenDelta = remoteManifest.tokens.length - lock.tokenCount;
    const componentDelta =
      remoteManifest.components.length - lock.componentCount;

    if (opts.json) {
      process.stdout.write(
        JSON.stringify({
          localBuildId: lock.buildId,
          localVersion: lock.version,
          remoteBuildId: remoteManifest.build.id,
          remoteVersion: remoteManifest.build.version,
          tokens: { delta: tokenDelta, localCount: lock.tokenCount },
          components: { delta: componentDelta, localCount: lock.componentCount },
        }, null, 2) + "\n"
      );
    } else {
      process.stdout.write(
        `\nLocal:  build ${lock.version} (${lock.buildId.slice(0, 8)})\n`
      );
      process.stdout.write(
        `Remote: build ${remoteManifest.build.version} (${remoteManifest.build.id.slice(0, 8)})\n\n`
      );

      process.stdout.write("Tokens:\n");
      if (tokenDelta > 0) {
        process.stdout.write(`  +${tokenDelta} token(s) added\n`);
      } else if (tokenDelta < 0) {
        process.stdout.write(`  ${tokenDelta} token(s) removed\n`);
      } else {
        process.stdout.write(
          `  Token count unchanged (${lock.tokenCount})\n`
        );
      }

      process.stdout.write("\nComponents:\n");
      if (componentDelta > 0) {
        process.stdout.write(`  +${componentDelta} component(s) added\n`);
      } else if (componentDelta < 0) {
        process.stdout.write(`  ${componentDelta} component(s) removed\n`);
      } else {
        process.stdout.write(
          `  Component count unchanged (${lock.componentCount})\n`
        );
      }
    }
  }

  if (!opts.json) {
    process.stdout.write(
      `\nRun "figmo pull" to update to build ${remoteManifest.build.version}.\n`
    );
  }

  if (opts.exitCode) {
    throw new CliError("Changes detected", 1);
  }
}
