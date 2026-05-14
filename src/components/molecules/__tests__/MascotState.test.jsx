// Task 2.4 — MascotState molecule 단위 테스트.
// 5종 마스코트 (default/dispatch/cooking/arrive/canceled) + cross-fade 200ms + cooking idle 흔들.
//
// 핵심 회귀 (★):
//   1. useFallback=true (기본) — 자산 미수령 단계, 처음부터 이모지 fallback (img 없음).
//   2. useFallback=false + onError — 이미지 실패 시 이모지로 안전망 fallback.
//   3. cooking state 한정 idle 흔들 (.mascot-cooking-idle), 다른 state 미적용.
//   4. mascot-fade 클래스 — cross-fade 200ms.
//   5. 5 state 각각 aria-label 한글 매핑 (기본/출동/조리 중/도착/취소).
//   6. reduced motion 은 components.css media query 가 처리 (모션 정적화).
//
// 관련 결정: DESIGN §10 + 결정 c (자산 D-3 미수령 → 이모지 fallback)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import MascotState from '../MascotState.jsx';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('MascotState', () => {
  // ── 5 state aria-label 한글 매핑 ──
  it.each([
    ['default', '기본'],
    ['dispatch', '출동'],
    ['cooking', '조리 중'],
    ['arrive', '도착'],
    ['canceled', '취소'],
  ])('state=%s 시 aria-label "치킨이닭 마스코트 — %s"', (state, label) => {
    const { getByLabelText } = render(<MascotState state={state} useFallback />);
    expect(getByLabelText(`치킨이닭 마스코트 — ${label}`)).toBeInTheDocument();
  });

  // ── useFallback=true (기본, 자산 미수령 단계) — 처음부터 이모지 ──
  it('useFallback=true 시 처음부터 이모지 렌더 (img 없음)', () => {
    const { container } = render(<MascotState state="default" useFallback />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[role="img"]')).toBeInTheDocument();
  });

  // ── useFallback=false + 정상 환경 — img 렌더 ──
  it('useFallback=false + 이미지 로드 성공 시 img 렌더', () => {
    const { container } = render(<MascotState state="default" useFallback={false} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img.alt).toBe('치킨이닭 마스코트 — 기본');
  });

  // ── useFallback=false + onError 시 이모지 안전망 ──
  it('useFallback=false + 이미지 onError 시 이모지 fallback', () => {
    const { container } = render(<MascotState state="default" useFallback={false} />);
    const img = container.querySelector('img');
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[role="img"]')).toBeInTheDocument();
  });

  // ── cooking state — idle 흔들 클래스 ──
  it('cooking 상태 시 mascot-cooking-idle 클래스 적용', () => {
    const { container } = render(<MascotState state="cooking" useFallback />);
    expect(container.firstChild.className).toMatch(/\bmascot-cooking-idle\b/);
  });

  // ── cooking 외 state — idle 클래스 미적용 ──
  it('cooking 외 state 는 idle 클래스 미적용', () => {
    const { container } = render(<MascotState state="dispatch" useFallback />);
    expect(container.firstChild.className).not.toMatch(/\bmascot-cooking-idle\b/);
  });

  // ── cross-fade 200ms ──
  it('mascot-fade 클래스 (cross-fade 200ms)', () => {
    const { container } = render(<MascotState state="default" useFallback />);
    expect(container.firstChild.className).toMatch(/\bmascot-fade\b/);
  });

  // ── size 클래스 매핑 (sm/md/lg) ──
  it('size=sm 시 w-16, size=lg 시 w-32 클래스 적용', () => {
    const { container, rerender } = render(
      <MascotState state="default" size="sm" useFallback />,
    );
    expect(container.firstChild.className).toMatch(/\bw-16\b/);
    rerender(<MascotState state="default" size="lg" useFallback />);
    expect(container.firstChild.className).toMatch(/\bw-32\b/);
  });

  // ── 알 수 없는 state → default fallback ──
  it('알 수 없는 state 시 default 로 fallback', () => {
    const { getByLabelText } = render(
      <MascotState state="unknown" useFallback />,
    );
    expect(getByLabelText('치킨이닭 마스코트 — 기본')).toBeInTheDocument();
  });

  // ── 명세 회귀: fallback 이모지 default state 기준 (결정 c) ──
  it('결정 c — default state fallback 이모지는 🪖 (헬멧)', () => {
    const { getByLabelText } = render(
      <MascotState state="default" useFallback />,
    );
    expect(getByLabelText('치킨이닭 마스코트 — 기본').textContent).toBe('🪖');
  });

  // ── forwardRef ──
  it('forwardRef 로 DOM div 참조 전달', () => {
    const ref = createRef();
    render(<MascotState ref={ref} state="default" useFallback />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  // ── a11y ──
  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<MascotState state="cooking" useFallback />);
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });

  // ── className passthrough ──
  it('className prop passthrough', () => {
    const { container } = render(
      <MascotState state="default" useFallback className="extra-cls" />,
    );
    expect(container.firstChild.className).toMatch(/\bextra-cls\b/);
  });
});
