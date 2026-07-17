import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-extension-public",
      closeBundle() {
        const sourceDir = resolve(__dirname, "extension/public");
        const targetDir = resolve(__dirname, "dist-extension");

        if (!existsSync(sourceDir)) {
          return;
        }

        mkdirSync(targetDir, { recursive: true });
        cpSync(sourceDir, targetDir, { recursive: true });
      },
    },
  ],
  publicDir: "extension/public",
  build: {
    outDir: "dist-extension",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: "extension/background.ts",
        content: "extension/content.tsx",
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
