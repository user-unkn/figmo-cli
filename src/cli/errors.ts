/**
 * Typed error for CLI command failures.
 * Thrown instead of process.exit() so commands remain unit-testable.
 * The top-level entrypoint catches these and maps to exit codes.
 */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = "CliError";
  }
}
