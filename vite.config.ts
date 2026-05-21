import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
  },
});
