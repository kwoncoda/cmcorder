// Task 2.2 — StatusChip molecule 단위 테스트.
// COMPONENT_GUIDE §3.4 / DESIGN §5.4 (8 상태 한글 카피).
// 8 주문 상태(영문 코드 → 한글):
//   ORDERED=주문 접수 · TRANSFER_REPORTED=입금 확인 중 · PAID=조리 시작 ·
//   COOKING=조리 중 · READY=수령 대기 · DONE=수령 완료 · HOLD=보류 · CANCELED=취소.
// 이모지는 aria-hidden (decorative) + 한글 라벨이 SR이 읽음.
// 알 수 없는 status fallback: ORDERED.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import StatusChip from '../StatusChip.jsx';

describe('StatusChip', () => {
  // ── 8 status 각 라벨 + 이모지 매핑 ──
  it.each([
    ['ORDERED',           '주문 접수',     '⏳'],
    ['TRANSFER_REPORTED', '입금 확인 중',  '💸'],
    ['PAID',              '조리 시작',     '✓'],
    ['COOKING',           '조리 중',       '🔥'],
    ['READY',             '수령 대기',     '✅'],
    ['DONE',              '수령 완료',     '🎉'],
    ['HOLD',              '보류',          '⚠️'],
    ['CANCELED',          '취소',          '❌'],
  ])('status=%s 시 "%s" 라벨 + "%s" 이모지', (status, label, icon) => {
    render(<StatusChip status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(icon)).toBeInTheDocument();
  });

  // ── 알 수 없는 status fallback ──
  it('알 수 없는 status 시 ORDERED fallback', () => {
    render(<StatusChip status="UNKNOWN_STATUS" />);
    expect(screen.getByText('주문 접수')).toBeInTheDocument();
  });

  // ── size 클래스 (sm/md) ──
  it('size="sm" 클래스 적용', () => {
    const { container } = render(<StatusChip status="ORDERED" size="sm" />);
    const chip = container.querySelector('span');
    expect(chip.className).toMatch(/\btext-2xs\b/);
  });

  it('size="md" (기본) 클래스 적용', () => {
    const { container } = render(<StatusChip status="ORDERED" />);
    const chip = container.querySelector('span');
    expect(chip.className).toMatch(/\btext-xs\b/);
  });

  // ── 이모지는 aria-hidden (decorative — 텍스트가 SR이 읽음) ──
  it('이모지는 aria-hidden=true 적용 (텍스트가 SR이 읽음)', () => {
    render(<StatusChip status="COOKING" />);
    const emoji = screen.getByText('🔥');
    expect(emoji).toHaveAttribute('aria-hidden', 'true');
  });

  // ── forwardRef ──
  it('forwardRef 로 DOM span 참조 전달', () => {
    const ref = createRef();
    render(<StatusChip ref={ref} status="DONE" />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  // ── className passthrough ──
  it('className prop 으로 추가 클래스 합성', () => {
    const { container } = render(
      <StatusChip status="READY" className="extra-class" />,
    );
    const chip = container.querySelector('span');
    expect(chip.className).toContain('extra-class');
  });

  // ── a11y ──
  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<StatusChip status="COOKING" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
