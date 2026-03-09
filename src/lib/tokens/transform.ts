import type { CanonicalToken } from "./types";

// ----- Helpers -----

/** Convert dot-notation token name to CSS custom property name. */
function tokenNameToCssVar(name: string): string {
  return `--${name.replace(/\./g, "-")}`;
}

/** Convert dot-notation token name to camelCase const name. */
export function tokenNameToConstName(name: string): string {
  return name.replace(/[.\-]([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/** Convert a token value to a CSS-appropriate string. */
export function tokenToCssValue(token: CanonicalToken): string {
  const v = token.value as Record<string, unknown>;

  switch (token.category) {
    case "color":
      return String(v.hex ?? "#000000");

    case "typography": {
      // CSS shorthand isn't ideal — return font-size as primary value
      return `${v.fontWeight} ${v.fontSize}px/${v.lineHeight === "normal" ? "normal" : `${v.lineHeight}px`} ${v.fontFamily}`;
    }

    case "spacing":
    case "breakpoint":
      return `${v.value}${v.unit ?? "px"}`;

    case "radius":
      if (
        v.topLeft !== undefined ||
        v.topRight !== undefined ||
        v.bottomRight !== undefined ||
        v.bottomLeft !== undefined
      ) {
        return `${v.topLeft ?? 0}px ${v.topRight ?? 0}px ${v.bottomRight ?? 0}px ${v.bottomLeft ?? 0}px`;
      }
      return `${v.value ?? 0}${v.unit ?? "px"}`;

    case "shadow": {
      const shadows = v.shadows as Array<{
        type: string;
        color: { hex: string; a: number };
        offsetX: number;
        offsetY: number;
        blur: number;
        spread: number;
      }>;
      if (!shadows || shadows.length === 0) return "none";
      return shadows
        .map((s) => {
          const inset = s.type === "innerShadow" ? "inset " : "";
          return `${inset}${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread}px ${s.color.hex}`;
        })
        .join(", ");
    }

    case "border":
      return `${v.width ?? 1}px ${v.style ?? "solid"} ${(v.color as { hex?: string })?.hex ?? "currentColor"}`;

    case "opacity":
      return String(v.value ?? 1);

    case "z-index":
      return String(v.value ?? 0);

    default:
      return JSON.stringify(v);
  }
}

// ----- JSON output -----

export function generateTokensJson(tokens: CanonicalToken[]): string {
  const sorted = [...tokens].sort((a, b) => a.name.localeCompare(b.name));
  const output: Record<string, unknown> = {};

  for (const token of sorted) {
    output[token.name] = {
      category: token.category,
      value: token.value,
      ...(token.resolvedValue ? { resolvedValue: token.resolvedValue } : {}),
      ...(token.figmaSourceId ? { figmaSourceId: token.figmaSourceId } : {}),
    };
  }

  return JSON.stringify(output, null, 2) + "\n";
}

// ----- CSS output -----

export function generateTokensCss(tokens: CanonicalToken[]): string {
  const sorted = [...tokens].sort((a, b) => a.name.localeCompare(b.name));
  const lines: string[] = [":root {"];

  for (const token of sorted) {
    const varName = tokenNameToCssVar(token.name);
    const cssValue = tokenToCssValue(token);
    lines.push(`  ${varName}: ${cssValue};`);
  }

  lines.push("}");
  return lines.join("\n") + "\n";
}

// ----- TypeScript output -----

export function generateTokensTs(tokens: CanonicalToken[]): string {
  const sorted = [...tokens].sort((a, b) => a.name.localeCompare(b.name));
  const lines: string[] = [];

  for (const token of sorted) {
    const constName = tokenNameToConstName(token.name);
    const cssValue = tokenToCssValue(token);
    lines.push(`export const ${constName} = ${JSON.stringify(cssValue)};`);
  }

  return lines.join("\n") + "\n";
}
