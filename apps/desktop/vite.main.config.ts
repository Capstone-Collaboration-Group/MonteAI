// apps/desktop/vite.main.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["canvas"],
    },
  },
});