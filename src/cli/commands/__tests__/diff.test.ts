import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CliError } from "../../errors";
import { CONFIG_FILENAME, LOCK_FILENAME } from "../../config";

vi.mock("../../manifest", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../manifest")>();
  return {
    ...original,
    fetchManifest: vi.fn(),
  };
});

const { diffCommand } = await import("../diff");
const { fetchManifest } = await import("../../manifest");

describe("diffCommand", () => {
  let dir: string;
  let previousCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    previousCwd = process.cwd();
    dir = mkdtempSync(join(tmpdir(), "figmo-diff-"));
    mkdirSync(join(dir, "designsystem"), { recursive: true });

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
          tokenCount: 1,
          componentCount: 1,
          checksums: {},
        },
        null,
        2
      ) + "\n"
    );

    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns cleanly when up to date", async () => {
    vi.mocked(fetchManifest).mockResolvedValue({
      project: { name: "x", organization: "y", slug: "s", description: null },
      build: {
        id: "abcd1234-5678-4012-a456-789012345678",
        version: "abcd1234",
        lastUpdated: "2026-02-10T00:00:00.000Z",
        tokenCount: 1,
        componentCount: 1,
        diff: null,
      },
      tokens: [],
      components: [],
      installation: {},
    } as never);

    await expect(diffCommand({ exitCode: true, json: true })).resolves.toBeUndefined();
  });

  it("throws exit code 1 when changes detected and --exit-code is used", async () => {
    vi.mocked(fetchManifest).mockResolvedValue({
      project: { name: "x", organization: "y", slug: "s", description: null },
      build: {
        id: "bbbbbbbb-5678-4012-a456-789012345678",
        version: "bbbbbbbb",
        lastUpdated: "2026-02-10T00:00:00.000Z",
        tokenCount: 2,
        componentCount: 2,
        diff: null,
      },
      tokens: [{ name: "t", category: "color" } as never],
      components: [{ name: "c", canonicalKey: "c", spec: {} } as never],
      installation: {},
    } as never);

    await expect(diffCommand({ exitCode: true, json: true })).rejects.toMatchObject({
      name: "CliError",
      exitCode: 1,
    } satisfies Partial<CliError>);
  });
});

