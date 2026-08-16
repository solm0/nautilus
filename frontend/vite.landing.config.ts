import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import path from "node:path";

const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
) as { version?: string };
const appVersion = process.env.APP_VERSION_OVERRIDE ?? packageJson.version ?? "0.0.0";

export default defineConfig({
  envDir: __dirname,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    open: "/landing/index.html",
    proxy: {
      "/api": {
        target: process.env.VITE_LANDING_PROXY_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../central/static/landing",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing: resolve(__dirname, "landing/index.html"),
        background: resolve(__dirname, "landing/background/index.html"),
        chromeExtensionPrivacy: resolve(__dirname, "landing/chrome-extension-privacy/index.html"),
        androidAppPrivacy: resolve(__dirname, "landing/android-app-privacy/index.html"),
        androidAppAccountDeletion: resolve(__dirname, "landing/android-app-account-deletion/index.html"),
      },
    },
  },
});
