import type { TokenDiff, TokenDiffEntry } from "@/lib/tokens/types";
import type { ComponentDiff, ComponentDiffEntry } from "@/lib/components/types";

export interface DiffSummarySection<T> {
  added: T[];
  removed: T[];
  changed: T[];
  totalChanges: number;
}

export interface TokenSummaryEntry {
  name: string;
  category: string;
}

export interface ComponentSummaryEntry {
  name: string;
  canonicalKey: string;
  changes: string[];
}

export interface DiffSummary {
  localBuildId: string;
  localVersion: string;
  remoteBuildId: string;
  remoteVersion: string;
  tokens: DiffSummarySection<TokenSummaryEntry>;
  components: DiffSummarySection<ComponentSummaryEntry>;
  hasChanges: boolean;
}

function toTokenSummary(entries: TokenDiffEntry[]): TokenSummaryEntry[] {
  return entries.map((e) => ({ name: e.name, category: e.category }));
}

function toComponentSummary(entries: ComponentDiffEntry[]): ComponentSummaryEntry[] {
  return entries.map((e) => ({
    name: e.name,
    canonicalKey: e.canonicalKey,
    changes: e.changes ?? [],
  }));
}

function makeSection<TIn, TOut>(
  diff: { added: TIn[]; removed: TIn[]; changed: TIn[] },
  mapper: (items: TIn[]) => TOut[]
): DiffSummarySection<TOut> {
  const added = mapper(diff.added);
  const removed = mapper(diff.removed);
  const changed = mapper(diff.changed);
  return {
    added,
    removed,
    changed,
    totalChanges: added.length + removed.length + changed.length,
  };
}

export interface SummarizeDiffInput {
  localBuildId: string;
  localVersion: string;
  remoteBuildId: string;
  remoteVersion: string;
  tokenDiff: TokenDiff;
  componentDiff: ComponentDiff;
}

/**
 * Build a pure, deterministic DiffSummary from raw diff data.
 * No side effects — suitable for both human and JSON rendering.
 */
export function summarizeDiff(input: SummarizeDiffInput): DiffSummary {
  const tokens = makeSection(input.tokenDiff, toTokenSummary);
  const components = makeSection(input.componentDiff, toComponentSummary);

  return {
    localBuildId: input.localBuildId,
    localVersion: input.localVersion,
    remoteBuildId: input.remoteBuildId,
    remoteVersion: input.remoteVersion,
    tokens,
    components,
    hasChanges: tokens.totalChanges > 0 || components.totalChanges > 0,
  };
}
