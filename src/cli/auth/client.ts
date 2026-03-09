import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { URL } from "node:url";
import { callbackParamsSchema } from "./schemas";
import { CliError } from "../errors";
import type { StoredCredential, TokenStore, IO } from "./types";

const AUTH_TIMEOUT_MS = 120_000;
const REFRESH_BUFFER_S = 5 * 60; // refresh if <5 min left

export async function startAuthFlow(
  apiUrl: string,
  io: IO
): Promise<StoredCredential> {
  const state = randomBytes(32).toString("hex");

  return new Promise<StoredCredential>((resolve, reject) => {
    let settled = false;

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      fn();
    }

    const server = createServer((req, res) => {
      if (!req.url?.startsWith("/callback")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const method = (req.method ?? "GET").toUpperCase();

      // Backwards compatibility: accept query-string tokens (old flow).
      if (method === "GET") {
        try {
          const url = new URL(req.url, `http://127.0.0.1`);
          const params = Object.fromEntries(url.searchParams);

          if (Object.keys(params).length > 0) {
            const parsed = callbackParamsSchema.safeParse(params);
            if (!parsed.success) {
              res.writeHead(400);
              res.end("Invalid callback parameters");
              settle(() =>
                reject(new CliError("Invalid callback parameters from server"))
              );
              server.close();
              return;
            }

            if (parsed.data.state !== state) {
              res.writeHead(400);
              res.end("State mismatch");
              settle(() =>
                reject(new CliError("State mismatch — possible CSRF attack"))
              );
              server.close();
              return;
            }

            const credential: StoredCredential = {
              schemaVersion: 1,
              accessToken: parsed.data.access_token,
              refreshToken: parsed.data.refresh_token,
              expiresAt: parsed.data.expires_at,
            };

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(
              "<html><body><h2>Login successful!</h2><p>You can close this tab.</p></body></html>"
            );
            settle(() => resolve(credential));
            server.close();
            return;
          }

          // New flow: tokens are delivered in the URL fragment (hash), which is
          // not sent to the server. Serve a small page that posts the fragment
          // payload back to this same endpoint.
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Figmo CLI Login</title></head>
  <body style="font-family: system-ui, sans-serif; padding: 24px;">
    <h2>Completing login…</h2>
    <p>You can close this tab once it says “Login successful”.</p>
    <script>
      (async function () {
        try {
          const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
          const params = Object.fromEntries(new URLSearchParams(hash));
          const res = await fetch("/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          });
          if (!res.ok) {
            document.body.innerHTML = "<h2>Login failed</h2><p>Invalid callback parameters.</p>";
            return;
          }
          document.body.innerHTML = "<h2>Login successful!</h2><p>You can close this tab.</p>";
        } catch (e) {
          document.body.innerHTML = "<h2>Login failed</h2><p>Unexpected error.</p>";
        }
      })();
    </script>
  </body>
</html>`);
        } catch (err) {
          res.writeHead(500);
          res.end("Internal error");
          settle(() => reject(err));
          server.close();
        }
        return;
      }

      if (method !== "POST") {
        res.writeHead(405);
        res.end("Method not allowed");
        return;
      }

      // POST /callback: accept JSON body from the fragment relay page.
      let raw = "";
      req.on("data", (chunk) => {
        raw += String(chunk);
      });
      req.on("end", () => {
        try {
          const body = JSON.parse(raw || "{}");
          const parsed = callbackParamsSchema.safeParse(body);

          if (!parsed.success) {
            res.writeHead(400);
            res.end("Invalid callback parameters");
            settle(() =>
              reject(new CliError("Invalid callback parameters from server"))
            );
            server.close();
            return;
          }

          if (parsed.data.state !== state) {
            res.writeHead(400);
            res.end("State mismatch");
            settle(() =>
              reject(new CliError("State mismatch — possible CSRF attack"))
            );
            server.close();
            return;
          }

          const credential: StoredCredential = {
            schemaVersion: 1,
            accessToken: parsed.data.access_token,
            refreshToken: parsed.data.refresh_token,
            expiresAt: parsed.data.expires_at,
          };

          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("OK");
          settle(() => resolve(credential));
          server.close();
        } catch (err) {
          res.writeHead(500);
          res.end("Internal error");
          settle(() => reject(err));
          server.close();
        }
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        settle(() => reject(new CliError("Failed to start local auth server")));
        return;
      }

      const port = addr.port;
      const authorizeUrl = `${apiUrl}/cli/authorize?port=${port}&state=${state}`;
      io.write(`Opening browser for authentication...\n`);
      io.openBrowser(authorizeUrl).catch(() => {
        io.write(`Could not open browser. Visit this URL manually:\n  ${authorizeUrl}\n`);
      });
    });

    const timeout = setTimeout(() => {
      server.close();
      settle(() => reject(new CliError("Login timed out after 120 seconds")));
    }, AUTH_TIMEOUT_MS);

    server.on("close", () => clearTimeout(timeout));
  });
}

export async function refreshTokens(
  apiUrl: string,
  refreshToken: string
): Promise<StoredCredential> {
  const res = await fetch(`${apiUrl}/api/auth/cli/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new CliError(`Token refresh failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  return json.data as StoredCredential;
}

export async function getValidToken(
  tokenStore: TokenStore,
  apiUrl: string
): Promise<string | null> {
  const credential = await tokenStore.load();
  if (!credential) return null;

  const now = Math.floor(Date.now() / 1000);

  // Token still valid with buffer
  if (credential.expiresAt > now + REFRESH_BUFFER_S) {
    return credential.accessToken;
  }

  // Try refresh
  try {
    const refreshed = await refreshTokens(apiUrl, credential.refreshToken);
    await tokenStore.save(refreshed);
    return refreshed.accessToken;
  } catch {
    return null;
  }
}
