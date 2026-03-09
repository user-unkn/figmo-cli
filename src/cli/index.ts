import { parseArgs } from "node:util";
import { initCommand } from "./commands/init";
import { pullCommand } from "./commands/pull";
import { diffCommand } from "./commands/diff";
import { packCommand } from "./commands/pack";
import { loginCommand } from "./commands/login";
import { logoutCommand } from "./commands/logout";
import { whoamiCommand } from "./commands/whoami";
import { updateCommand } from "./commands/update";
import { validateCommand } from "./commands/validate";
import { CliError } from "./errors";

const USAGE = `figmo — Design system package lifecycle CLI

Usage:
  figmo login    [--api-url <url>]
  figmo logout
  figmo whoami
  figmo init     --org <org> --project <project> [--api-url <url>] [--out-dir <dir>]
  figmo pull     [--build-id <id>]
  figmo update   [--build-id <id>]
  figmo diff     [--exit-code] [--json]
  figmo validate [--exit-code] [--json]
  figmo pack

Commands:
  login      Authenticate with the Figmo platform via browser
  logout     Clear stored credentials
  whoami     Display current authenticated identity
  init       Configure project and create designsystem.config.json
  pull       Download latest build artifacts to local output directory
  update     Update to latest or specified build with diff preview
  diff       Compare local version against latest remote build
  validate   Scan for hardcoded style values and token violations
  pack       Validate the local package and display summary

Options:
  --help     Show this help message

Examples:
  figmo login
  figmo init --org acme --project design-system
  figmo pull
  figmo diff --exit-code
  figmo validate --exit-code
  figmo pack
`;

async function main(): Promise<void> {
  const command = process.argv[2];

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    process.exit(command ? 0 : 1);
  }

  // Slice off node, script, and command from argv for flag parsing
  const args = process.argv.slice(3);

  switch (command) {
    case "login": {
      const { values } = parseArgs({
        args,
        options: {
          "api-url": { type: "string" },
        },
        strict: true,
      });
      await loginCommand({
        apiUrl: values["api-url"] ?? "https://figmo-user-unkn.vercel.app",
      });
      break;
    }

    case "logout": {
      parseArgs({ args, options: {}, strict: true });
      await logoutCommand();
      break;
    }

    case "whoami": {
      parseArgs({ args, options: {}, strict: true });
      await whoamiCommand();
      break;
    }

    case "init": {
      const { values } = parseArgs({
        args,
        options: {
          org: { type: "string" },
          project: { type: "string" },
          "api-url": { type: "string" },
          "out-dir": { type: "string" },
        },
        strict: true,
      });
      if (!values.org || !values.project) {
        throw new CliError("--org and --project are required for init.");
      }
      await initCommand({
        org: values.org,
        project: values.project,
        apiUrl: values["api-url"],
        outDir: values["out-dir"],
      });
      break;
    }

    case "pull": {
      const { values } = parseArgs({
        args,
        options: {
          "build-id": { type: "string" },
        },
        strict: true,
      });
      await pullCommand({ buildId: values["build-id"] });
      break;
    }

    case "update": {
      const { values } = parseArgs({
        args,
        options: {
          "build-id": { type: "string" },
        },
        strict: true,
      });
      await updateCommand({ buildId: values["build-id"] });
      break;
    }

    case "diff": {
      const { values } = parseArgs({
        args,
        options: {
          "exit-code": { type: "boolean", default: false },
          json: { type: "boolean", default: false },
        },
        strict: true,
      });
      await diffCommand({ exitCode: values["exit-code"], json: values.json });
      break;
    }

    case "validate": {
      const { values } = parseArgs({
        args,
        options: {
          "exit-code": { type: "boolean", default: false },
          json: { type: "boolean", default: false },
        },
        strict: true,
      });
      await validateCommand({
        "exit-code": values["exit-code"],
        json: values.json,
      });
      break;
    }

    case "pack": {
      parseArgs({ args, options: {}, strict: true });
      await packCommand();
      break;
    }

    default:
      process.stdout.write(USAGE);
      throw new CliError(`Unknown command: ${command}`);
  }
}

main().catch((err) => {
  if (err instanceof CliError) {
    if (err.message) process.stderr.write(`Error: ${err.message}\n`);
    process.exit(err.exitCode);
  }
  process.stderr.write(
    `Fatal: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
