import { test, expect } from '@playwright/test';

// Task 0.4 sample E2E + P1-1 (Codex 리뷰):
// 홈("/") 진입 시 /menu 로 리다이렉트되고 placeholder가 렌더되는지 확인.
//
// 변경 사유 (2026-05-15):
// - 기존 page.goto('/')는 'load' 이벤트 대기 → MenuPage가 /api/business-state,
//   /api/menus를 fetch하므로 백엔드 미기동 시 load 이벤트가 발화 안 함.
// - 'domcontentloaded'는 React 렌더 + Router redirect만 보장하면 충분.
// - 타임아웃 30s — apiFetch 기본 10s timeout × retry 가능성 흡수.
test('홈 진입 시 /menu로 redirect되어 메뉴 페이지가 보인다', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByTestId('menu-page')).toBeVisible({ timeout: 10_000 });
});
