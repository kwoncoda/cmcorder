// Task 2.2 — MenuFallback molecule 단위 테스트.
// COMPONENT_GUIDE §3.7 / ADR-006 (PUBG 일러스트 미수령 시 분류 이모지 fallback).
// 분류별 이모지:
//   chicken → 🍗 (bandage·first-aid·med-kit·syringe — 닭류)
//   side    → 🍟 (defib·adrenaline — 사이드)
//   drink   → 🥤 (painkiller·energy — 음료)
// 알 수 없는 category fallback: ❓.
// aria-label="{category} {name} 일러스트 (대체)".
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import MenuFallback from '../MenuFallback.jsx';

describe('MenuFallback', () => {
  // ── chicken → 🍗 + name ──
  it('category="chicken" → 🍗 이모지 + 이름 텍스트', () => {
    render(<MenuFallback category="chicken" name="자라쥬" />);
    expect(screen.getByText('🍗')).toBeInTheDocument();
    expect(screen.getByText('자라쥬')).toBeInTheDocument();
  });

  // ── side → 🍟 ──
  it('category="side" → 🍟 이모지', () => {
    render(<MenuFallback category="side" name="감자튀김" />);
    expect(screen.getByText('🍟')).toBeInTheDocument();
    expect(screen.getByText('감자튀김')).toBeInTheDocument();
  });

  // ── drink → 🥤 ──
  it('category="drink" → 🥤 이모지', () => {
    render(<MenuFallback category="drink" name="콜라" />);
    expect(screen.getByText('🥤')).toBeInTheDocument();
    expect(screen.getByText('콜라')).toBeInTheDocument();
  });

  // ── 알 수 없는 category → ❓ ──
  it('알 수 없는 category → ❓ fallback', () => {
    render(<MenuFallback category="unknown" name="알 수 없음" />);
    expect(screen.getByText('❓')).toBeInTheDocument();
  });

  // ── aria-label 패턴 ──
  it('aria-label="{category} {name} 일러스트 (대체)" 적용', () => {
    render(<MenuFallback category="chicken" name="자라쥬" />);
    const wrap = screen.getByLabelText('chicken 자라쥬 일러스트 (대체)');
    expect(wrap).toBeInTheDocument();
  });

  // ── forwardRef ──
  it('forwardRef 로 DOM 참조 전달', () => {
    const ref = createRef();
    render(<MenuFallback ref={ref} category="drink" name="콜라" />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  // ── a11y ──
  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<MenuFallback category="chicken" name="자라쥬" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
