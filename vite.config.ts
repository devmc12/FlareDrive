import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Date: 2026-05-21
 * Time: 13:58
 * Desc: Configures Vite for React, local WebDAV proxying, and office preview chunks
 */

// Common preview dependencies load with the app, while Office previews stay lazy
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
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (!normalizedId.includes("node_modules")) return undefined;

          const lazyPreviewChunk = LAZY_PREVIEW_VENDOR_CHUNKS.find((chunk) =>
            isPackageId(normalizedId, chunk.packages)
          );
          if (lazyPreviewChunk) {
            return lazyPreviewChunk.name;
          }

          if (isPackageId(normalizedId, COMMON_PREVIEW_VENDOR_PACKAGES)) {
            return "preview-vendors";
          }

          return undefined;
        },
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
  return /preview-(pdf|spreadsheet|word)-vendors/.test(assetPath);
}
