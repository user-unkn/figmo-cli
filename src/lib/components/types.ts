import { z } from "zod";

// ----- Well-known constants -----

export const WELL_KNOWN_STATES = [
  "default",
  "hover",
  "pressed",
  "focused",
  "disabled",
  "active",
  "selected",
  "error",
  "loading",
] as const;

export const WELL_KNOWN_SIZES = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
] as const;

// ----- Zod schemas -----

export const variantAxisSchema = z.object({
  name: z.string(),
  values: z.array(z.string()),
  defaultValue: z.string(),
});

export const booleanPropSchema = z.object({
  name: z.string(),
  defaultValue: z.boolean(),
});

export const textPropSchema = z.object({
  name: z.string(),
  defaultValue: z.string(),
});

export const slotSchema = z.object({
  name: z.string(),
  preferredValues: z
    .array(z.object({ type: z.string(), key: z.string() }))
    .optional(),
});

export const EXTRACTION_WARNING_CODES = [
  "FALLBACK_INFERENCE",
  "AMBIGUOUS_COMPONENT",
  "MISSING_VARIANT_AXIS",
  "UNPARSEABLE_VARIANT_NAME",
] as const;

export type ExtractionWarningCode = (typeof EXTRACTION_WARNING_CODES)[number];

export const extractionWarningSchema = z.object({
  code: z.enum(EXTRACTION_WARNING_CODES),
  message: z.string(),
  nodeId: z.string().optional(),
  nodeName: z.string().optional(),
});

export const componentSpecSchema = z.object({
  name: z.string(),
  canonicalKey: z.string(),
  figmaSourceId: z.string(),
  source: z.enum(["COMPONENT_SET", "FRAME_INFERENCE"]),
  variantAxes: z.array(variantAxisSchema),
  props: z.object({
    boolean: z.array(booleanPropSchema),
    text: z.array(textPropSchema),
  }),
  slots: z.array(slotSchema),
  states: z.array(z.string()),
  sizes: z.array(z.string()),
  variantCount: z.number(),
  warnings: z.array(extractionWarningSchema),
});

export const componentsManifestSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  componentCount: z.number(),
  components: z.array(componentSpecSchema),
});

// ----- Inferred TypeScript types -----

export type VariantAxis = z.infer<typeof variantAxisSchema>;
export type BooleanProp = z.infer<typeof booleanPropSchema>;
export type TextProp = z.infer<typeof textPropSchema>;
export type Slot = z.infer<typeof slotSchema>;
export type ExtractionWarning = z.infer<typeof extractionWarningSchema>;
export type ComponentSpec = z.infer<typeof componentSpecSchema>;
export type ComponentsManifest = z.infer<typeof componentsManifestSchema>;

// ----- Component diff types -----

export interface ComponentDiffEntry {
  canonicalKey: string;
  name: string;
  oldSpec?: ComponentSpec;
  newSpec?: ComponentSpec;
  changes?: string[];
}

export interface ComponentDiff {
  added: ComponentDiffEntry[];
  removed: ComponentDiffEntry[];
  changed: ComponentDiffEntry[];
}
