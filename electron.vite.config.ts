import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve('dist/main'),
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve('dist/preload'),
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          pip: resolve('src/preload/pip.ts'),
        },
      },
    },
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
    build: {
      outDir: resolve('dist/renderer'),
      emptyOutDir: true,
    },
  },
})
