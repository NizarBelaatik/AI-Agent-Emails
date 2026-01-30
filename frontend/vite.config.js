// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Remove the build.rollupOptions section entirely for now
  // Or keep it simple:
  css: {
    postcss: './postcss.config.js', // This tells Vite to use PostCSS
  },
})