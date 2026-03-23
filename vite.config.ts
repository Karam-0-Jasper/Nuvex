// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'  // if you use SWC, change to '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '/src': '/src',  // This fixes the "/src/main.tsx" resolve error on Vercel
    }
  }
})
