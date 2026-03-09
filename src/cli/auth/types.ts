export interface StoredCredential {
  schemaVersion: 1;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in seconds
}

export interface TokenStore {
  load(): Promise<StoredCredential | null>;
  save(credential: StoredCredential): Promise<void>;
  clear(): Promise<void>;
}

export interface IO {
  write(msg: string): void;
  writeError(msg: string): void;
  openBrowser(url: string): Promise<void>;
}
