import { z } from "zod";

export const storedCredentialSchema = z.object({
  schemaVersion: z.literal(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
});

export const callbackParamsSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_at: z.coerce.number(),
  state: z.string().min(1),
});
