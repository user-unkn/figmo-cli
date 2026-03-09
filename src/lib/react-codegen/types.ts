export interface ReactComponentArtifact {
  type: string;
  key: string;
  content: string;
  contentType: string;
}

export interface SnapshotMetadata {
  canonicalKey: string;
  name: string;
  variants: Array<{ label: string; props: Record<string, string | boolean> }>;
  dimensions: { width: number; height: number };
  status: "pending";
}

export interface SnapshotArtifact {
  type: string;
  key: string;
  content: string;
  contentType: string;
}
