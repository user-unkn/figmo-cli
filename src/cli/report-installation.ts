import type { FigmoConfig } from "./config";
import { createTokenStore } from "./auth/token-store";
import { getValidToken } from "./auth/client";

export async function reportInstallation(input: {
  config: FigmoConfig;
  buildId: string;
  version: string;
}): Promise<void> {
  const { config, buildId, version } = input;

  // Skip silently if legacy config without installationId/label
  if (!config.installationId || !config.label) {
    return;
  }

  try {
    const url = `${config.apiUrl}/api/v1/projects/${config.org}--${config.project}/installations/heartbeat`;

    // Best-effort auth token
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    try {
      const tokenStore = createTokenStore();
      const token = await getValidToken(tokenStore, config.apiUrl);
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {
      // Continue without auth
    }

    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        installationId: config.installationId,
        buildId,
        version,
        label: config.label,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Never throw — heartbeat is best-effort
  }
}
