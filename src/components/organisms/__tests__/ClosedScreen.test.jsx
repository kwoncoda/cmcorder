// Task 2.9 — ClosedScreen organism 단위 테스트.
// IMPLEMENTATION_PLAN §2.9 / G13 / UX §8.8.
//
// 회귀 보호 항목:
//   - 4 reason 별 카피 ('before-open' | 'after-close' | 'after-settlement' | 'both-days-done')
//   - 운영 일정 SoT 2일 모두 표시 (5/20·5/21)
//   - operatingDate=오늘 일자만 강조 (text-accent 또는 font-semibold)
//   - 운영 일정 aria-live="polite" — UX §8.8 자동 announce
//   - 알 수 없는 reason fallback → 'before-open'
//   - MascotState 재사용 — reason='both-days-done' 시 canceled (😢 이모지 fallback)
//   - a11y (axe)
// 자물쇠/새로고침 케이스 제거 (2026-05-17 front_closed_design).
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import ClosedScreen from '../ClosedScreen.jsx';

describe('ClosedScreen', () => {
  it.each([
    ['before-open', /영업 시작 전/],
    ['after-close', /영업이 끝났어요/],
    ['after-settlement', /정산 마감/],
    ['both-days-done', /축제 부스가 종료/],
  ])('reason=%s 시 해당 카피 렌더', (reason, regex) => {
    render(<ClosedScreen reason={reason} operatingDate="2026-05-20" />);
    expect(screen.getByText(regex)).toBeInTheDocument();
  });

  it('운영 일정 2일 모두 표시 (5/20·5/21) — P2-1: 양일 모두 15:00 오픈', () => {
    render(<ClosedScreen reason="before-open" operatingDate="2026-05-20" />);
    expect(screen.getByText('5월 20일 (수)')).toBeInTheDocument();
    expect(screen.getByText('5월 21일 (목)')).toBeInTheDocument();
    // 두 항목 모두 '15:00 ~ 21:00'이므로 getAllByText로 2개 확인.
    expect(screen.getAllByText('15:00 ~ 21:00')).toHaveLength(2);
  });

  it('★ P2-1 — after-close/after-settlement 문구는 "내일 오후 3시"로 통일', () => {
    const { rerender } = render(<ClosedScreen reason="after-close" />);
    expect(screen.getByText(/내일 오후 3시에 다시 만나요/)).toBeInTheDocument();
    rerender(<ClosedScreen reason="after-settlement" />);
    expect(screen.getByText(/내일 오후 3시에 다시 만나요/)).toBeInTheDocument();
  });

  it('★ Bug 12 / P2-1 — 5/20·5/21 양일 오픈 시간 15:00 ~ 21:00', () => {
    render(<ClosedScreen reason="before-open" operatingDate="2026-05-20" />);
    expect(screen.getAllByText(/15:00 ~ 21:00/)).toHaveLength(2);
  });

  it('★ Bug 12 — before-open 문구는 "오후 3시에 오픈할 예정" 포함', () => {
    render(<ClosedScreen reason="before-open" />);
    expect(screen.getByText(/오후 3시에 오픈할 예정/)).toBeInTheDocument();
  });

  it('operatingDate=오늘 일자만 강조 (text-accent 또는 font-semibold)', () => {
    const { container } = render(
      <ClosedScreen reason="before-open" operatingDate="2026-05-20" />,
    );
    // 강조 항목 — text-accent 또는 font-semibold 클래스로 표시.
    const today =
      container.querySelector('li.text-accent') ||
      container.querySelector('li.font-semibold');
    expect(today).not.toBeNull();
    expect(today.textContent).toContain('5월 20일');
  });

  it('★ 운영 일정 aria-live=polite (UX §8.8 자동 announce)', () => {
    render(<ClosedScreen reason="before-open" operatingDate="2026-05-20" />);
    expect(screen.getByTestId('operating-schedule')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('알 수 없는 reason 시 before-open fallback', () => {
    render(<ClosedScreen reason="weird" operatingDate="2026-05-20" />);
    expect(screen.getByText(/영업 시작 전/)).toBeInTheDocument();
  });

  it('마스코트 표시 — both-days-done 시 canceled (😢 이모지 fallback)', () => {
    const { container } = render(
      <ClosedScreen reason="both-days-done" operatingDate="2026-05-20" />,
    );
    // useFallback=true 기본 → canceled 상태의 fallbackEmoji=😢 렌더.
    expect(container.textContent).toContain('😢');
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <ClosedScreen reason="before-open" operatingDate="2026-05-20" />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });
});
