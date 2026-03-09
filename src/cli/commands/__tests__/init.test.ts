import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CONFIG_FILENAME } from "../../config";
import { CliError } from "../../errors";

vi.mock("../../manifest", () => ({
  fetchManifest: vi.fn(),
}));

const { initCommand } = await import("../init");
const { fetchManifest } = await import("../../manifest");

describe("initCommand", () => {
  let dir: string;
  let previousCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    previousCwd = process.cwd();
    dir = mkdtempSync(join(tmpdir(), "figmo-init-"));
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes designsystem.config.json after manifest validation", async () => {
    vi.mocked(fetchManifest).mockResolvedValue({
      project: { name: "Design System", organization: "Acme" },
      build: null,
      tokens: [],
      components: [],
      installation: {},
    } as never);

    await initCommand({ org: "acme", project: "design-system", apiUrl: "https://app.figmo.dev" });

    const raw = readFileSync(join(dir, CONFIG_FILENAME), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.org).toBe("acme");
    expect(parsed.project).toBe("design-system");
    expect(parsed.apiUrl).toBe("https://app.figmo.dev");
    expect(typeof parsed.installationId).toBe("string");
  });

  it("warns when overwriting an existing config", async () => {
    vi.mocked(fetchManifest).mockResolvedValue({
      project: { name: "Design System", organization: "Acme" },
      build: null,
      tokens: [],
      components: [],
      installation: {},
    } as never);

    writeFileSync(join(dir, CONFIG_FILENAME), "{}\n");
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await initCommand({ org: "acme", project: "design-system" });

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("already exists and will be overwritten")
    );
    stderrSpy.mockRestore();
  });

  it("throws CliError when manifest validation fails", async () => {
    vi.mocked(fetchManifest).mockRejectedValue(new Error("nope"));

    await expect(initCommand({ org: "acme", project: "design-system" })).rejects.toBeInstanceOf(
      CliError
    );
  });
});

