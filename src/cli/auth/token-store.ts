import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir, hostname } from "node:os";
import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { storedCredentialSchema } from "./schemas";
import type { StoredCredential, TokenStore } from "./types";

const SERVICE = "dev.figmo.cli";
const ACCOUNT = "default";
const FALLBACK_DIR = join(homedir(), ".figmo");
const FALLBACK_PATH = join(FALLBACK_DIR, "credentials.enc");
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// --- V2 fallback encryption (PBKDF2 + per-file random salt) ---
const FALLBACK_MAGIC = Buffer.from("FGC2"); // "Figmo Credentials v2"
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100_000;

/**
 * Legacy key derivation (v1): deterministic from hostname + homedir.
 * Kept for backward-compatible decryption of old credential files.
 */
function deriveFallbackKeyLegacy(): Buffer {
  const identity = `${hostname()}:${homedir()}`;
  return createHash("sha256").update(identity).digest();
}

/**
 * V2 key derivation: PBKDF2-SHA256 with a random salt mixed with machine identity.
 * The salt is random per-encryption, so the key is non-deterministic.
 * Machine identity is mixed in so the file is bound to this machine.
 */
function deriveFallbackKeyV2(salt: Buffer): Buffer {
  const identity = `${hostname()}:${homedir()}`;
  return pbkdf2Sync(identity, salt, PBKDF2_ITERATIONS, 32, "sha256");
}

/**
 * Encrypt with v2 format: MAGIC (4) + salt (32) + iv (12) + authTag (16) + ciphertext.
 */
function encryptFallback(data: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveFallbackKeyV2(salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([FALLBACK_MAGIC, salt, iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt credential file, supporting both v2 (salted PBKDF2) and legacy (unsalted SHA-256) formats.
 */
function decryptFallback(encoded: string): string {
  const combined = Buffer.from(encoded, "base64");

  // Check for v2 magic header
  if (
    combined.length >= FALLBACK_MAGIC.length + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH &&
    combined.subarray(0, FALLBACK_MAGIC.length).equals(FALLBACK_MAGIC)
  ) {
    const offset = FALLBACK_MAGIC.length;
    const salt = combined.subarray(offset, offset + SALT_LENGTH);
    const iv = combined.subarray(offset + SALT_LENGTH, offset + SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      offset + SALT_LENGTH + IV_LENGTH,
      offset + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const ciphertext = combined.subarray(offset + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const key = deriveFallbackKeyV2(salt);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }

  // Legacy v1 format: iv (12) + authTag (16) + ciphertext
  const key = deriveFallbackKeyLegacy();
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function tryExec(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

function tryExecVoid(cmd: string, args: string[]): boolean {
  try {
    execFileSync(cmd, args, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ----- macOS Keychain -----

function macLoad(): string | null {
  return tryExec("security", [
    "find-generic-password",
    "-s", SERVICE,
    "-a", ACCOUNT,
    "-w",
  ]);
}

function macSave(value: string): boolean {
  // Delete first to avoid "already exists" error
  tryExecVoid("security", [
    "delete-generic-password",
    "-s", SERVICE,
    "-a", ACCOUNT,
  ]);
  return tryExecVoid("security", [
    "add-generic-password",
    "-s", SERVICE,
    "-a", ACCOUNT,
    "-w", value,
    "-U",
  ]);
}

function macDelete(): boolean {
  return tryExecVoid("security", [
    "delete-generic-password",
    "-s", SERVICE,
    "-a", ACCOUNT,
  ]);
}

// ----- Linux secret-tool -----

function linuxLoad(): string | null {
  return tryExec("secret-tool", ["lookup", "service", SERVICE, "account", ACCOUNT]);
}

function linuxSave(value: string): boolean {
  try {
    execFileSync("secret-tool", [
      "store",
      "--label", `${SERVICE} credentials`,
      "service", SERVICE,
      "account", ACCOUNT,
    ], { input: value, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function linuxDelete(): boolean {
  return tryExecVoid("secret-tool", ["clear", "service", SERVICE, "account", ACCOUNT]);
}

// ----- Fallback (encrypted file) -----

function fallbackLoad(): string | null {
  if (!existsSync(FALLBACK_PATH)) return null;
  try {
    const encoded = readFileSync(FALLBACK_PATH, "utf8");
    return decryptFallback(encoded);
  } catch {
    return null;
  }
}

function fallbackSave(value: string): void {
  if (!existsSync(FALLBACK_DIR)) {
    mkdirSync(FALLBACK_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(FALLBACK_PATH, encryptFallback(value), { mode: 0o600 });
}

function fallbackDelete(): void {
  if (existsSync(FALLBACK_PATH)) {
    unlinkSync(FALLBACK_PATH);
  }
}

// ----- Factory -----

export function createTokenStore(
  warnFallback?: (msg: string) => void
): TokenStore {
  const platform = process.platform;

  return {
    async load(): Promise<StoredCredential | null> {
      let raw: string | null = null;

      if (platform === "darwin") {
        raw = macLoad();
      } else if (platform === "linux") {
        raw = linuxLoad();
      }

      if (raw === null) {
        raw = fallbackLoad();
      }

      if (raw === null) return null;

      try {
        const parsed = JSON.parse(raw);
        const result = storedCredentialSchema.safeParse(parsed);
        return result.success ? result.data as StoredCredential : null;
      } catch {
        return null;
      }
    },

    async save(credential: StoredCredential): Promise<void> {
      const value = JSON.stringify(credential);
      let saved = false;

      if (platform === "darwin") {
        saved = macSave(value);
      } else if (platform === "linux") {
        saved = linuxSave(value);
      }

      if (!saved) {
        warnFallback?.(
          "System keychain unavailable — credentials stored in encrypted file at ~/.figmo/credentials.enc"
        );
        fallbackSave(value);
      }
    },

    async clear(): Promise<void> {
      if (platform === "darwin") {
        macDelete();
      } else if (platform === "linux") {
        linuxDelete();
      }
      fallbackDelete();
    },
  };
}
