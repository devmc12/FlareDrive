import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Date: 2026-05-21
 * Time: 13:58
 * Desc: Configures Vite for React, local WebDAV proxying, and lazy preview chunks
 */

// Common preview dependencies load with the app, while heavy document previews stay lazy
const COMMON_PREVIEW_VENDOR_PACKAGES = [
  "viewerjs",
  "fflate",
  "react-markdown",
  "remark-gfm",
];

// Large or less common preview dependencies are loaded only on first use
const LAZY_PREVIEW_VENDOR_CHUNKS = [
  { name: "preview-pdf-vendors", packages: ["pdfjs-dist"] },
  { name: "preview-spreadsheet-vendors", packages: ["xlsx", "@univerjs"] },
  { name: "preview-word-vendors", packages: ["docx-preview"] },
  { name: "preview-pptx-vendors", packages: ["pptx-preview"] },
];

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3601,
    strictPort: true,
    hmr: {
      clientPort: 3601,
    },
    proxy: {
      "/webdav": {
        target: "http://127.0.0.1:3602",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "build",
    modulePreload: {
      resolveDependencies(_filename, deps, context) {
        if (context.hostType !== "html") return deps;
        return deps.filter((dep) => !isPreviewVendorAsset(dep));
      },
    },
    rollupOptions: {
      output: {
        codeSplitting: {
          // Keep lazy preview vendors from capturing React, MUI, or Vite helpers
          includeDependenciesRecursively: false,
          groups: [
            ...LAZY_PREVIEW_VENDOR_CHUNKS.map((chunk) => ({
              name: chunk.name,
              priority: 2,
              test: (id: string) => isPackageId(id, chunk.packages),
            })),
            {
              name: "preview-vendors",
              priority: 1,
              test: (id: string) =>
                isPackageId(id, COMMON_PREVIEW_VENDOR_PACKAGES),
            },
          ],
        },
        // Preserve execution order with non-recursive vendor grouping
        strictExecutionOrder: true,
      },
    },
  },
});

/**
 * Checks whether a resolved module id belongs to one of the target packages
 * @param normalizedId Resolved module id with slash separators
 * @param packageNames Package names or scoped package prefixes to match
 * @returns Whether the id belongs to one of the packages
 */
function isPackageId(normalizedId: string, packageNames: string[]) {
  normalizedId = normalizedId.replace(/\\/g, "/");
  return packageNames.some((packageName) =>
    normalizedId.includes(`/node_modules/${packageName}/`)
  );
}

/**
 * Checks whether a generated asset belongs to a lazy preview vendor chunk
 * @param assetPath Generated asset path relative to the build output
 * @returns Whether initial HTML should skip preloading this asset
 */
function isPreviewVendorAsset(assetPath: string) {
  return /preview-(pdf|spreadsheet|word|pptx)-vendors/.test(assetPath);
}
