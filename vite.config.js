import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' => relative asset paths, so the same build works on Vercel (root)
// AND GitHub Pages (sub-path) without reconfiguration.
export default defineConfig({
  plugins: [react()],
  base: './',
})
