import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Версія застосунку з package.json (єдине джерело) — доступна в коді як __APP_VERSION__.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
