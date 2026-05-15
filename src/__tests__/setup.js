// Vitest 전역 setup.
// - @testing-library/jest-dom 매처(`toBeInTheDocument` 등)를 Vitest expect에 주입한다.
// - vitest-axe 매처(`toHaveNoViolations`)도 함께 주입 — Task 0.4 (a11y 회귀).
// - P2-3 (Codex 리뷰): jsdom HTMLCanvasElement.getContext 미구현으로 인한
//   axe-core color-contrast 검사의 stderr 경고/오작동을 제거.
//   jsdom 환경에서는 색대비 검증이 신뢰 불가하므로 noop 2D context를 주입.
import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);

// P2-3: HTMLCanvasElement.getContext('2d')를 stub.
// axe-core가 색대비 측정을 위해 호출 → null 반환 시 내부 경고 + 색대비 룰 false-positive.
// 실제 색대비는 디자인 토큰(`docs/DESIGN.md`)과 빌드 단계 보장 — 본 검사는 의미 없음.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function getContextStub() {
    return {
      // 최소 메서드 — axe-core가 호출하는 것들. 실패 없이 빈 값 반환.
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: new Array(4) }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      fillText: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {},
    };
  };
}
