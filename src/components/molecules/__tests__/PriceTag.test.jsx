// Task 2.2 — PriceTag molecule 단위 테스트.
// COMPONENT_GUIDE §3.2 / DESIGN §5.4.
// 가격 표시 — 천 단위 콤마 (`Intl.NumberFormat('ko-KR')`) + font-mono tabular-nums.
// props: value (필수 number) · unit ('won'|'none', default 'won') · strikethrough ·
//        size ('sm'|'md'|'lg') · negative · className.
// 접근성: 텍스트 자체가 의미 — 별도 role/aria-label 불필요.
//         단, axe-core 위반 0건.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import PriceTag from '../PriceTag.jsx';

describe('PriceTag', () => {
  // ── 기본 — 천 단위 콤마 + 원 ──
  it('value=6000 → "6,000원" 렌더', () => {
    render(<PriceTag value={6000} />);
    expect(screen.getByText('6,000원')).toBeInTheDocument();
  });

  // ── unit='none' — 화폐 단위 생략 ──
  it('unit="none" 시 단위 없이 숫자만 렌더', () => {
    render(<PriceTag value={6000} unit="none" />);
    expect(screen.getByText('6,000')).toBeInTheDocument();
    expect(screen.queryByText(/원/)).not.toBeInTheDocument();
  });

  // ── 0원 ──
  it('value=0 → "0원"', () => {
    render(<PriceTag value={0} />);
    expect(screen.getByText('0원')).toBeInTheDocument();
  });

  // ── strikethrough — 옛 가격 ──
  it('strikethrough 시 line-through 클래스 적용', () => {
    const { container } = render(<PriceTag value={6000} strikethrough />);
    const tag = container.querySelector('span');
    expect(tag.className).toMatch(/\bline-through\b/);
  });

  // ── negative — 할인 ──
  it('negative 시 "-" 접두 + danger 색', () => {
    const { container } = render(<PriceTag value={6000} negative />);
    expect(screen.getByText('-6,000원')).toBeInTheDocument();
    const tag = container.querySelector('span');
    expect(tag.className).toMatch(/text-danger/);
  });

  // ── font-mono tabular-nums (디자인 가이드) ──
  it('font-mono + tabular-nums 클래스 적용', () => {
    const { container } = render(<PriceTag value={6000} />);
    const tag = container.querySelector('span');
    expect(tag.className).toMatch(/\bfont-mono\b/);
    expect(tag.className).toMatch(/\btabular-nums\b/);
  });

  // ── forwardRef ──
  it('forwardRef 로 DOM span 참조 전달', () => {
    const ref = createRef();
    render(<PriceTag ref={ref} value={1000} />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  // ── a11y ──
  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<PriceTag value={6000} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
