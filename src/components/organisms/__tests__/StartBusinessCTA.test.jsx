// Task 2.8 — StartBusinessCTA organism 단위 테스트.
// IMPLEMENTATION_PLAN §2.8 / G13 / ADR-026.
//
// 회귀 보호 항목:
//   - status=OPEN 시 렌더 X (이미 영업 중 — CTA 불필요)
//   - CLOSED + shouldBeOpen=true 시 큰 형광 옐로 (primary, bg-accent) "장사 시작"
//   - CLOSED + shouldBeOpen=false 시 secondary 톤 + "아직 영업 시작 시간이 아닙니다" 안내
//   - 클릭 시 onStart 호출 + 200ms pressed 클래스 추가 (모션)
//   - loading=true 시 버튼 disabled + aria-busy
//   - error prop 시 인라인 alert 표시
//   - aria-label은 shouldBeOpen에 따라 동적
//   - a11y (axe)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { axe } from 'vitest-axe';
import StartBusinessCTA from '../StartBusinessCTA.jsx';

afterEach(() => {
  vi.useRealTimers();
});

describe('StartBusinessCTA', () => {
  it('status=OPEN 시 렌더 X (null 반환)', () => {
    const { container } = render(<StartBusinessCTA status="OPEN" />);
    expect(container.firstChild).toBeNull();
  });

  it('CLOSED + shouldBeOpen=true 시 큰 형광 옐로 (primary, bg-accent 시작 클래스) "장사 시작" CTA', () => {
    render(<StartBusinessCTA status="CLOSED" shouldBeOpen={true} />);
    const btn = screen.getByTestId('start-business-cta');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toMatch(/장사 시작/);
    // primary variant → 채워진 bg-accent (Button atom). secondary는 bg-transparent.
    // 단어 경계로 정확 매칭 (border-accent / hover:bg-accent/10 등 secondary 잔재 회피).
    expect(btn.className).toMatch(/(^|\s)bg-accent(\s|$)/);
    // 큰 버튼 — size lg (min-h 56)
    expect(btn.className).toMatch(/min-h-\[56px\]/);
  });

  it('CLOSED + shouldBeOpen=false 시 secondary variant + 안내 카피', () => {
    render(<StartBusinessCTA status="CLOSED" shouldBeOpen={false} />);
    const btn = screen.getByTestId('start-business-cta');
    expect(btn).toBeInTheDocument();
    // primary 의 채워진 bg-accent 클래스 부재 (단어 경계 — secondary의 border-accent 등은 허용).
    expect(btn.className).not.toMatch(/(^|\s)bg-accent(\s|$)/);
    // secondary 의 투명 배경 시그니처
    expect(btn.className).toMatch(/bg-transparent/);
    expect(
      screen.getByText(/아직 영업 시작 시간이 아닙니다/),
    ).toBeInTheDocument();
  });

  it('클릭 시 onStart 호출 + 즉시 pressed 클래스 (200ms 모션)', () => {
    const onStart = vi.fn();
    vi.useFakeTimers();
    render(
      <StartBusinessCTA status="CLOSED" shouldBeOpen={true} onStart={onStart} />,
    );
    const btn = screen.getByTestId('start-business-cta');
    fireEvent.click(btn);
    expect(onStart).toHaveBeenCalledTimes(1);
    // pressed 클래스 즉시 추가 — 200ms 모션 트리거
    expect(btn.className).toMatch(/start-business-cta-press/);
    // 200ms 경과 후 pressed 해제
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(btn.className).not.toMatch(/start-business-cta-press/);
  });

  it('loading=true 시 버튼 disabled + aria-busy', () => {
    render(<StartBusinessCTA status="CLOSED" shouldBeOpen={true} loading />);
    const btn = screen.getByTestId('start-business-cta');
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('error prop 시 인라인 alert 표시', () => {
    render(
      <StartBusinessCTA
        status="CLOSED"
        shouldBeOpen={true}
        error="API 호출 실패"
      />,
    );
    expect(screen.getByTestId('cta-error')).toHaveTextContent('API 호출 실패');
    expect(screen.getByRole('alert')).toHaveTextContent('API 호출 실패');
  });

  it('aria-label은 shouldBeOpen에 따라 동적', () => {
    const { rerender } = render(
      <StartBusinessCTA status="CLOSED" shouldBeOpen={true} />,
    );
    expect(screen.getByTestId('start-business-cta')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/지금 영업 시작/),
    );
    rerender(<StartBusinessCTA status="CLOSED" shouldBeOpen={false} />);
    expect(screen.getByTestId('start-business-cta')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/영업 시간 전/),
    );
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <StartBusinessCTA status="CLOSED" shouldBeOpen={true} />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
