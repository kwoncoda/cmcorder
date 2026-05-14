// Task 0.4 — vitest-axe 통합 회귀.
// ErrorPage(404) 렌더에 a11y 위반이 없는지 확인 — vitest-axe matchers (setup.js 등록).
// 이후 Phase 1~7에서 컴포넌트별 a11y 회귀가 늘어날 때 패턴 레퍼런스로 사용.
// - color-contrast 규칙은 jsdom 환경에서 `HTMLCanvasElement.getContext` 가
//   미구현이라 노이즈 경고가 뜬다. 실제 색 대비 검증은 Playwright E2E(Task 7.x)에서
//   브라우저 axe 로 수행하므로 단위 테스트에서는 비활성.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';

import ErrorPage from '../pages/customer/ErrorPage.jsx';

const axeOptions = {
  rules: {
    'color-contrast': { enabled: false },
  },
};

describe('ErrorPage a11y (axe-core)', () => {
  it('ErrorPage 404 렌더에는 a11y 위반이 없다', async () => {
    // Task 4.9 — ErrorPage가 <Link to="/menu"> 사용 → Router 컨텍스트 필요.
    const { container } = render(
      <MemoryRouter>
        <ErrorPage code={404} />
      </MemoryRouter>,
    );
    const results = await axe(container, axeOptions);
    expect(results).toHaveNoViolations();
  });
});
