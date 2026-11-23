import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@monteai/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@monteai/hooks": path.resolve(__dirname, "../../packages/hooks/src"),
    },
    // The renderer and shared UI must use the same auth/MFA/query contexts.
    dedupe: ["react", "react-dom", "@monteai/hooks", "@tanstack/react-query"],
  },
  optimizeDeps: {
    exclude: ["@monteai/ui", "@monteai/hooks", "@monteai/api", "canvas"],
  },
  build: {
    rollupOptions: {
      external: ["canvas"],
    },
  },
});
