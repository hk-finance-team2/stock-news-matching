import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 개발 중 /api 요청은 백엔드로 넘김 → 코드에 서버 주소를 쓰지 않아도 되고 CORS 문제도 없음
    // 백엔드 주소가 다르면 VITE_API_PROXY_TARGET=http://주소:포트 npm run dev
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
