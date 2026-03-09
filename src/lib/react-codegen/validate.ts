export interface StyleViolation {
  line: number;
  column: number;
  code: string;
  message: string;
  snippet: string;
}

const COMMON_FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Times",
  "Courier New",
  "Courier",
  "Verdana",
  "Georgia",
  "Palatino",
  "Garamond",
  "Trebuchet MS",
  "Comic Sans MS",
  "Impact",
  "Tahoma",
  "Geneva",
  "Lucida",
  "Segoe UI",
  "Roboto",
  "Open Sans",
  "Inter",
  "San Francisco",
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
];

const NAMED_CSS_COLORS = [
  "red", "blue", "green", "yellow", "orange", "purple", "pink",
  "black", "white", "gray", "grey", "cyan", "magenta", "lime",
  "teal", "navy", "maroon", "olive", "aqua", "fuchsia", "silver",
  "coral", "salmon", "tomato", "crimson", "indigo", "violet",
  "turquoise", "sienna", "khaki", "orchid", "plum", "beige",
  "ivory", "linen", "lavender", "gold", "wheat", "chocolate",
];

/** Check if a line is inside a comment or a CSS var() context. */
function isInCssVarContext(line: string, matchIndex: number): boolean {
  // Check if the match is inside a var() reference
  const before = line.slice(0, matchIndex);
  return /var\(\s*--[^)]*$/.test(before);
}

/** Check if a line is a comment line. */
function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

/** Scan generated TSX source for hardcoded style values. */
export function validateNoHardcodedStyles(code: string): StyleViolation[] {
  const violations: StyleViolation[] = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comment lines
    if (isCommentLine(line)) continue;

    // Detect hex color literals (not inside var() or data attributes)
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
    let match: RegExpExecArray | null;
    while ((match = hexPattern.exec(line)) !== null) {
      if (!isInCssVarContext(line, match.index)) {
        violations.push({
          line: lineNum,
          column: match.index + 1,
          code: "HARDCODED_HEX",
          message: `Hardcoded hex color "${match[0]}" found. Use a CSS custom property (var(--token-name)) instead.`,
          snippet: line.trim(),
        });
      }
    }

    // Detect rgb()/rgba()/hsl()/hsla() literals
    const colorFuncPattern = /\b(rgba?|hsla?)\s*\(/g;
    while ((match = colorFuncPattern.exec(line)) !== null) {
      if (!isInCssVarContext(line, match.index)) {
        violations.push({
          line: lineNum,
          column: match.index + 1,
          code: "HARDCODED_COLOR_FUNC",
          message: `Hardcoded color function "${match[1]}()" found. Use a CSS custom property instead.`,
          snippet: line.trim(),
        });
      }
    }

    // Detect hardcoded px values in style contexts
    const styleContextPattern = /style\s*[=:{]/i;
    const pxInStylePattern = /\d+px/g;
    if (styleContextPattern.test(line)) {
      while ((match = pxInStylePattern.exec(line)) !== null) {
        violations.push({
          line: lineNum,
          column: match.index + 1,
          code: "HARDCODED_PX",
          message: `Hardcoded px value found in style context. Use a CSS custom property instead.`,
          snippet: line.trim(),
        });
      }
    }

    // Detect font-family literals
    const fontFamilyPattern = /font-?[Ff]amily\s*[:=]\s*["']?([^"';},]+)/g;
    while ((match = fontFamilyPattern.exec(line)) !== null) {
      const familyValue = match[1].trim();
      // Allow var() references
      if (familyValue.startsWith("var(")) continue;
      const matchesKnownFont = COMMON_FONT_FAMILIES.some(
        (f) => familyValue.toLowerCase().includes(f.toLowerCase())
      );
      if (matchesKnownFont) {
        violations.push({
          line: lineNum,
          column: match.index + 1,
          code: "HARDCODED_FONT",
          message: `Hardcoded font-family "${familyValue}" found. Use a CSS custom property instead.`,
          snippet: line.trim(),
        });
      }
    }

    // Detect named CSS colors in style contexts
    if (styleContextPattern.test(line)) {
      for (const color of NAMED_CSS_COLORS) {
        const namedColorPattern = new RegExp(
          `color\\s*:\\s*${color}\\b`,
          "gi"
        );
        while ((match = namedColorPattern.exec(line)) !== null) {
          violations.push({
            line: lineNum,
            column: match.index + 1,
            code: "HARDCODED_NAMED_COLOR",
            message: `Hardcoded named color "${color}" found. Use a CSS custom property instead.`,
            snippet: line.trim(),
          });
        }
      }
    }
  }

  return violations;
}

/** Validate and throw if hardcoded styles are found. */
export function assertNoHardcodedStyles(code: string): void {
  const violations = validateNoHardcodedStyles(code);
  if (violations.length > 0) {
    const messages = violations.map(
      (v) => `  Line ${v.line}:${v.column} [${v.code}] ${v.message}\n    ${v.snippet}`
    );
    throw new Error(
      `Found ${violations.length} hardcoded style violation(s):\n${messages.join("\n")}`
    );
  }
}
