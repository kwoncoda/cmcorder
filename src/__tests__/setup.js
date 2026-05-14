// Vitest 전역 setup.
// - @testing-library/jest-dom 매처(`toBeInTheDocument` 등)를 Vitest expect에 주입한다.
// - vitest-axe 매처(`toHaveNoViolations`)도 함께 주입 — Task 0.4 (a11y 회귀).
import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);
