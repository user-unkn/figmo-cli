import { join, dirname } from "node:path";
import { readFileSync, existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { findConfigPath, readConfig, readLockfile } from "../config";
import { CliError } from "../errors";

export async function packCommand(): Promise<void> {
  const configPath = findConfigPath();
  if (!configPath) {
    throw new CliError('No designsystem.config.json found. Run "figmo init" first.');
  }

  const configDir = dirname(configPath);
  const config = readConfig(configPath);
  const lock = readLockfile(configDir);
  const outDir = join(configDir, config.outDir);

  if (!existsSync(outDir)) {
    throw new CliError(`Output directory "${config.outDir}" does not exist. Run "figmo pull" first.`);
  }

  // Validate package.json exists
  const pkgJsonPath = join(outDir, "package.json");
  if (!existsSync(pkgJsonPath)) {
    throw new CliError(`No package.json found in ${config.outDir}/. Run "figmo pull" first.`);
  }

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));

  // Validate exports map
  const exports = pkgJson.exports ?? {};
  const exportPaths = Object.entries(exports) as Array<
    [string, string | Record<string, string>]
  >;
  const errors: string[] = [];
  let resolvedCount = 0;
  let targetCount = 0;

  for (const [subpath, targets] of exportPaths) {
    // Handle shorthand string exports (e.g. ".": "./index.js")
    if (typeof targets === "string") {
      targetCount++;
      const targetPath = join(outDir, targets);
      if (!existsSync(targetPath)) {
        errors.push(`Export "${subpath}" target "${targets}" not found`);
      } else {
        resolvedCount++;
      }
      continue;
    }

    // Handle condition map exports (e.g. { import: "./index.ts", types: "./index.d.ts" })
    for (const [condition, target] of Object.entries(targets)) {
      targetCount++;
      if (typeof target !== "string") continue;
      const targetPath = join(outDir, target);
      if (!existsSync(targetPath)) {
        errors.push(
          `Export "${subpath}" condition "${condition}" target "${target}" not found`
        );
      } else {
        resolvedCount++;
      }
    }
  }

  // Count files and total size
  const files = collectFiles(outDir);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  // Print summary
  process.stdout.write(`Package: ${pkgJson.name}\n`);
  process.stdout.write(`Version: ${pkgJson.version}\n`);
  if (lock) {
    process.stdout.write(`Build:   ${lock.version} (${lock.buildId.slice(0, 8)})\n`);
  }
  process.stdout.write(`\n`);
  process.stdout.write(`Files:   ${files.length}\n`);
  process.stdout.write(`Size:    ${formatBytes(totalSize)}\n`);
  process.stdout.write(`Exports: ${exportPaths.length} subpaths, ${targetCount} targets (${resolvedCount} resolved)\n`);
  process.stdout.write(`\n`);

  // List files
  process.stdout.write("Contents:\n");
  for (const f of files) {
    const rel = f.path.slice(outDir.length + 1);
    process.stdout.write(`  ${padRight(rel, 40)} ${formatBytes(f.size)}\n`);
  }

  // Report errors
  if (errors.length > 0) {
    const errorList = errors.map((e) => `  ${e}`).join("\n");
    throw new CliError(`Package validation failed (${errors.length} error(s)):\n${errorList}`);
  }

  process.stdout.write(`\nPackage is valid. Ready for consumption.\n`);
}

interface FileInfo {
  path: string;
  size: number;
}

function collectFiles(dir: string, opts?: { maxDepth?: number }): FileInfo[] {
  const maxDepth = opts?.maxDepth ?? 64;
  const results: FileInfo[] = [];
  const pending: Array<{ path: string; depth: number }> = [
    { path: dir, depth: 0 },
  ];
  const visitedDirs = new Set<string>();

  while (pending.length > 0) {
    const next = pending.pop();
    if (!next) break;

    if (next.depth > maxDepth) {
      throw new CliError(
        `Package traversal exceeded max depth (${maxDepth}). Possible cycle or unexpectedly deep tree at: ${next.path}`
      );
    }

    let canonicalDir: string;
    try {
      canonicalDir = realpathSync(next.path);
    } catch {
      canonicalDir = next.path;
    }
    if (visitedDirs.has(canonicalDir)) continue;
    visitedDirs.add(canonicalDir);

    const entries = readdirSync(next.path, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // skip hidden files
      const full = join(next.path, entry.name);

      let stat;
      try {
        stat = lstatSync(full);
      } catch {
        continue;
      }

      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        pending.push({ path: full, depth: next.depth + 1 });
        continue;
      }
      if (stat.isFile()) {
        results.push({ path: full, size: stat.size });
      }
    }
  }

  return results.sort((a, b) => a.path.localeCompare(b.path));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}
