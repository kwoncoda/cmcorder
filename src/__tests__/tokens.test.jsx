// 디자인 토큰 회귀 테스트
// docs/DESIGN.md §4.3 실측 표 + 2026-05-14 카드 muted 명도 조정값(#48402C) 기준
// jsdom은 CSS 변수의 computed style 해석을 보장하지 않으므로,
// tokens.css 원문을 fs로 읽어 정규식으로 hex 값을 매칭한다.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const tokensCssPath = resolve(process.cwd(), 'src/styles/tokens.css');
const globalsCssPath = resolve(process.cwd(), 'src/styles/globals.css');

describe('디자인 토큰 — 9 컬러 조합 회귀', () => {
  const tokensCss = readFileSync(tokensCssPath, 'utf-8');

  it.each([
    ['--color-bg', '#2E3A26'],
    ['--color-surface', '#3A4A2E'],
    ['--color-card-bg', '#C8B894'],
    ['--color-card-muted', '#48402C'],
    ['--color-accent', '#F4D200'],
    ['--color-danger', '#C73E1D'],
    ['--color-success', '#5A8C42'],
    ['--color-warning', '#E59B0C'],
    ['--stamp-red', '#B5301A'],
  ])('%s 토큰은 %s 이다', (variable, expectedHex) => {
    const pattern = new RegExp(
      `${variable.replace(/-/g, '\\-')}\\s*:\\s*(#[0-9A-Fa-f]{3,6})`,
    );
    const match = tokensCss.match(pattern);
    expect(match, `${variable} 정의가 tokens.css에 없음`).not.toBeNull();
    expect(match[1].toUpperCase()).toBe(expectedHex.toUpperCase());
  });
});

describe('Reduced motion 미디어 쿼리', () => {
  it('globals.css에 prefers-reduced-motion 블록이 있다', () => {
    const globalsCss = readFileSync(globalsCssPath, 'utf-8');
    expect(globalsCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(globalsCss).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(globalsCss).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });
});
