import type { ComponentSpec, ComponentDiff, ComponentDiffEntry } from "./types";

/** Compute human-readable list of what changed between two specs. */
function describeChanges(oldSpec: ComponentSpec, newSpec: ComponentSpec): string[] {
  const changes: string[] = [];

  // Compare variant axes
  const oldAxes = JSON.stringify(oldSpec.variantAxes);
  const newAxes = JSON.stringify(newSpec.variantAxes);
  if (oldAxes !== newAxes) {
    changes.push("variantAxes modified");
  }

  // Compare boolean props
  const oldBool = JSON.stringify(oldSpec.props.boolean);
  const newBool = JSON.stringify(newSpec.props.boolean);
  if (oldBool !== newBool) {
    const oldNames = new Set(oldSpec.props.boolean.map((p) => p.name));
    const newNames = new Set(newSpec.props.boolean.map((p) => p.name));
    for (const n of newNames) {
      if (!oldNames.has(n)) changes.push(`props.boolean "${n}" added`);
    }
    for (const n of oldNames) {
      if (!newNames.has(n)) changes.push(`props.boolean "${n}" removed`);
    }
    for (const np of newSpec.props.boolean) {
      const op = oldSpec.props.boolean.find((p) => p.name === np.name);
      if (op && JSON.stringify(op) !== JSON.stringify(np)) {
        changes.push(`props.boolean "${np.name}" changed`);
      }
    }
  }

  // Compare text props
  const oldText = JSON.stringify(oldSpec.props.text);
  const newText = JSON.stringify(newSpec.props.text);
  if (oldText !== newText) {
    const oldNames = new Set(oldSpec.props.text.map((p) => p.name));
    const newNames = new Set(newSpec.props.text.map((p) => p.name));
    for (const n of newNames) {
      if (!oldNames.has(n)) changes.push(`props.text "${n}" added`);
    }
    for (const n of oldNames) {
      if (!newNames.has(n)) changes.push(`props.text "${n}" removed`);
    }
    for (const np of newSpec.props.text) {
      const op = oldSpec.props.text.find((p) => p.name === np.name);
      if (op && JSON.stringify(op) !== JSON.stringify(np)) {
        changes.push(`props.text "${np.name}" changed`);
      }
    }
  }

  // Compare slots
  const oldSlots = JSON.stringify(oldSpec.slots);
  const newSlots = JSON.stringify(newSpec.slots);
  if (oldSlots !== newSlots) {
    changes.push("slots modified");
  }

  // Compare states
  if (JSON.stringify(oldSpec.states) !== JSON.stringify(newSpec.states)) {
    changes.push("states changed");
  }

  // Compare sizes
  if (JSON.stringify(oldSpec.sizes) !== JSON.stringify(newSpec.sizes)) {
    changes.push("sizes changed");
  }

  // Compare source
  if (oldSpec.source !== newSpec.source) {
    changes.push("source changed");
  }

  return changes.sort();
}

/** Strip ephemeral fields (warnings) before comparison. */
function specForComparison(spec: ComponentSpec): Omit<ComponentSpec, "warnings"> {
  const { warnings, ...rest } = spec;
  return rest;
}

/** Compare two ComponentSpec arrays and produce a diff. */
export function computeComponentDiff(
  previous: ComponentSpec[],
  current: ComponentSpec[]
): ComponentDiff {
  const prevMap = new Map(previous.map((c) => [c.canonicalKey, c]));
  const currMap = new Map(current.map((c) => [c.canonicalKey, c]));

  const added: ComponentDiffEntry[] = [];
  const removed: ComponentDiffEntry[] = [];
  const changed: ComponentDiffEntry[] = [];

  // Find added and changed
  for (const [key, spec] of currMap) {
    const prev = prevMap.get(key);
    if (!prev) {
      added.push({ canonicalKey: key, name: spec.name, newSpec: spec });
    } else if (
      JSON.stringify(specForComparison(prev)) !==
      JSON.stringify(specForComparison(spec))
    ) {
      changed.push({
        canonicalKey: key,
        name: spec.name,
        oldSpec: prev,
        newSpec: spec,
        changes: describeChanges(prev, spec),
      });
    }
  }

  // Find removed
  for (const [key, spec] of prevMap) {
    if (!currMap.has(key)) {
      removed.push({ canonicalKey: key, name: spec.name, oldSpec: spec });
    }
  }

  // Sort each array by canonicalKey for determinism
  added.sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));
  removed.sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));
  changed.sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));

  return { added, removed, changed };
}
