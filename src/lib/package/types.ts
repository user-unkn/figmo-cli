export interface PackageArtifact {
  type: string;
  key: string;
  content: string;
  contentType: string;
}

export interface PackageConfig {
  orgScope: string;
  projectSlug: string;
  version: string;
  buildId: string;
}
