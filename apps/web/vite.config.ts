import fs from "fs"
import path from "path"
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Optional LAN HTTPS for phone testing. Cert paths and host exposure come
  // from gitignored .env.local, so a plain `pnpm dev:web` stays localhost HTTP.
  const env = loadEnv(mode, __dirname, "")
  const certPath = env.DEV_HTTPS_CERT?.trim()
  const keyPath = env.DEV_HTTPS_KEY?.trim()
  const cert = certPath ? fs.readFileSync(path.resolve(__dirname, certPath)) : undefined
  const key = keyPath ? fs.readFileSync(path.resolve(__dirname, keyPath)) : undefined

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@monteai/ui": path.resolve(__dirname, "../../packages/ui/src"),
      },
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      exclude: ["canvas"],
    },
    build: {
      rollupOptions: {
        external: ["canvas"],
      },
    },
    server: {
      host: env.DEV_HOST === "true" ? true : undefined,
      ...(cert && key ? { https: { key, cert } } : {}),
      proxy: {
        "/api/v1": {
          target: "http://localhost:5084",
          changeOrigin: true,
        },
      },
    },
  }
})
