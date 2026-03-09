import type { ComponentSpec } from "@/lib/components/types";
import type { ReactComponentArtifact } from "./types";

/** Convert a prop name to a valid JS identifier in camelCase. */
function toPropName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/** Convert a component name to PascalCase for use as a React component name. */
function toPascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

/** Convert an axis name to a data-attribute name. */
function toDataAttr(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-|-$/g, "");
}

/** Generate a React 18 + TypeScript component from a ComponentSpec. */
export function generateReactComponent(spec: ComponentSpec, _tokenNames?: string[]): string {
  const componentName = toPascalCase(spec.name);
  const lines: string[] = [];

  lines.push('import React from "react";');
  lines.push("");

  // --- Props interface ---
  lines.push(`export interface ${componentName}Props {`);

  // Variant axes → union string props (sorted)
  const sortedAxes = [...spec.variantAxes].sort((a, b) => a.name.localeCompare(b.name));
  for (const axis of sortedAxes) {
    const propName = toPropName(axis.name);
    const unionType = axis.values.map((v) => `"${v}"`).join(" | ");
    lines.push(`  /** Variant: ${axis.name} */`);
    lines.push(`  ${propName}?: ${unionType};`);
  }

  // Boolean props (sorted)
  const sortedBooleans = [...spec.props.boolean].sort((a, b) => a.name.localeCompare(b.name));
  for (const bp of sortedBooleans) {
    const propName = toPropName(bp.name);
    lines.push(`  /** Boolean prop */`);
    lines.push(`  ${propName}?: boolean;`);
  }

  // Text props (sorted)
  const sortedTexts = [...spec.props.text].sort((a, b) => a.name.localeCompare(b.name));
  for (const tp of sortedTexts) {
    const propName = toPropName(tp.name);
    lines.push(`  /** Text prop */`);
    lines.push(`  ${propName}?: string;`);
  }

  // Slots → ReactNode props (sorted)
  const sortedSlots = [...spec.slots].sort((a, b) => a.name.localeCompare(b.name));
  for (const slot of sortedSlots) {
    const propName = toPropName(slot.name) + "Slot";
    lines.push(`  /** Slot */`);
    lines.push(`  ${propName}?: React.ReactNode;`);
  }

  // Standard props
  lines.push(`  className?: string;`);
  lines.push(`  children?: React.ReactNode;`);
  lines.push(`}`);
  lines.push("");

  // --- Component ---
  lines.push(`export const ${componentName} = React.forwardRef<HTMLDivElement, ${componentName}Props>(`);
  lines.push(`  function ${componentName}(`);
  lines.push(`    {`);

  // Destructured props with defaults (sorted)
  for (const axis of sortedAxes) {
    const propName = toPropName(axis.name);
    lines.push(`      ${propName} = "${axis.defaultValue}",`);
  }
  for (const bp of sortedBooleans) {
    const propName = toPropName(bp.name);
    lines.push(`      ${propName} = ${bp.defaultValue},`);
  }
  for (const tp of sortedTexts) {
    const propName = toPropName(tp.name);
    lines.push(`      ${propName} = "${tp.defaultValue.replace(/"/g, '\\"')}",`);
  }
  for (const slot of sortedSlots) {
    const propName = toPropName(slot.name) + "Slot";
    lines.push(`      ${propName},`);
  }
  lines.push(`      className,`);
  lines.push(`      children,`);
  lines.push(`      ...rest`);
  lines.push(`    },`);
  lines.push(`    ref`);
  lines.push(`  ) {`);
  lines.push(`    return (`);
  lines.push(`      <div`);
  lines.push(`        ref={ref}`);
  lines.push(`        className={className}`);

  // data-* attributes for variant axes
  for (const axis of sortedAxes) {
    const propName = toPropName(axis.name);
    const dataName = toDataAttr(axis.name);
    lines.push(`        data-${dataName}={${propName}}`);
  }

  // data-* attributes for boolean props
  for (const bp of sortedBooleans) {
    const propName = toPropName(bp.name);
    const dataName = toDataAttr(bp.name);
    lines.push(`        data-${dataName}={${propName}}`);
  }

  lines.push(`        {...rest}`);
  lines.push(`      >`);

  // Render slots conditionally
  for (const bp of sortedBooleans) {
    const boolPropName = toPropName(bp.name);
    // Check if there's a matching slot (e.g., hasIcon -> icon)
    const relatedSlotName = bp.name.replace(/^has/, "").replace(/^[A-Z]/, (c) => c.toLowerCase());
    const matchingSlot = sortedSlots.find(
      (s) => s.name.toLowerCase() === relatedSlotName.toLowerCase()
    );
    if (matchingSlot) {
      const slotPropName = toPropName(matchingSlot.name) + "Slot";
      lines.push(`        {${boolPropName} && ${slotPropName}}`);
    }
  }

  // Render remaining slots that don't have boolean guards
  const guardedSlotNames = new Set<string>();
  for (const bp of sortedBooleans) {
    const relatedSlotName = bp.name.replace(/^has/, "").replace(/^[A-Z]/, (c) => c.toLowerCase());
    const matchingSlot = sortedSlots.find(
      (s) => s.name.toLowerCase() === relatedSlotName.toLowerCase()
    );
    if (matchingSlot) guardedSlotNames.add(matchingSlot.name);
  }
  for (const slot of sortedSlots) {
    if (!guardedSlotNames.has(slot.name)) {
      const slotPropName = toPropName(slot.name) + "Slot";
      lines.push(`        {${slotPropName}}`);
    }
  }

  // Children with text prop fallback
  if (sortedTexts.length > 0) {
    const firstText = toPropName(sortedTexts[0].name);
    lines.push(`        {children ?? ${firstText}}`);
  } else {
    lines.push(`        {children}`);
  }

  lines.push(`      </div>`);
  lines.push(`    );`);
  lines.push(`  }`);
  lines.push(`);`);
  lines.push("");

  return lines.join("\n");
}

/** Generate a barrel index.ts re-exporting all components. */
export function generateComponentIndex(specs: ComponentSpec[]): string {
  const sorted = [...specs].sort((a, b) =>
    a.canonicalKey.localeCompare(b.canonicalKey)
  );

  const lines: string[] = [];
  for (const spec of sorted) {
    lines.push(`export { ${toPascalCase(spec.name)} } from "./${spec.canonicalKey}";`);
    lines.push(`export type { ${toPascalCase(spec.name)}Props } from "./${spec.canonicalKey}";`);
  }
  lines.push("");

  return lines.join("\n");
}

/** Generate all React artifacts for a build. */
export function generateReactArtifacts(
  buildId: string,
  specs: ComponentSpec[],
  tokenNames?: string[]
): ReactComponentArtifact[] {
  const artifacts: ReactComponentArtifact[] = [];

  const sorted = [...specs].sort((a, b) =>
    a.canonicalKey.localeCompare(b.canonicalKey)
  );

  for (const spec of sorted) {
    const content = generateReactComponent(spec, tokenNames);
    artifacts.push({
      type: `react/${spec.canonicalKey}.tsx`,
      key: `builds/${buildId}/react/${spec.canonicalKey}.tsx`,
      content,
      contentType: "text/typescript",
    });
  }

  // Barrel index
  const indexContent = generateComponentIndex(sorted);
  artifacts.push({
    type: "react/index.ts",
    key: `builds/${buildId}/react/index.ts`,
    content: indexContent,
    contentType: "text/typescript",
  });

  return artifacts;
}
