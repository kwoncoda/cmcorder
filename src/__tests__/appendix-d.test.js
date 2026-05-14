// 부록 D — vercel-react-best-practices 회귀 매트릭스 자동화.
//
// D.4 (Zustand 셀렉터 강제), D.7 (Effect → Event 분리 경고),
// D.8 (페이지 컴포넌트 ≤120줄), D.2 (Framer Motion 미설치).
// 그 외 항목은:
//   - D.1 Profiler — 수동 (실 브라우저, D-1 리허설 카드)
//   - D.3 StrictMode — `npm run build` 통과로 갈음
//   - D.5 코드 스플릿 — Phase 0.3 라우팅 셸에서 검증
//   - D.6 Barrel import — 기존 bundle.test.js의 lucide 회귀로 커버
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');
const ROOT = process.cwd();

function walkDir(dir, ext) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      out.push(...walkDir(p, ext));
    } else if (ext.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

describe('부록 D — vercel-react-best-practices 회귀', () => {
  describe('D.2 — 번들 위생 (Framer Motion 미설치)', () => {
    it('★ Framer Motion이 dependencies/devDependencies에 없다', () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      expect(deps['framer-motion']).toBeUndefined();
    });
  });

  describe('D.4 — Zustand 셀렉터 강제 패턴', () => {
    it('★ `const { ... } = use(Cart|Ui|BusinessState)Store()` 디스트럭처 0건', () => {
      const files = walkDir(SRC, /\.(js|jsx)$/);
      const violations = [];
      for (const file of files) {
        // 정의 파일 자신과 회귀 테스트 자신은 제외.
        if (file.includes(`${SRC}\\store\\`) || file.includes(`${SRC}/store/`)) continue;
        const content = readFileSync(file, 'utf-8');
        const matches = content.match(
          /const\s*\{[^}]+\}\s*=\s*use(Cart|Ui|BusinessState)Store\s*\(\s*\)/g,
        );
        if (matches) violations.push({ file: relative(ROOT, file), matches });
      }
      expect(violations).toEqual([]);
    });

    it('★ `useUiStore()` / `useBusinessStateStore()` 인자 없는 호출 0건', () => {
      const files = walkDir(SRC, /\.(js|jsx)$/);
      const violations = [];
      for (const file of files) {
        // 정의 파일과 자기 자신 제외.
        if (file.includes(`${SRC}\\store\\`) || file.includes(`${SRC}/store/`)) continue;
        const content = readFileSync(file, 'utf-8');
        const m1 = content.match(/useUiStore\s*\(\s*\)/g);
        const m2 = content.match(/useBusinessStateStore\s*\(\s*\)/g);
        if (m1 || m2) {
          violations.push({
            file: relative(ROOT, file),
            matches: [...(m1 ?? []), ...(m2 ?? [])],
          });
        }
      }
      expect(violations).toEqual([]);
    });
  });

  describe('D.7 — Effect → Event 분리 (경고)', () => {
    it('useEffect 안 부수효과(navigate/vibrate/toast) 정당성 검토 — 화이트리스트', () => {
      // 합법 케이스 — render 도중 navigate 금지 정책에 따른 401/404 redirect.
      // 새 위반이 추가되면 화이트리스트 갱신하고 정당성 주석을 코드에 추가할 것.
      const allowedPatterns = [
        // 401 인증 만료 → 로그인 redirect (모든 admin 페이지).
        /if\s*\(.*error.*\.status\s*===\s*401\)\s*\{?\s*navigate\(['"]\/admin\/login['"]\)/,
        // 404 not found → /error/404 redirect.
        /if\s*\(is404\)\s*navigate\(['"]\/error\/404['"]/,
        /navigate\(['"]\/error\/404['"]/,
      ];
      const files = walkDir(SRC, /\.(js|jsx)$/);
      const violations = [];
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        // useEffect 블록 안의 navigate/vibrate/toast 직접 호출.
        const re = /useEffect\s*\([^)]*=>\s*\{[\s\S]*?(navigate|navigator\.vibrate|toast)\s*\(/g;
        const matches = content.match(re) ?? [];
        for (const m of matches) {
          const allowed = allowedPatterns.some((p) => p.test(m));
          if (!allowed) violations.push({ file: relative(ROOT, file), match: m.slice(0, 200) });
        }
      }
      expect(violations).toEqual([]);
    });
  });

  describe('D.8 — 페이지 컴포넌트 크기 (≤120줄)', () => {
    it('★ src/pages/**/*.jsx 모두 ≤120줄', () => {
      const pagesDir = join(SRC, 'pages');
      const pages = walkDir(pagesDir, /\.jsx$/);
      const oversized = [];
      for (const p of pages) {
        const lines = readFileSync(p, 'utf-8').split('\n').length;
        if (lines > 120) oversized.push({ file: relative(ROOT, p), lines });
      }
      expect(oversized).toEqual([]);
    });
  });
});
