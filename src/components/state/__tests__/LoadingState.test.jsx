// Task 2.11 — LoadingState 단위 테스트.
// UX §6.2 / COMPONENT_GUIDE §5 — 로딩 상태 공통 컴포넌트.
//
// 핵심 회귀 (★):
//   1. minimumDelay=500 (기본) 첫 렌더는 미표시 — 깜박 회피 (UX §6.2)
//   2. minimumDelay=0 시 즉시 표시
//   3. 500ms 경과 후 표시 (vi.useFakeTimers + act)
//   4. label 텍스트 렌더
//   5. variant=inline 시 inline-flex 레이아웃
//   6. aria-busy=true + aria-live=polite (스크린리더 안내)
//   7. axe 위반 0
//
// 관련 결정: UX §6.2 / COMPONENT_GUIDE §5
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import LoadingState from '../LoadingState.jsx';

afterEach(() => {
  vi.useRealTimers();
});

describe('LoadingState', () => {
  it('minimumDelay=0 시 즉시 표시', () => {
    render(<LoadingState minimumDelay={0} label="로딩" />);
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('★ minimumDelay=500 (기본) 첫 렌더는 미표시 (UX §6.2 깜박 회피)', () => {
    vi.useFakeTimers();
    render(<LoadingState label="로딩" />);
    expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
  });

  it('★ minimumDelay=500 — 500ms 경과 후 표시', () => {
    vi.useFakeTimers();
    render(<LoadingState minimumDelay={500} label="로딩" />);
    expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('label 텍스트 렌더 (즉시 표시 변형)', () => {
    render(<LoadingState minimumDelay={0} label="메뉴 가져오는 중…" />);
    expect(screen.getByText('메뉴 가져오는 중…')).toBeInTheDocument();
  });

  it('variant=inline 시 inline-flex 레이아웃 클래스', () => {
    const { container } = render(
      <LoadingState minimumDelay={0} variant="inline" />,
    );
    expect(container.firstChild.className).toMatch(/\binline-flex\b/);
  });

  it('variant=page 시 min-h-screen 클래스', () => {
    const { container } = render(
      <LoadingState minimumDelay={0} variant="page" />,
    );
    expect(container.firstChild.className).toMatch(/\bmin-h-screen\b/);
  });

  it('variant=card (기본) 시 rounded-md 클래스', () => {
    const { container } = render(<LoadingState minimumDelay={0} />);
    expect(container.firstChild.className).toMatch(/\brounded-md\b/);
  });

  it('aria-busy=true + aria-live=polite 속성', () => {
    render(<LoadingState minimumDelay={0} />);
    const el = screen.getByTestId('loading-state');
    expect(el).toHaveAttribute('aria-busy', 'true');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });

  it('data-testid 오버라이드 (App.jsx PageLoading 호환)', () => {
    render(
      <LoadingState minimumDelay={0} data-testid="page-loading" label="로딩 중…" />,
    );
    expect(screen.getByTestId('page-loading')).toBeInTheDocument();
  });

  it('forwardRef 로 DOM div 참조 전달', () => {
    const ref = createRef();
    render(<LoadingState ref={ref} minimumDelay={0} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <LoadingState minimumDelay={0} label="로딩" />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
