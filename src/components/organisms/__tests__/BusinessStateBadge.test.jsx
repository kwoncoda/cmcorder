// Task 2.8 — BusinessStateBadge organism 단위 테스트.
// IMPLEMENTATION_PLAN §2.8 / G13 / ADR-026 / 결정 h (깜박 매번 재생 — 세션 X).
//
// 회귀 보호 항목:
//   - 3 시각 상태: OPEN(녹·정적) / CLOSED+shouldBeOpen=false(빨·정적) / CLOSED+shouldBeOpen=true(빨·깜박)
//   - role="status" + aria-live="polite"
//   - 알 수 없는 status → CLOSED fallback
//   - a11y (axe)
//   - forwardRef
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import BusinessStateBadge from '../BusinessStateBadge.jsx';

describe('BusinessStateBadge', () => {
  it('OPEN 시 🟢 + "영업 중 (OPEN)" 라벨 + bg-success', () => {
    render(<BusinessStateBadge status="OPEN" />);
    const badge = screen.getByTestId('business-state-badge');
    expect(badge.textContent).toMatch(/영업 중/);
    expect(badge.className).toMatch(/bg-success/);
    // 깜박 클래스 부재
    expect(badge.className).not.toMatch(/business-badge-blink/);
  });

  it('CLOSED + shouldBeOpen=false 시 🔴 + 정적 (깜박 X)', () => {
    render(<BusinessStateBadge status="CLOSED" shouldBeOpen={false} />);
    const badge = screen.getByTestId('business-state-badge');
    expect(badge.textContent).toMatch(/영업 외/);
    expect(badge.className).toMatch(/bg-danger/);
    expect(badge.className).not.toMatch(/business-badge-blink/);
  });

  it('★ CLOSED + shouldBeOpen=true 시 깜박 클래스 (결정 h — 매번 재생)', () => {
    render(<BusinessStateBadge status="CLOSED" shouldBeOpen={true} />);
    const badge = screen.getByTestId('business-state-badge');
    expect(badge.textContent).toMatch(/영업 외/);
    expect(badge.className).toMatch(/bg-danger/);
    expect(badge.className).toMatch(/business-badge-blink/);
  });

  it('role=status + aria-live=polite 명시', () => {
    render(<BusinessStateBadge status="OPEN" />);
    const badge = screen.getByTestId('business-state-badge');
    expect(badge).toHaveAttribute('role', 'status');
    expect(badge).toHaveAttribute('aria-live', 'polite');
  });

  it('알 수 없는 status 시 CLOSED fallback (영업 외)', () => {
    render(<BusinessStateBadge status="WEIRD" />);
    expect(screen.getByTestId('business-state-badge').textContent).toMatch(/영업 외/);
  });

  it('forwardRef 로 span 참조 전달', () => {
    const ref = createRef();
    render(<BusinessStateBadge ref={ref} status="OPEN" />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('a11y 위반 없음 (axe-core) — 깜박 상태 포함', async () => {
    const { container } = render(
      <BusinessStateBadge status="CLOSED" shouldBeOpen={true} />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
