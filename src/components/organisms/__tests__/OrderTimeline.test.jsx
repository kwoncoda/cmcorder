// Task 2.6 — OrderTimeline organism 단위 테스트.
// IMPLEMENTATION_PLAN §2.6 / UX §5.1 보강 / ADR-010.
//
// 회귀 보호 항목:
//   - 5단계 progressbar (접수→입금→확인→조리→수령)
//   - role=progressbar + aria-valuemin/max/now
//   - current 상태별 valuenow 매핑 (ORDERED=0 ~ READY=4, DONE=5)
//   - 알 수 없는 current → 0 fallback
//   - history 시각 미니뷰 표시 (실제 시각만 — ADR-010 보존)
//   - ★ history 없는 단계는 "—" 표시 (분 단위 추정 X — ADR-010)
//   - showMiniview=false 시 미니뷰 숨김
//   - forwardRef
//   - a11y (axe)
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import OrderTimeline from '../OrderTimeline.jsx';

describe('OrderTimeline', () => {
  it('progressbar role + aria-valuemin/max 부착 (5 단계)', () => {
    render(<OrderTimeline current="ORDERED" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('5');
  });

  it.each([
    ['ORDERED', 0],
    ['TRANSFER_REPORTED', 1],
    ['PAID', 2],
    ['COOKING', 3],
    ['READY', 4],
    ['DONE', 5],
    // table_lock — READY 이후 후속 상태도 5단계 종료로 본다.
    ['DINING', 5],
    ['SETTLED', 5],
  ])('current=%s 시 aria-valuenow=%i', (current, expected) => {
    render(<OrderTimeline current={current} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      String(expected),
    );
  });

  it('알 수 없는 current 시 0 단계로 fallback', () => {
    render(<OrderTimeline current="WEIRD_STATE" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('★ table_lock — current=DINING 시 5단계 모두 done (P1-1 회귀)', () => {
    render(<OrderTimeline current="DINING" showMiniview={false} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('5');
  });

  it('★ table_lock — current=SETTLED 시 5단계 모두 done (P1-1 회귀)', () => {
    render(<OrderTimeline current="SETTLED" showMiniview={false} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('5');
  });

  it('5 단계 라벨 (접수·입금·확인·조리·수령) 모두 렌더', () => {
    render(<OrderTimeline current="ORDERED" showMiniview={false} />);
    expect(screen.getByText('접수')).toBeInTheDocument();
    expect(screen.getByText('입금')).toBeInTheDocument();
    expect(screen.getByText('확인')).toBeInTheDocument();
    expect(screen.getByText('조리')).toBeInTheDocument();
    expect(screen.getByText('수령')).toBeInTheDocument();
  });

  it('history 시각이 미니뷰에 표시 (ADR-010 — 실제 시각만)', () => {
    render(
      <OrderTimeline
        current="COOKING"
        history={{
          ORDERED: '17:30',
          TRANSFER_REPORTED: '17:33',
          PAID: '17:35',
          COOKING: '17:38',
        }}
      />,
    );
    expect(screen.getByText('17:30')).toBeInTheDocument();
    expect(screen.getByText('17:33')).toBeInTheDocument();
    expect(screen.getByText('17:35')).toBeInTheDocument();
    expect(screen.getByText('17:38')).toBeInTheDocument();
  });

  it('★ history 없는 단계는 "—" 표시 (분 단위 추정 X — ADR-010)', () => {
    render(<OrderTimeline current="ORDERED" history={{ ORDERED: '17:30' }} />);
    // 4 미진입 단계 → "—" 4번 (TRANSFER_REPORTED / PAID / COOKING / READY)
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(4);
  });

  it('showMiniview=false 시 미니뷰 영역 안 보임 (history 시각 미렌더)', () => {
    render(
      <OrderTimeline
        current="ORDERED"
        showMiniview={false}
        history={{ ORDERED: '17:30' }}
      />,
    );
    expect(screen.queryByText('17:30')).not.toBeInTheDocument();
  });

  it('★ showMiniview=false 시 aria-label="단계별 진입 시각" <ul> 미렌더', () => {
    render(
      <OrderTimeline
        current="COOKING"
        showMiniview={false}
        history={{ ORDERED: '17:30', COOKING: '17:38' }}
      />,
    );
    expect(screen.queryByLabelText('단계별 진입 시각')).not.toBeInTheDocument();
  });

  it('history 빈 객체 시 미니뷰 전부 "—"', () => {
    render(<OrderTimeline current="ORDERED" history={{}} />);
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(5);
  });

  it('forwardRef 로 DOM 참조 전달', () => {
    const ref = createRef();
    render(<OrderTimeline ref={ref} current="ORDERED" />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(
      <OrderTimeline current="COOKING" history={{ ORDERED: '17:30', COOKING: '17:38' }} />,
    );
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });

  // ── find_error_v3 P2 (Codex 리뷰 2026-05-18) — 미니뷰는 CSS dot, 이모지 미노출 ──
  it('★ P2: 미니뷰는 .timeline-mini-dot CSS dot으로 표시 (✅/🔄/⏳ 이모지 미노출)', () => {
    const { container } = render(
      <OrderTimeline current="COOKING" history={{ ORDERED: '17:30', COOKING: '17:38' }} />,
    );
    expect(container.querySelectorAll('.timeline-mini-dot').length).toBe(5);
    expect(container.querySelectorAll('.timeline-mini-dot--done').length).toBe(3);
    expect(container.querySelectorAll('.timeline-mini-dot--current').length).toBe(1);
    expect(container.querySelectorAll('.timeline-mini-dot--future').length).toBe(1);
    const text = container.textContent;
    expect(text).not.toMatch(/[✅🔄⏳]/);
  });
});
