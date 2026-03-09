import { createTokenStore } from "../auth/token-store";
import type { TokenStore } from "../auth/types";

export interface LogoutDeps {
  tokenStore?: TokenStore;
}

export async function logoutCommand(deps: LogoutDeps = {}): Promise<void> {
  const tokenStore = deps.tokenStore ?? createTokenStore();
  await tokenStore.clear();
  process.stdout.write("Logged out.\n");
}
