import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/three/examples/"))
            return "three-addons";
          if (id.includes("node_modules/three/")) return "three";
          return undefined;
        },
      },
    },
    // Keep flag SVGs as separate files so only the flags on screen are downloaded.
    assetsInlineLimit: (file) => (file.includes("circle-flags") ? false : undefined),
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:4000" },
  },
});
