import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from "path";

export default defineConfig({
  root: "./src/renderer",
  base: "./",
  build: {
    outDir: resolve(__dirname, "out", "static"),
    sourcemap: true
  },
  plugins: [
    react({
      jsxImportSource: undefined,
      babel: {
        plugins: []
      }
    })
  ],
  resolve: {
    alias: {
    }
  }
})
