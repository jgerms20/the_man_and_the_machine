import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/the_man_and_the_machine/',
  plugins: [react(), tailwindcss()],
})
