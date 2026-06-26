import { defineConfig } from 'vite'
import react from '@vitejs/react-swc' // (or your framework plugin)

export default defineConfig({
  // ... your existing config plugins ...
  build: {
    outDir: 'dist', // ◄ Forces the compiler to output to 'dist'
  },
})
