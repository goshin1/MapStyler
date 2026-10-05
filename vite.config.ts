import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  worker: {
    // MapLibre 워커는 ESM 모듈 워커로 실행된다
    format: 'es',
  },
})
