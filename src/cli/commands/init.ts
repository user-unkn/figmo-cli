import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, basename } from "node:path";
import { writeConfig, CONFIG_FILENAME } from "../config";
import { fetchManifest } from "../manifest";
import type { FigmoConfig } from "../config";
import { CliError } from "../errors";

export interface InitOptions {
  org: string;
  project: string;
  apiUrl?: string;
  outDir?: string;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  const config: FigmoConfig = {
    org: opts.org,
    project: opts.project,
    apiUrl: opts.apiUrl ?? "https://app.figmo.dev",
    outDir: opts.outDir ?? "./design-system",
    installationId: randomUUID(),
    label: basename(process.cwd()),
  };

  // Check if config already exists
  const existing = join(process.cwd(), CONFIG_FILENAME);
  if (existsSync(existing)) {
    process.stderr.write(`Warning: ${CONFIG_FILENAME} already exists and will be overwritten.\n\n`);
  }

  // Validate by fetching manifest
  process.stdout.write(`Validating project ${config.org}/${config.project}...\n`);
  try {
    const manifest = await fetchManifest(config.apiUrl, config.org, config.project);
    process.stdout.write(`  Project: ${manifest.project.name}\n`);
    process.stdout.write(`  Organization: ${manifest.project.organization}\n`);
    if (manifest.build) {
      process.stdout.write(
        `  Latest build: ${manifest.build.version} (${manifest.build.tokenCount} tokens, ${manifest.build.componentCount} components)\n`
      );
    } else {
      process.stdout.write(`  No builds yet\n`);
    }
  } catch (err) {
    throw new CliError(
      `Could not validate project. ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const path = writeConfig(process.cwd(), config);
  process.stdout.write(`\nWrote ${CONFIG_FILENAME} to ${path}\n`);
  process.stdout.write(`Run "figmo pull" to download design system artifacts.\n`);
}
