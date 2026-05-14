import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite + Vitest 통합 설정.
// - plugins: React Fast Refresh.
// - test: jsdom 환경 + RTL 매처는 setup.js에서 주입.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
  },
});
