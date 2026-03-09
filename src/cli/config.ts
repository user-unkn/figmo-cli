import { z } from "zod";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, dirname, isAbsolute, normalize } from "node:path";

export const CONFIG_FILENAME = "designsystem.config.json";
export const LOCK_FILENAME = "designsystem.lock";

// ----- Zod schemas -----

const configSchema = z.object({
  org: z.string().min(1),
  project: z.string().min(1),
  apiUrl: z.string().url(),
  outDir: z
    .string()
    .min(1)
    .refine(
      (p) => !isAbsolute(p) && !normalize(p).split("/").includes(".."),
      "outDir must be a relative path without '..' segments"
    ),
  installationId: z.string().uuid().optional(),
  label: z.string().min(1).optional(),
});

const lockfileSchema = z.object({
  buildId: z.string().uuid(),
  version: z.string(),
  pulledAt: z.string(),
  tokenCount: z.number().int().nonnegative(),
  componentCount: z.number().int().nonnegative(),
  checksums: z.record(z.string(), z.string()),
});

// ----- Types -----

export type FigmoConfig = z.infer<typeof configSchema>;
export type FigmoLockfile = z.infer<typeof lockfileSchema>;

/** Walk up from `from` looking for the config file. */
export function findConfigPath(from: string = process.cwd()): string | null {
  let dir = resolve(from);
  for (;;) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function readConfig(path: string): FigmoConfig {
  const raw = readFileSync(path, "utf-8");
  return configSchema.parse(JSON.parse(raw));
}

export function writeConfig(dir: string, config: FigmoConfig): string {
  const path = join(dir, CONFIG_FILENAME);
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
  return path;
}

export function readLockfile(dir: string): FigmoLockfile | null {
  const path = join(dir, LOCK_FILENAME);
  if (!existsSync(path)) return null;
  return lockfileSchema.parse(JSON.parse(readFileSync(path, "utf-8")));
}

export function writeLockfile(dir: string, lock: FigmoLockfile): string {
  const path = join(dir, LOCK_FILENAME);
  writeFileSync(path, JSON.stringify(lock, null, 2) + "\n");
  return path;
}

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
