import { z } from "zod";

// ----- Categories -----

export const TOKEN_CATEGORIES = [
  "color",
  "typography",
  "spacing",
  "radius",
  "shadow",
  "border",
  "opacity",
  "z-index",
  "breakpoint",
] as const;

export type TokenCategory = (typeof TOKEN_CATEGORIES)[number];

// ----- Value schemas per category -----

export const colorValueSchema = z.object({
  hex: z.string().regex(/^#[0-9a-fA-F]{6,8}$/),
  r: z.number().min(0).max(255),
  g: z.number().min(0).max(255),
  b: z.number().min(0).max(255),
  a: z.number().min(0).max(1),
  aliasOf: z.string().optional(),
  mode: z.string().optional(),
});

export const typographyValueSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number(),
  fontWeight: z.number(),
  lineHeight: z.union([z.number(), z.string()]),
  letterSpacing: z.number(),
});

export const spacingValueSchema = z.object({
  value: z.number(),
  unit: z.string().default("px"),
});

export const radiusValueSchema = z.object({
  topLeft: z.number().optional(),
  topRight: z.number().optional(),
  bottomRight: z.number().optional(),
  bottomLeft: z.number().optional(),
  value: z.number().optional(),
  unit: z.string().default("px"),
});

export const shadowValueSchema = z.object({
  shadows: z.array(
    z.object({
      type: z.enum(["dropShadow", "innerShadow"]),
      color: z.object({
        hex: z.string(),
        r: z.number(),
        g: z.number(),
        b: z.number(),
        a: z.number(),
      }),
      offsetX: z.number(),
      offsetY: z.number(),
      blur: z.number(),
      spread: z.number(),
    })
  ),
});

export const borderValueSchema = z.object({
  color: z
    .object({
      hex: z.string(),
      r: z.number(),
      g: z.number(),
      b: z.number(),
      a: z.number(),
    })
    .optional(),
  width: z.number().optional(),
  style: z.enum(["solid", "dashed", "dotted", "none"]).optional(),
});

export const opacityValueSchema = z.object({
  value: z.number().min(0).max(1),
});

export const zIndexValueSchema = z.object({
  value: z.number(),
});

export const breakpointValueSchema = z.object({
  value: z.number(),
  unit: z.string().default("px"),
});

// ----- Schema map -----

export const tokenValueSchemaMap: Record<TokenCategory, z.ZodType> = {
  color: colorValueSchema,
  typography: typographyValueSchema,
  spacing: spacingValueSchema,
  radius: radiusValueSchema,
  shadow: shadowValueSchema,
  border: borderValueSchema,
  opacity: opacityValueSchema,
  "z-index": zIndexValueSchema,
  breakpoint: breakpointValueSchema,
};

// ----- Canonical types -----

export interface CanonicalToken {
  name: string;
  category: TokenCategory;
  value: unknown;
  resolvedValue?: unknown;
  figmaSourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface TokenDiffEntry {
  name: string;
  category: TokenCategory;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface TokenDiff {
  added: TokenDiffEntry[];
  removed: TokenDiffEntry[];
  changed: TokenDiffEntry[];
}
