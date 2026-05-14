// Task 2.11 — ErrorState 단위 테스트.
// UX §6.3 / COMPONENT_GUIDE §5 — 오류 상태 공통 컴포넌트.
//
// 핵심 회귀 (★):
//   1. title / description / code 렌더 (사실 + 회복 경로 — 사용자 책임 카피 X)
//   2. actionLabel + onAction 시 버튼 클릭 (인라인 CTA — UX-1 토스트 X)
//   3. variant=inline-field 시 작은 빨간 텍스트 + role=alert (폼 인라인 에러)
//   4. variant=page 시 min-h-screen (풀스크린)
//   5. variant=card (기본) 시 canceled 마스코트 표시
//   6. role=alert + aria-live=assertive (스크린리더 즉시 안내)
//   7. axe 위반 0
//
// 관련 결정: UX §6.3 / COMPONENT_GUIDE §5
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import ErrorState from '../ErrorState.jsx';

describe('ErrorState', () => {
  it('title, description, code 텍스트 렌더', () => {
    render(
      <ErrorState
        title="연결이 끊어졌어요"
        description="네트워크를 확인하고 다시 시도해 주세요."
        code="OFFLINE"
      />,
    );
    expect(screen.getByText('연결이 끊어졌어요')).toBeInTheDocument();
    expect(
      screen.getByText('네트워크를 확인하고 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('[OFFLINE]')).toBeInTheDocument();
  });

  it('actionLabel + onAction 시 버튼 클릭 동작 (인라인 CTA)', () => {
    const onAction = vi.fn();
    render(
      <ErrorState title="X" actionLabel="다시 시도" onAction={onAction} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('★ variant=inline-field 시 작은 빨간 텍스트 + role=alert (폼 인라인 에러)', () => {
    render(<ErrorState title="필수 항목입니다" variant="inline-field" />);
    const inline = screen.getByTestId('error-state-inline');
    expect(inline).toHaveAttribute('role', 'alert');
    expect(inline.className).toMatch(/\btext-danger\b/);
    expect(inline.className).toMatch(/\btext-xs\b/);
    expect(inline.textContent).toBe('필수 항목입니다');
  });

  it('variant=inline-field 시 마스코트·description·버튼 미렌더 (간소화)', () => {
    render(
      <ErrorState
        title="필수 항목"
        description="작성하세요"
        actionLabel="X"
        onAction={() => {}}
        variant="inline-field"
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('작성하세요')).toBeNull();
  });

  it('variant=page 시 min-h-screen 클래스', () => {
    const { container } = render(<ErrorState title="X" variant="page" />);
    expect(container.firstChild.className).toMatch(/\bmin-h-screen\b/);
  });

  it('variant=card (기본) 시 canceled 마스코트(😢) 표시 — 결정 c', () => {
    const { container } = render(<ErrorState title="오류" />);
    expect(container.textContent).toContain('😢');
  });

  it('role=alert + aria-live=assertive (페이지/카드 variant — 스크린리더 즉시 안내)', () => {
    render(<ErrorState title="X" />);
    const el = screen.getByTestId('error-state');
    expect(el).toHaveAttribute('role', 'alert');
    expect(el).toHaveAttribute('aria-live', 'assertive');
  });

  it('code 미지정 시 코드 영역 미렌더', () => {
    const { container } = render(<ErrorState title="오류" />);
    expect(container.textContent).not.toMatch(/\[.*\]/);
  });

  it('title 기본값 "오류가 발생했어요"', () => {
    render(<ErrorState />);
    expect(screen.getByText('오류가 발생했어요')).toBeInTheDocument();
  });

  it('forwardRef 로 DOM 참조 전달 (card variant)', () => {
    const ref = createRef();
    render(<ErrorState ref={ref} title="X" />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current.tagName.toLowerCase()).toBe('section');
  });

  it('a11y 위반 없음 — card variant (axe-core)', async () => {
    const { container } = render(
      <ErrorState
        title="연결이 끊어졌어요"
        description="네트워크를 확인해 주세요."
        code="500"
        actionLabel="다시 시도"
        onAction={() => {}}
      />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });

  it('a11y 위반 없음 — inline-field variant', async () => {
    const { container } = render(
      <ErrorState title="필수 항목" variant="inline-field" />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
