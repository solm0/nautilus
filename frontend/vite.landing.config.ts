import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  envDir: __dirname,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../central/static/landing",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "landing/index.html"),
    },
  },
});