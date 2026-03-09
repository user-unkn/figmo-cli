import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateCommand } from "../validate";
import { CliError } from "../../errors";
import * as config from "../../config";
import * as reactCodegen from "@/lib/react-codegen/validate";
import { readFile, readdir } from "node:fs/promises";

vi.mock("../../config");
vi.mock("@/lib/react-codegen/validate");
vi.mock("node:fs/promises");

describe("validateCommand", () => {
  const mockFindConfigPath = vi.mocked(config.findConfigPath);
  const mockReadConfig = vi.mocked(config.readConfig);
  const mockReadLockfile = vi.mocked(config.readLockfile);
  const mockValidateNoHardcodedStyles = vi.mocked(reactCodegen.validateNoHardcodedStyles);
  const mockReadFile = vi.mocked(readFile);
  const mockReaddir = vi.mocked(readdir);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful path
    mockFindConfigPath.mockReturnValue("/test/designsystem.config.json");
    mockReadConfig.mockReturnValue({
      org: "test-org",
      project: "test-project",
      outDir: "designsystem",
      apiUrl: "https://api.test.com",
    });
    mockReadLockfile.mockReturnValue({
      buildId: "build-123",
      version: "1.0.0",
      pulledAt: new Date().toISOString(),
      tokenCount: 10,
      componentCount: 5,
      checksums: { tokens: "abc", components: "def" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw if config file not found", async () => {
    mockFindConfigPath.mockReturnValue(null);

    await expect(validateCommand({})).rejects.toThrow(CliError);
    await expect(validateCommand({})).rejects.toThrow('No designsystem.config.json found');
  });

  it("should throw if lockfile not found", async () => {
    mockReadLockfile.mockReturnValue(null);

    await expect(validateCommand({})).rejects.toThrow(CliError);
    await expect(validateCommand({})).rejects.toThrow('No lockfile found');
  });

  it("should pass validation when no violations found", async () => {
    mockReaddir.mockResolvedValue([
      "Button.tsx",
      "Card.tsx",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    mockReadFile.mockResolvedValue("const Component = () => <div>Valid</div>");
    mockValidateNoHardcodedStyles.mockReturnValue([]);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await validateCommand({});

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("✅ Validation passed"));
    consoleSpy.mockRestore();
  });

  it("should detect hardcoded style violations", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockReaddir.mockResolvedValue(["Button.tsx"] as any);
    mockReadFile.mockResolvedValue('const Component = () => <div style={{ color: "#ff0000" }}>Bad</div>');
    mockValidateNoHardcodedStyles.mockReturnValue([
      {
        line: 1,
        column: 45,
        code: "HARDCODED_HEX",
        message: "Hardcoded hex color detected",
        snippet: 'color: "#ff0000"',
      },
    ]);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(validateCommand({})).rejects.toThrow(CliError);
    await expect(validateCommand({})).rejects.toThrow("Validation failed");

    consoleSpy.mockRestore();
  });

  it("should output JSON when --json flag is used", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockReaddir.mockResolvedValue(["Button.tsx"] as any);
    mockReadFile.mockResolvedValue("valid code");
    mockValidateNoHardcodedStyles.mockReturnValue([]);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await validateCommand({ json: true });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\{[\s\S]*"hardcodedStyles"[\s\S]*\}$/)
    );
    consoleSpy.mockRestore();
  });

  it("should throw CliError with exitCode 1 when --exit-code flag is used with violations", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockReaddir.mockResolvedValue(["Button.tsx"] as any);
    mockReadFile.mockResolvedValue("bad code");
    mockValidateNoHardcodedStyles.mockReturnValue([
      {
        line: 1,
        column: 1,
        code: "HARDCODED_HEX",
        message: "Bad",
        snippet: "snippet",
      },
    ]);

    // Replaced process.exit() with CliError so the command is unit-testable
    await expect(validateCommand({ "exit-code": true })).rejects.toMatchObject({
      exitCode: 1,
      message: "", // empty — output was already printed; no redundant error line
    });
  });

  it("should handle missing react directory gracefully", async () => {
    const error = new Error("ENOENT") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    mockReaddir.mockRejectedValue(error);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await validateCommand({});

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("✅ Validation passed"));
    consoleSpy.mockRestore();
  });
});
