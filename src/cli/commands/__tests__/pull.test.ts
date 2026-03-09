import { describe, it, expect, vi, beforeEach } from "vitest";
import { CliError } from "../../errors";

vi.mock("../../config");
vi.mock("../../manifest");
vi.mock("../../update/apply", () => ({
  applyManifest: vi.fn(),
}));
vi.mock("../../report-installation", () => ({
  reportInstallation: vi.fn(),
}));
vi.mock("../../report-event", () => ({
  reportEvent: vi.fn(),
}));

const { pullCommand } = await import("../pull");
const config = await import("../../config");
const manifest = await import("../../manifest");
const apply = await import("../../update/apply");
const reportInstallationMod = await import("../../report-installation");
const reportEventMod = await import("../../report-event");

describe("pullCommand", () => {
  const mockFindConfigPath = vi.mocked(config.findConfigPath);
  const mockReadConfig = vi.mocked(config.readConfig);
  const mockFetchManifest = vi.mocked(manifest.fetchManifest);
  const mockApplyManifest = vi.mocked(apply.applyManifest);
  const mockReportInstallation = vi.mocked(reportInstallationMod.reportInstallation);
  const mockReportEvent = vi.mocked(reportEventMod.reportEvent);

  beforeEach(() => {
    vi.clearAllMocks();

    mockReportInstallation.mockResolvedValue(undefined);
    mockReportEvent.mockResolvedValue(undefined);

    mockFindConfigPath.mockReturnValue("/tmp/designsystem.config.json");
    mockReadConfig.mockReturnValue({
      org: "acme",
      project: "design-system",
      apiUrl: "https://app.figmo.dev",
      outDir: "designsystem",
    });
  });

  it("throws if no config found", async () => {
    mockFindConfigPath.mockReturnValue(null);
    await expect(pullCommand({})).rejects.toBeInstanceOf(CliError);
  });

  it("throws when no successful build exists", async () => {
    mockFetchManifest.mockResolvedValue({
      project: { name: "x", organization: "y", slug: "s", description: null },
      build: null,
      tokens: [],
      components: [],
      installation: {},
    } as never);

    await expect(pullCommand({})).rejects.toBeInstanceOf(CliError);
  });

  it("applies manifest and reports heartbeat on success", async () => {
    mockFetchManifest.mockResolvedValue({
      project: { name: "x", organization: "y", slug: "s", description: null },
      build: {
        id: "abcd1234-5678-4012-a456-789012345678",
        version: "abcd1234",
        lastUpdated: "2026-02-10T00:00:00.000Z",
        tokenCount: 0,
        componentCount: 0,
        diff: null,
      },
      tokens: [],
      components: [],
      installation: {},
    } as never);

    mockApplyManifest.mockReturnValue({
      fileCount: 3,
      tokenCount: 0,
      componentCount: 0,
    });

    await pullCommand({});

    expect(mockApplyManifest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        configDir: "/tmp",
        outDir: "/tmp/designsystem",
        org: "acme",
        project: "design-system",
      })
    );

    expect(mockReportInstallation).toHaveBeenCalled();
    expect(mockReportEvent).toHaveBeenCalled();
  });
});

