import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Vite + Vitest 통합 설정.
// - plugins: React Fast Refresh.
// - test: jsdom 환경 + RTL/axe 매처는 setup.js에서 주입.
// - test.include/exclude: Vitest는 src 단위 테스트만 수집, tests/ 는 Playwright E2E 전용으로 분리.
// - envDir: 'config/vite-env' — 비어 있는 디렉터리. 프로젝트 루트 `.env` 는
//   백엔드(Express, Task 0.5) 전용이라 거기 `NODE_ENV=development` 가 들어 있다.
//   Vite 가 이를 읽으면 production 빌드를 강제 development 로 만들어
//   axe-core·jsx-dev-runtime 같은 dev 의존성이 번들에 섞인다 (Task 0.4 핵심 회귀).
//   client 측은 환경 변수가 필요 없으므로 envDir 을 빈 경로로 격리.
export default defineConfig({
  plugins: [react()],
  envDir: resolve(__dirname, 'config/vite-env'),
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}', 'server/**/*.{test,spec}.{js,jsx}'],
    exclude: ['tests/**', 'node_modules/**', 'dist/**'],
  },
});
