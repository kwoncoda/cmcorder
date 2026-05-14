// Task 2.11 — EmptyState 단위 테스트.
// UX §6.1 / COMPONENT_GUIDE §5 — 빈 상태 공통 컴포넌트.
//
// 회귀 보호 항목:
//   - title / description 텍스트 렌더
//   - actionLabel + onAction 시 버튼 클릭 동작 (인라인 CTA — UX-1 토스트 X)
//   - mascot prop 으로 MascotState 상태 전환 (default → cooking 등)
//   - variant=page 시 min-h-screen, variant=card 기본
//   - role=status + aria-label=title (UX §6.1)
//   - axe 위반 0
//
// 관련 결정: UX §6.1 / COMPONENT_GUIDE §5
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import EmptyState from '../EmptyState.jsx';

describe('EmptyState', () => {
  it('title, description 텍스트 렌더', () => {
    render(
      <EmptyState
        title="장바구니가 비어 있어요"
        description="메뉴를 줍고 와 주세요."
      />,
    );
    expect(screen.getByText('장바구니가 비어 있어요')).toBeInTheDocument();
    expect(screen.getByText('메뉴를 줍고 와 주세요.')).toBeInTheDocument();
  });

  it('actionLabel + onAction 시 버튼 클릭 동작 (인라인 CTA)', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="비어 있어요"
        actionLabel="메뉴 보기"
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '메뉴 보기' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('actionLabel 만 있고 onAction 없으면 버튼 미렌더', () => {
    render(<EmptyState title="X" actionLabel="가기" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('mascot prop 으로 MascotState 상태 전환 (cooking ↔ default)', () => {
    const { rerender, container } = render(
      <EmptyState title="X" mascot="cooking" />,
    );
    // 결정 c — useFallback=true 기본이므로 이모지 직접 검증.
    expect(container.textContent).toContain('🔥');
    rerender(<EmptyState title="X" mascot="default" />);
    expect(container.textContent).toContain('🪖');
  });

  it('variant=page 시 min-h-screen 클래스 적용', () => {
    const { container } = render(<EmptyState title="X" variant="page" />);
    expect(container.firstChild.className).toMatch(/\bmin-h-screen\b/);
  });

  it('variant=card (기본) 시 min-h-screen 없음, rounded-md 적용', () => {
    const { container } = render(<EmptyState title="X" />);
    expect(container.firstChild.className).not.toMatch(/\bmin-h-screen\b/);
    expect(container.firstChild.className).toMatch(/\brounded-md\b/);
  });

  it('role=status + aria-label=title (UX §6.1)', () => {
    render(<EmptyState title="비어 있어요" />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-label', '비어 있어요');
  });

  it('forwardRef 로 DOM section 참조 전달', () => {
    const ref = createRef();
    render(<EmptyState ref={ref} title="X" />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current.tagName.toLowerCase()).toBe('section');
  });

  it('className prop passthrough', () => {
    const { container } = render(
      <EmptyState title="X" className="extra-cls" />,
    );
    expect(container.firstChild.className).toMatch(/\bextra-cls\b/);
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <EmptyState
        title="비어 있어요"
        description="메뉴를 보러 가요."
        actionLabel="메뉴 보기"
        onAction={() => {}}
      />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
