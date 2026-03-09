import { defineConfig } from "tsup";
import path from "path";

export default defineConfig({
  entry: { index: "src/cli/index.ts" },
  outDir: "dist",
  format: ["cjs"],
  target: "node20",
  bundle: true,
  minify: false,
  sourcemap: false,
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  esbuildOptions(options) {
    options.alias = {
      "@": path.resolve(__dirname, "src"),
    };
  },
});
