import { defineConfig } from 'vite'
import { resolve } from "path";

export default defineConfig({
  root: "./src/renderer",
  base: "./",
  build: {
    outDir: resolve(__dirname, "out", "static"),
    sourcemap: true
  }
})
