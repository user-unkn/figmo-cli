import { z } from "zod";
import type { CanonicalToken } from "@/lib/tokens/types";
import { componentSpecSchema } from "@/lib/components/types";
import type { ComponentSpec } from "@/lib/components/types";

// ----- Zod schemas for incoming manifest JSON -----

const tokenCategoryEnum = z.enum([
  "color", "typography", "spacing", "radius", "shadow",
  "border", "opacity", "z-index", "breakpoint",
]);

const manifestTokenSchema = z.object({
  name: z.string(),
  category: tokenCategoryEnum,
  type: z.string(),
  value: z.unknown(),
  cssVariable: z.string(),
  cssValue: z.string(),
  constName: z.string(),
  usage: z.object({ css: z.string(), ts: z.string() }),
});

const manifestBuildSchema = z.object({
  id: z.string().uuid(),
  version: z.string(),
  lastUpdated: z.string(),
  tokenCount: z.number(),
  componentCount: z.number(),
  diff: z.unknown().nullable(),
});

const manifestComponentSchema = z.object({
  name: z.string(),
  canonicalKey: z.string(),
  spec: z.record(z.string(), z.unknown()),
});

const manifestSchema = z.object({
  $schema: z.string().optional(),
  project: z.object({
    name: z.string(),
    slug: z.string(),
    organization: z.string(),
    description: z.string().nullable(),
  }),
  build: manifestBuildSchema.nullable(),
  tokens: z.array(manifestTokenSchema),
  components: z.array(manifestComponentSchema),
  installation: z.record(z.string(),
    z.object({ description: z.string(), code: z.string() })
  ),
});

// ----- Schema-derived types (single source of truth) -----

/** Full parsed manifest from a Figmo project build. */
export type Manifest = z.infer<typeof manifestSchema>;
export type ManifestToken = z.infer<typeof manifestTokenSchema>;
export type ManifestBuild = z.infer<typeof manifestBuildSchema>;
export type ManifestComponent = z.infer<typeof manifestComponentSchema>;
export type ManifestProject = Manifest["project"];

/** Parse and validate a manifest JSON object through the Zod schema. */
export function parseManifest(json: unknown): Manifest {
  return manifestSchema.parse(json);
}

export interface FetchManifestOptions {
  buildId?: string;
  token?: string;
}

/** Fetch the public manifest for a project, optionally pinned to a specific build. */
export async function fetchManifest(
  apiUrl: string,
  org: string,
  project: string,
  opts?: FetchManifestOptions
): Promise<Manifest> {
  const base = `${apiUrl}/api/v1/projects/${encodeURIComponent(org)}--${encodeURIComponent(project)}/manifest.json`;
  const url = opts?.buildId ? `${base}?buildId=${encodeURIComponent(opts.buildId)}` : base;

  const headers: Record<string, string> = {};
  if (opts?.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch manifest (${res.status}): ${body}`);
  }
  const json = await res.json();
  return parseManifest(json);
}

/** Convert manifest tokens to CanonicalToken[] for use with transform functions. */
export function manifestTokensToCanonical(tokens: ManifestToken[]): CanonicalToken[] {
  return tokens.map((t) => ({
    name: t.name,
    category: t.category,
    value: t.value,
  }));
}

/** Convert manifest components to ComponentSpec[] with Zod validation. */
export function manifestComponentsToSpecs(components: ManifestComponent[]): ComponentSpec[] {
  return components.map((c) => componentSpecSchema.parse(c.spec));
}
