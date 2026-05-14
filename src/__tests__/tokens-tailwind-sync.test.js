// tokens.css ↔ tailwind.config.js 동기화 회귀 (Task 2.2 리뷰 fix — I-1).
// 배경: tailwind.config.js extend 누락 시 text-2xs / rounded-pill 등 클래스가
//   빌드 CSS에 생성되지 않아 컴포넌트(StatusChip·CountBadge·MenuFallback) size prop이
//   no-op이 되는 사고 재발 방지.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const tokensCss = readFileSync(
  resolve(process.cwd(), 'src/styles/tokens.css'),
  'utf-8',
);
const tailwindCfg = readFileSync(
  resolve(process.cwd(), 'tailwind.config.js'),
  'utf-8',
);

// 변수 이름 안에 들어가는 정규식 메타 문자를 이스케이프.
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('tokens.css ↔ tailwind.config.js 동기화', () => {
  it('모든 --text-* 변수가 tailwind fontSize 에 매핑됨', () => {
    const textVars = [
      ...new Set(
        [...tokensCss.matchAll(/--text-([\w-]+)\s*:/g)].map((m) => m[1]),
      ),
    ];
    expect(textVars.length, '--text-* 변수가 tokens.css 에 1개 이상 정의되어야 함').toBeGreaterThan(0);
    for (const v of textVars) {
      const pattern = new RegExp(`var\\(--text-${escapeRe(v)}\\)`);
      expect(
        tailwindCfg,
        `--text-${v} 가 tailwind.config.js fontSize 에 var(--text-${v}) 로 매핑되어야 함`,
      ).toMatch(pattern);
    }
  });

  it('모든 --space-* 변수가 tailwind spacing 에 매핑됨', () => {
    const spaceVars = [
      ...new Set(
        [...tokensCss.matchAll(/--space-([\w-]+)\s*:/g)].map((m) => m[1]),
      ),
    ];
    expect(spaceVars.length).toBeGreaterThan(0);
    for (const v of spaceVars) {
      const pattern = new RegExp(`var\\(--space-${escapeRe(v)}\\)`);
      expect(
        tailwindCfg,
        `--space-${v} 매핑이 tailwind.config.js spacing 에 없음`,
      ).toMatch(pattern);
    }
  });

  it('--radius-pill / --radius-none 이 borderRadius 에 매핑됨', () => {
    expect(tailwindCfg).toMatch(/var\(--radius-pill\)/);
    expect(tailwindCfg).toMatch(/var\(--radius-none\)/);
  });

  it('모든 --radius-* 변수가 tailwind borderRadius 에 매핑됨', () => {
    const radiusVars = [
      ...new Set(
        [...tokensCss.matchAll(/--radius-([\w-]+)\s*:/g)].map((m) => m[1]),
      ),
    ];
    expect(radiusVars.length).toBeGreaterThan(0);
    for (const v of radiusVars) {
      const pattern = new RegExp(`var\\(--radius-${escapeRe(v)}\\)`);
      expect(
        tailwindCfg,
        `--radius-${v} 매핑이 tailwind.config.js borderRadius 에 없음`,
      ).toMatch(pattern);
    }
  });
});
