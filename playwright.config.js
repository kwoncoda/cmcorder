import { defineConfig, devices } from '@playwright/test';

// Playwright E2E 설정 (Task 0.4 + P1-1 Codex 리뷰 2026-05-15).
// - testDir: tests/ (Vitest 단위는 src/ — 분리).
// - baseURL: 로컬 dev (Vite 5173).
// - webServer: Vite + Express 백엔드 동시 기동 (Vite 프록시 미설정이므로
//   Express 라우트 호출은 동작 안 함이지만, 페이지 자체는 렌더되어 smoke 통과).
//   API 의존 시나리오는 webServer baseURL을 backend로 변경하거나 Vite 프록시 추가.
// - chromium만 (모바일/데스크탑 emulation 2 project) — Firefox/WebKit 생략.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
