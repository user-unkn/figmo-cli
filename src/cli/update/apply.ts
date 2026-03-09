import { join, dirname, resolve } from "node:path";
import { writeFileSync } from "node:fs";
import {
  writeLockfile,
  ensureDir,
  sha256,
} from "../config";
import {
  manifestTokensToCanonical,
  manifestComponentsToSpecs,
} from "../manifest";
import type { Manifest } from "../manifest";
import {
  generateTokensCss,
  generateTokensTs,
  generateTokensJson,
} from "@/lib/tokens/transform";
import { generateReactArtifacts } from "@/lib/react-codegen/generator";
import { generatePackageArtifacts } from "@/lib/package/generate";

/**
 * Ensures a relative path does not escape the target directory.
 * Prevents path traversal attacks from malicious artifact keys.
 */
function assertContainedPath(outDir: string, relPath: string): void {
  const resolved = resolve(outDir, relPath);
  const normalizedOutDir = resolve(outDir);
  if (!resolved.startsWith(normalizedOutDir + "/") && resolved !== normalizedOutDir) {
    throw new Error(
      `Path traversal blocked: "${relPath}" resolves outside output directory`
    );
  }
}

export interface ApplyResult {
  fileCount: number;
  tokenCount: number;
  componentCount: number;
}

/**
 * Generate and write artifacts for a manifest build to disk.
 * Lockfile is written last — if any preceding step fails,
 * the lockfile remains unchanged (transactional guarantee).
 */
export function applyManifest(
  manifest: Manifest,
  opts: { outDir: string; configDir: string; org: string; project: string }
): ApplyResult {
  const build = manifest.build;
  if (!build) {
    throw new Error("Cannot apply manifest without a build");
  }

  const tokens = manifestTokensToCanonical(manifest.tokens);
  const specs = manifestComponentsToSpecs(manifest.components);

  const tokensCss = generateTokensCss(tokens);
  const tokensTs = generateTokensTs(tokens);
  const tokensJson = generateTokensJson(tokens);

  const reactArtifacts = generateReactArtifacts(build.id, specs);
  const reactIndex =
    reactArtifacts.find((a) => a.type === "react/index.ts")?.content ?? "";
  const reactComponentInputs = reactArtifacts
    .filter((a) => a.type !== "react/index.ts")
    .map((a) => ({
      canonicalKey: a.type.replace("react/", "").replace(".tsx", ""),
      content: a.content,
    }));

  const packageArtifacts = generatePackageArtifacts(
    build.id,
    opts.org,
    opts.project,
    specs,
    tokens.map((t) => t.name),
    {
      tokensCss,
      tokensTs,
      reactArtifacts: reactComponentInputs,
      reactIndex,
    }
  );

  // Write package artifacts to outDir
  ensureDir(opts.outDir);
  const checksums: Record<string, string> = {};
  const prefix = `builds/${build.id}/package/`;

  for (const artifact of packageArtifacts) {
    const relPath = artifact.key.startsWith(prefix)
      ? artifact.key.slice(prefix.length)
      : artifact.key;

    assertContainedPath(opts.outDir, relPath);

    const filePath = join(opts.outDir, relPath);
    ensureDir(dirname(filePath));
    writeFileSync(filePath, artifact.content);
    checksums[relPath] = sha256(artifact.content);
  }

  // Also write tokens.json
  writeFileSync(join(opts.outDir, "tokens.json"), tokensJson);
  checksums["tokens.json"] = sha256(tokensJson);

  // Save manifest snapshot for diff
  const manifestSnapshot = JSON.stringify(manifest, null, 2) + "\n";
  writeFileSync(join(opts.outDir, ".manifest.json"), manifestSnapshot);

  // Write lockfile last (transactional: only after all files succeed)
  writeLockfile(opts.configDir, {
    buildId: build.id,
    version: build.version,
    pulledAt: new Date().toISOString(),
    tokenCount: manifest.tokens.length,
    componentCount: manifest.components.length,
    checksums,
  });

  return {
    fileCount: Object.keys(checksums).length,
    tokenCount: manifest.tokens.length,
    componentCount: manifest.components.length,
  };
}
