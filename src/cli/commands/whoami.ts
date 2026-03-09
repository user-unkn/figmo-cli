import { createTokenStore } from "../auth/token-store";
import type { TokenStore } from "../auth/types";

export interface WhoamiDeps {
  tokenStore?: TokenStore;
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function whoamiCommand(deps: WhoamiDeps = {}): Promise<void> {
  const tokenStore = deps.tokenStore ?? createTokenStore();
  const credential = await tokenStore.load();

  if (!credential) {
    process.stdout.write('Not logged in. Run "figmo login" to authenticate.\n');
    return;
  }

  const payload = decodePayload(credential.accessToken);
  if (!payload) {
    process.stdout.write("Stored credential is invalid. Please log in again.\n");
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const expired = typeof payload.exp === "number" && payload.exp <= now;

  process.stdout.write(`User:   ${payload.sub ?? "unknown"}\n`);
  process.stdout.write(`Org:    ${payload.org ?? "unknown"}\n`);
  process.stdout.write(`Role:   ${payload.role ?? "unknown"}\n`);
  if (expired) {
    process.stdout.write("Status: session expired (will refresh on next command)\n");
  } else {
    process.stdout.write("Status: authenticated\n");
  }
}
