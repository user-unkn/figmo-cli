import { createTokenStore } from "../auth/token-store";
import { startAuthFlow, getValidToken } from "../auth/client";
import type { TokenStore, IO } from "../auth/types";

export interface LoginOptions {
  apiUrl: string;
}

export interface LoginDeps {
  tokenStore?: TokenStore;
  io?: IO;
}

function defaultIO(): IO {
  return {
    write: (msg) => process.stdout.write(msg),
    writeError: (msg) => process.stderr.write(msg),
    openBrowser: async (url) => {
      const { exec } = await import("node:child_process");
      const cmd =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "start"
            : "xdg-open";
      exec(`${cmd} ${JSON.stringify(url)}`);
    },
  };
}

export async function loginCommand(
  opts: LoginOptions,
  deps: LoginDeps = {}
): Promise<void> {
  const io = deps.io ?? defaultIO();
  const tokenStore = deps.tokenStore ?? createTokenStore((msg) => io.writeError(`Warning: ${msg}\n`));

  // Check for existing valid session
  const existing = await getValidToken(tokenStore, opts.apiUrl);
  if (existing) {
    io.write("Already logged in.\n");
    return;
  }

  const credential = await startAuthFlow(opts.apiUrl, io);
  await tokenStore.save(credential);
  io.write("Login successful.\n");
}
