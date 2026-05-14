import { defineConfig, devices } from '@playwright/test';

// Playwright E2E 설정 (Task 0.4).
// - testDir: tests/ (Vitest 단위는 src/ — 분리).
// - baseURL: 로컬 dev (Vite 5173).
// - webServer: 테스트 진입 시 `npm run dev` 자동 기동.
// - chromium만 (모바일/데스크탑 emulation 2 project) — 일정 압박으로 Firefox/WebKit 생략.
export default defineConfig({
  testDir: './tests',
  timeout: 10_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    // Pixel 5: Chromium 기반 mobile emulation — iPhone 13(WebKit) 대신 사용.
    // 작업 가이드: chromium만 설치, WebKit/Firefox 생략. iPhone 디바이스 메타는
    // 필요 시 viewport + userAgent 수동 override 가능.
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
