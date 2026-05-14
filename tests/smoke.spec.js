import { test, expect } from '@playwright/test';

// Task 0.4 sample E2E.
// 홈("/") 진입 시 /menu 로 리다이렉트되고 placeholder가 렌더되는지 확인.
// Phase 4.2 에서 실제 메뉴 페이지로 교체되면 selector를 갱신한다.
test('홈 진입 시 /menu로 redirect되어 메뉴 페이지가 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByTestId('menu-page')).toBeVisible();
});
