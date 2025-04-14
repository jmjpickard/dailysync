import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'

// Custom plugin to copy the worker.js file to the dist-electron/main directory
const copyWorkerPlugin = () => {
  return {
    name: 'copy-worker-plugin',
    closeBundle() {
      const srcFile = resolve('src/transcription/worker.ts')
      const destDir = resolve('dist-electron/main')
      const destFile = path.join(destDir, 'worker.js')
      
      console.log(`[build] Copying worker file from ${srcFile} to ${destFile}...`)
      
      // Ensure the destination directory exists
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true })
      }
      
      try {
        // Note: Since we're copying a .ts file to .js, this relies on the build process to correctly
        // compile worker.ts into the worker.js file. We'll handle this in the main build config.
        console.log('[build] Worker file will be built by the main build process')
      } catch (err) {
        console.error('[build] Error during worker file handling:', err)
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyWorkerPlugin()],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        // External dependencies that shouldn't be bundled
        external: ['electron', 'audio-capture-addon'],
        // Important: Include worker.ts as an entry point
        input: {
          index: resolve('src/main/index.ts'),
          worker: resolve('src/transcription/worker.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload'
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    build: {
      outDir: resolve('dist'),
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src'),
      },
    },
    server: {
      host: '127.0.0.1'
    },
    plugins: []
  },
})
