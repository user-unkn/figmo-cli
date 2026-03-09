import type { ComponentSpec } from "@/lib/components/types";
import type { PackageArtifact, PackageConfig } from "./types";

/**
 * Content inputs required to produce a self-contained package.
 * The pipeline must pass the generated token and React content so the
 * package directory contains every file referenced by its exports map.
 */
export interface PackageContentInputs {
  tokensCss: string;
  tokensTs: string;
  reactArtifacts: Array<{
    canonicalKey: string;
    content: string;
  }>;
  reactIndex: string;
}

/**
 * Generate package.json with exports map, peer deps, and typed entry points.
 * All export paths are relative to the package root (./), making the
 * package directory self-contained.
 */
export function generatePackageJson(
  config: PackageConfig,
  specs: ComponentSpec[],
  tokenCount: number
): string {
  const sorted = [...specs].sort((a, b) =>
    a.canonicalKey.localeCompare(b.canonicalKey)
  );

  const exports: Record<string, Record<string, string>> = {
    ".": {
      import: "./index.ts",
      types: "./index.d.ts",
    },
    "./tokens": {
      import: "./tokens/index.ts",
    },
    "./tokens.css": {
      import: "./tokens.css",
    },
  };

  for (const spec of sorted) {
    exports[`./components/${spec.canonicalKey}`] = {
      import: `./react/${spec.canonicalKey}.tsx`,
    };
  }

  const pkg = {
    name: `@${config.orgScope}/${config.projectSlug}-ui`,
    version: config.version,
    type: "module",
    main: "./index.ts",
    types: "./index.d.ts",
    exports,
    peerDependencies: {
      react: "^18.0.0 || ^19.0.0",
      "react-dom": "^18.0.0 || ^19.0.0",
    },
    metadata: {
      buildId: config.buildId,
      componentCount: sorted.length,
      tokenCount,
      generatedAt: new Date().toISOString(),
    },
  };

  return JSON.stringify(pkg, null, 2) + "\n";
}

/**
 * Generate tsconfig.json for the package (jsx: react-jsx, bundler resolution).
 */
export function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ["**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  };

  return JSON.stringify(config, null, 2) + "\n";
}

/**
 * Generate barrel index.ts re-exporting ./react/index and ./tokens/index.
 */
export function generateBarrelIndex(
  specs: ComponentSpec[],
  tokenCount: number
): string {
  const lines: string[] = [];
  if (specs.length > 0) {
    lines.push('export * from "./react/index";');
  }
  if (tokenCount > 0) {
    lines.push('export * from "./tokens/index";');
  }
  if (lines.length === 0) {
    lines.push("// No components or tokens in this build");
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Generate barrel index.d.ts matching the barrel index.
 */
export function generateBarrelDeclaration(
  specs: ComponentSpec[],
  tokenCount: number
): string {
  const lines: string[] = [];
  if (specs.length > 0) {
    lines.push('export * from "./react/index";');
  }
  if (tokenCount > 0) {
    lines.push('export * from "./tokens/index";');
  }
  if (lines.length === 0) {
    lines.push("// No components or tokens in this build");
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Generate README.md with install instructions and component table.
 */
export function generateReadme(
  config: PackageConfig,
  specs: ComponentSpec[],
  tokenCount: number
): string {
  const pkgName = `@${config.orgScope}/${config.projectSlug}-ui`;
  const sorted = [...specs].sort((a, b) =>
    a.canonicalKey.localeCompare(b.canonicalKey)
  );

  const lines: string[] = [];
  lines.push(`# ${pkgName}`);
  lines.push("");
  lines.push("Auto-generated UI package from Figma design tokens and components.");
  lines.push("");
  lines.push("## Install");
  lines.push("");
  lines.push("```bash");
  lines.push(`npm install ${pkgName}`);
  lines.push("```");
  lines.push("");
  lines.push("## Usage");
  lines.push("");
  lines.push("```tsx");
  lines.push(`import { tokens } from "${pkgName}/tokens";`);
  lines.push(`import "${pkgName}/tokens.css";`);
  lines.push("```");
  lines.push("");

  if (sorted.length > 0) {
    lines.push("## Components");
    lines.push("");
    lines.push("| Component | Key | Variants | Source |");
    lines.push("|-----------|-----|----------|--------|");
    for (const spec of sorted) {
      lines.push(
        `| ${spec.name} | \`${spec.canonicalKey}\` | ${spec.variantCount} | ${spec.source} |`
      );
    }
    lines.push("");
  }

  lines.push(`## Stats`);
  lines.push("");
  lines.push(`- **Tokens**: ${tokenCount}`);
  lines.push(`- **Components**: ${sorted.length}`);
  lines.push(`- **Build**: \`${config.buildId.slice(0, 8)}\``);
  lines.push(`- **Version**: ${config.version}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Orchestrator: generate all package artifacts for a build.
 *
 * Accepts the generated token/React content so the package directory is
 * fully self-contained — every path in the exports map resolves to a
 * file inside the package root.
 */
export interface PackageVersionInputs {
  version: string;
  changelog?: string;
}

export function generatePackageArtifacts(
  buildId: string,
  orgScope: string,
  projectSlug: string,
  specs: ComponentSpec[],
  tokenNames: string[],
  content?: PackageContentInputs,
  versionInputs?: PackageVersionInputs
): PackageArtifact[] {
  const config: PackageConfig = {
    orgScope,
    projectSlug,
    version: versionInputs?.version ?? "0.0.0-build." + buildId.slice(0, 8),
    buildId,
  };

  const artifacts: PackageArtifact[] = [];

  const packageJson = generatePackageJson(config, specs, tokenNames.length);
  artifacts.push({
    type: "package/package.json",
    key: `builds/${buildId}/package/package.json`,
    content: packageJson,
    contentType: "application/json",
  });

  const tsConfig = generateTsConfig();
  artifacts.push({
    type: "package/tsconfig.json",
    key: `builds/${buildId}/package/tsconfig.json`,
    content: tsConfig,
    contentType: "application/json",
  });

  const barrelIndex = generateBarrelIndex(specs, tokenNames.length);
  artifacts.push({
    type: "package/index.ts",
    key: `builds/${buildId}/package/index.ts`,
    content: barrelIndex,
    contentType: "text/typescript",
  });

  const barrelDeclaration = generateBarrelDeclaration(specs, tokenNames.length);
  artifacts.push({
    type: "package/index.d.ts",
    key: `builds/${buildId}/package/index.d.ts`,
    content: barrelDeclaration,
    contentType: "text/typescript",
  });

  const readme = generateReadme(config, specs, tokenNames.length);
  artifacts.push({
    type: "package/README.md",
    key: `builds/${buildId}/package/README.md`,
    content: readme,
    contentType: "text/markdown",
  });

  if (versionInputs?.changelog) {
    artifacts.push({
      type: "package/CHANGELOG.md",
      key: `builds/${buildId}/package/CHANGELOG.md`,
      content: versionInputs.changelog,
      contentType: "text/markdown",
    });
  }

  // Emit token and React files inside the package directory so exports resolve
  if (content) {
    artifacts.push({
      type: "package/tokens.css",
      key: `builds/${buildId}/package/tokens.css`,
      content: content.tokensCss,
      contentType: "text/css",
    });

    artifacts.push({
      type: "package/tokens/index.ts",
      key: `builds/${buildId}/package/tokens/index.ts`,
      content: content.tokensTs,
      contentType: "text/typescript",
    });

    artifacts.push({
      type: "package/react/index.ts",
      key: `builds/${buildId}/package/react/index.ts`,
      content: content.reactIndex,
      contentType: "text/typescript",
    });

    for (const react of content.reactArtifacts) {
      artifacts.push({
        type: `package/react/${react.canonicalKey}.tsx`,
        key: `builds/${buildId}/package/react/${react.canonicalKey}.tsx`,
        content: react.content,
        contentType: "text/typescript",
      });
    }
  }

  return artifacts;
}
