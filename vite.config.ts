import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend'),
      '@/components': path.resolve(__dirname, './frontend/components'),
      '@/lib': path.resolve(__dirname, './frontend/lib'),
      '@/types': path.resolve(__dirname, './frontend/types'),
      '@/clients': path.resolve(__dirname, './frontend/clients'),
      '@/hooks': path.resolve(__dirname, './frontend/hooks'),
      '@/utils': path.resolve(__dirname, './frontend/utils'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
