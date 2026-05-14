// Task 2.3 — DogTagFrame molecule 단위 테스트.
// 절정 컴포넌트: 떨어지는 모션 600ms + sessionStorage 단발 (DESIGN §9.6 + 결정 h).
//
// 핵심 회귀 (★):
//   1. *첫 렌더부터* dropping 클래스 결정 — useEffect 후행 setState 시 한 프레임 깜박 회귀.
//      § 3.5 4조 (rerender-derived-state-no-effect): useState(() => ...) 초기화 함수 패턴.
//   2. sessionStorage 키 `dogtag-shown-{no}` 단발 (재방문 시 정적 표시).
//   3. reduced motion 시 진동·모션 X.
//   4. 정상 환경 + dropping=true 시 진동 [60, 30, 60] 1회.
//   5. role=status + aria-live=polite (SR 안내).
//
// 시안: docs/design-bundle/components.jsx line 48-75 (DogTag) — useEffect 패턴을 *변경*.
// 관련 결정: DESIGN §1·§9.3·§9.6·ADR-026 §1·결정 h + §3.5 4조
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { createRef } from 'react';
import DogTagFrame from '../DogTagFrame.jsx';

beforeEach(() => {
  // 각 케이스 격리 — sessionStorage / navigator.vibrate / matchMedia spy 모두 리셋.
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('DogTagFrame', () => {
  // ── ★ 회귀: 첫 렌더부터 dropping 클래스 (깜박 X) ──
  it('첫 진입 시 dropping 클래스 *첫 렌더부터* 포함 (깜박 회귀 방지)', () => {
    const { container } = render(<DogTagFrame no={17} date="2026-05-20" dropping />);
    // useEffect 후행 setState 시 첫 렌더에는 클래스 없음 → 회귀. useState 초기화 함수만 OK.
    expect(container.firstChild.className).toMatch(/\bdogtag-drop\b/);
  });

  // ── sessionStorage 단발 ──
  it('첫 진입 후 sessionStorage 키 `dogtag-shown-{no}` 저장', () => {
    render(<DogTagFrame no={17} date="2026-05-20" dropping />);
    expect(sessionStorage.getItem('dogtag-shown-17')).toBe('1');
  });

  it('재방문 시 (sessionStorage 키 존재) dropping 클래스 없음 — 정적 표시', () => {
    sessionStorage.setItem('dogtag-shown-17', '1');
    const { container } = render(<DogTagFrame no={17} date="2026-05-20" dropping />);
    expect(container.firstChild.className).not.toMatch(/\bdogtag-drop\b/);
  });

  it('dropping=false 시 모션 비활성 + sessionStorage 미저장', () => {
    const { container } = render(<DogTagFrame no={17} date="2026-05-20" />);
    expect(container.firstChild.className).not.toMatch(/\bdogtag-drop\b/);
    expect(sessionStorage.getItem('dogtag-shown-17')).toBeNull();
  });

  // ── pulse (호명 형광 옐로 깜박) ──
  it('pulse=true 시 pulse 클래스 적용', () => {
    sessionStorage.setItem('dogtag-shown-17', '1'); // dropping 격리
    const { container } = render(<DogTagFrame no={17} date="2026-05-20" pulse />);
    expect(container.firstChild.className).toMatch(/\bdogtag-pulse\b/);
  });

  // ── 텍스트 렌더 ──
  it('주문번호 + 총수 + 일자 렌더 (DESIGN §5.1)', () => {
    const { getByText } = render(<DogTagFrame no={17} total={120} date="2026-05-20" />);
    expect(getByText('#17')).toBeInTheDocument();
    expect(getByText('/120')).toBeInTheDocument();
    expect(getByText('2026-05-20')).toBeInTheDocument();
  });

  // ── reduced motion 시 진동 X ──
  it('reduced motion 시 vibrate 호출 X', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      writable: true,
      value: vibrateSpy,
    });
    render(<DogTagFrame no={17} date="2026-05-20" dropping />);
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  // ── 정상 환경 + dropping=true 시 진동 1회 ──
  it('정상 환경 + dropping=true 시 vibrate [60, 30, 60] 호출', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      writable: true,
      value: vibrateSpy,
    });
    render(<DogTagFrame no={17} date="2026-05-20" dropping />);
    expect(vibrateSpy).toHaveBeenCalledWith([60, 30, 60]);
  });

  // ── 접근성: role=status + aria-live=polite ──
  it('role=status + aria-live=polite (SR 안내)', () => {
    const { container } = render(<DogTagFrame no={17} date="2026-05-20" />);
    expect(container.firstChild).toHaveAttribute('role', 'status');
    expect(container.firstChild).toHaveAttribute('aria-live', 'polite');
  });

  // ── a11y ──
  it('a11y 위반 없음 (axe-core)', async () => {
    const { container } = render(<DogTagFrame no={17} date="2026-05-20" />);
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  });

  // ── forwardRef ──
  it('forwardRef 로 DOM div 참조 전달', () => {
    const ref = createRef();
    render(<DogTagFrame ref={ref} no={17} date="2026-05-20" />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  // ── 폰트 (DESIGN §5.1): Pretendard Black 주문번호 + JetBrains Mono 일자 ──
  it('주문번호는 font-display font-black, 일자는 font-mono 클래스 적용', () => {
    const { getByText } = render(<DogTagFrame no={17} total={120} date="2026-05-20" />);
    // #17 의 부모 wrapper 가 font-display font-black 보유 (DESIGN §5.1).
    const noWrapper = getByText('#17').parentElement;
    expect(noWrapper.className).toMatch(/\bfont-display\b/);
    expect(noWrapper.className).toMatch(/\bfont-black\b/);
    // 일자는 font-mono (JetBrains Mono — tabular-nums).
    const dateEl = getByText('2026-05-20');
    expect(dateEl.className).toMatch(/\bfont-mono\b/);
  });
});
