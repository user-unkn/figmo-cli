import type { FigmoConfig } from "./config";
import { createTokenStore } from "./auth/token-store";
import { getValidToken } from "./auth/client";

export async function reportEvent(input: {
  config: FigmoConfig;
  buildId: string;
  version: string;
  eventType: "pull" | "update";
}): Promise<void> {
  const { config, buildId, version, eventType } = input;

  if (!config.installationId) {
    return;
  }

  try {
    const url = `${config.apiUrl}/api/v1/projects/${config.org}--${config.project}/installations/events`;

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
        eventType,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Never throw — event recording is best-effort
  }
}
