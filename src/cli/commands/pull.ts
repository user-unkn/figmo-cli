import { join, dirname } from "node:path";
import {
  findConfigPath,
  readConfig,
} from "../config";
import { fetchManifest } from "../manifest";
import { applyManifest } from "../update/apply";
import { CliError } from "../errors";
import { reportInstallation } from "../report-installation";
import { reportEvent } from "../report-event";

export interface PullOptions {
  buildId?: string;
}

export async function pullCommand(opts: PullOptions): Promise<void> {
  const configPath = findConfigPath();
  if (!configPath) {
    throw new CliError('No designsystem.config.json found. Run "figmo init" first.');
  }

  const configDir = dirname(configPath);
  const config = readConfig(configPath);
  const outDir = join(configDir, config.outDir);

  const pinnedLabel = opts.buildId
    ? `build ${opts.buildId.slice(0, 8)}`
    : "latest build";
  process.stdout.write(
    `Fetching ${pinnedLabel} for ${config.org}/${config.project}...\n`
  );

  const manifest = await fetchManifest(
    config.apiUrl,
    config.org,
    config.project,
    opts.buildId ? { buildId: opts.buildId } : undefined
  );

  if (!manifest.build) {
    throw new CliError(
      opts.buildId
        ? `Build ${opts.buildId} not found or has not succeeded.`
        : "No successful builds found for this project."
    );
  }

  process.stdout.write("Generating package files...\n");

  const result = applyManifest(manifest, {
    outDir,
    configDir,
    org: config.org,
    project: config.project,
  });

  process.stdout.write(`\nPulled build ${manifest.build.version}\n`);
  process.stdout.write(
    `  ${result.tokenCount} tokens, ${result.componentCount} components\n`
  );
  process.stdout.write(`  ${result.fileCount} files written to ${config.outDir}/\n`);
  process.stdout.write(`  Lockfile updated\n`);

  // Fire-and-forget heartbeat
  reportInstallation({ config, buildId: manifest.build!.id, version: manifest.build!.version }).catch(() => {});
  reportEvent({ config, buildId: manifest.build!.id, version: manifest.build!.version, eventType: "pull" }).catch(() => {});
}
