import { findConfigPath, readConfig, readLockfile } from "../config";
import { validateNoHardcodedStyles } from "@/lib/react-codegen/validate";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { CliError } from "../errors";

interface ValidateOptions {
  json?: boolean;
  "exit-code"?: boolean;
}

interface ValidationResult {
  hardcodedStyles: {
    file: string;
    violations: Array<{
      line: number;
      column: number;
      code: string;
      message: string;
      snippet: string;
    }>;
  }[];
  summary: {
    totalViolations: number;
    filesWithViolations: number;
  };
}

/**
 * Validate command - Scans for hardcoded style values and token drift violations
 * CIR-69: ds validate hardcoded-value/token-drift scanner
 */
export async function validateCommand(options: ValidateOptions): Promise<void> {
  const configPath = findConfigPath();

  if (!configPath) {
    throw new CliError('No designsystem.config.json found. Run "figmo init" first.', 1);
  }

  const configDir = dirname(configPath);
  const config = readConfig(configPath);
  const lock = readLockfile(configDir);

  if (!lock) {
    throw new CliError('No lockfile found. Run "figmo pull" first.', 1);
  }

  const outDir = join(configDir, config.outDir);

  // Scan for hardcoded style violations
  const violations = await scanForHardcodedStyles(outDir);

  const result: ValidationResult = {
    hardcodedStyles: violations,
    summary: {
      totalViolations: violations.reduce(
        (sum, file) => sum + file.violations.length,
        0
      ),
      filesWithViolations: violations.length,
    },
  };

  // Output results
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printTextOutput(result);
  }

  // Exit with non-zero code if violations found (for CI integration).
  // Throw CliError instead of process.exit() so the command remains unit-testable.
  // When --exit-code is set the output was already printed; use an empty message
  // so the entrypoint does not emit a redundant "Error: " line.
  if (result.summary.totalViolations > 0) {
    const msg = options["exit-code"]
      ? "" // output already printed; just set exit code
      : "Validation failed: hardcoded style values detected";
    throw new CliError(msg, 1);
  }

  console.log("\n✅ Validation passed");
}

/**
 * Scan generated React component files for hardcoded style violations
 */
async function scanForHardcodedStyles(outDir: string): Promise<
  ValidationResult["hardcodedStyles"]
> {
  const reactDir = join(outDir, "react");
  const violations: ValidationResult["hardcodedStyles"] = [];

  try {
    const files = await readdir(reactDir);
    const tsxFiles = files.filter((f) => f.endsWith(".tsx"));

    for (const file of tsxFiles) {
      const filePath = join(reactDir, file);
      const content = await readFile(filePath, "utf-8");

      const fileViolations = validateNoHardcodedStyles(content);

      if (fileViolations.length > 0) {
        violations.push({
          file: `react/${file}`,
          violations: fileViolations.map((v) => ({
            line: v.line,
            column: v.column,
            code: v.code,
            message: v.message,
            snippet: v.snippet,
          })),
        });
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // No react directory - skip validation
      return [];
    }
    throw err;
  }

  return violations;
}

/**
 * Print human-readable validation output
 */
function printTextOutput(result: ValidationResult): void {
  console.log("\n🔍 Design System Validation Report\n");
  console.log("=".repeat(60));

  if (result.summary.totalViolations === 0) {
    console.log("\n✅ No violations found");
    return;
  }

  console.log(
    `\n❌ Found ${result.summary.totalViolations} violation(s) in ${result.summary.filesWithViolations} file(s)\n`
  );

  // Group violations by type
  const violationsByType = new Map<string, number>();
  for (const file of result.hardcodedStyles) {
    for (const violation of file.violations) {
      violationsByType.set(
        violation.code,
        (violationsByType.get(violation.code) || 0) + 1
      );
    }
  }

  console.log("Violation Summary:");
  for (const [code, count] of violationsByType.entries()) {
    console.log(`  • ${code}: ${count}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\nDetailed Violations:\n");

  for (const file of result.hardcodedStyles) {
    console.log(`📄 ${file.file}`);

    for (const violation of file.violations) {
      console.log(
        `  ${violation.line}:${violation.column} - ${violation.code}`
      );
      console.log(`    ${violation.message}`);
      console.log(`    ${violation.snippet.trim()}`);
      console.log();
    }
  }

  console.log("=".repeat(60));
  console.log(
    "\n💡 Tip: Use design tokens instead of hardcoded values for better maintainability"
  );
  console.log(
    "   Import from 'designsystem/tokens' and use CSS custom properties\n"
  );
}
