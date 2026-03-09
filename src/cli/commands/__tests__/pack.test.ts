import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { packCommand } from "../pack";
import { CONFIG_FILENAME, LOCK_FILENAME } from "../../config";
import { CliError } from "../../errors";

describe("packCommand", () => {
  let dir: string;
  let previousCwd: string;

  beforeEach(() => {
    previousCwd = process.cwd();
    dir = mkdtempSync(join(tmpdir(), "figmo-pack-"));

    writeFileSync(
      join(dir, CONFIG_FILENAME),
      JSON.stringify(
        {
          org: "acme",
          project: "design-system",
          apiUrl: "https://app.figmo.dev",
          outDir: "designsystem",
        },
        null,
        2
      ) + "\n"
    );
    writeFileSync(
      join(dir, LOCK_FILENAME),
      JSON.stringify(
        {
          buildId: "abcd1234-5678-4012-a456-789012345678",
          version: "abcd1234",
          pulledAt: "2026-02-10T00:00:00.000Z",
          tokenCount: 0,
          componentCount: 0,
          checksums: {},
        },
        null,
        2
      ) + "\n"
    );

    const outDir = join(dir, "designsystem");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, "package.json"),
      JSON.stringify(
        {
          name: "@acme/design-system-ui",
          version: "0.0.1",
          exports: {
            ".": { import: "./index.js", types: "./index.d.ts" },
          },
        },
        null,
        2
      ) + "\n"
    );
    writeFileSync(join(outDir, "index.js"), "export {};\n");
    writeFileSync(join(outDir, "index.d.ts"), "export {};\n");
    writeFileSync(join(outDir, "tokens.json"), "{}\n");

    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("skips symlinks while traversing package contents", async () => {
    const outDir = join(dir, "designsystem");
    symlinkSync(outDir, join(outDir, "loop"));

    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await expect(packCommand()).resolves.toBeUndefined();
    expect(stdoutSpy).not.toHaveBeenCalledWith(expect.stringContaining("loop"));
    stdoutSpy.mockRestore();
  });

  it("throws when traversal exceeds max depth", async () => {
    const outDir = join(dir, "designsystem");
    let current = outDir;
    for (let i = 0; i < 70; i++) {
      current = join(current, `d${i}`);
      mkdirSync(current);
    }
    writeFileSync(join(current, "deep.txt"), "x\n");

    await expect(packCommand()).rejects.toBeInstanceOf(CliError);
  });
});

