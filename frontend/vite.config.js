import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El build se escribe directamente en backend/static/, para que Flask lo sirva
// y todo corra en un solo puerto. Ver la Fase 4 del plan.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
  },
  server: {
    // 0.0.0.0 para poder abrir la app desde el teléfono en la misma red Wi-Fi.
    host: '0.0.0.0',
    port: 5173,
  },
})
