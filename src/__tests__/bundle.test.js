// Task 0.4 — 번들 위생 회귀.
// production 번들(dist/assets/*.js)에 axe-core / @axe-core/react 가
// 포함되지 않는지 강제한다. main.jsx의 `if (import.meta.env.DEV)` + 동적 import
// 패턴이 회귀하면 즉시 실패한다.
// - dist/ 가 없거나 src 변경 이후라면 `npm run build` 를 한 번 실행.
// - 검사 패턴: 'axe-core' 또는 '@axe-core/' 문자열 (가짜 매칭 — 'taxe', 'maxe' 등 회피).
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = process.cwd();
const distAssets = resolve(projectRoot, 'dist/assets');
const srcDir = resolve(projectRoot, 'src');

function latestMtime(dir) {
  let max = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = latestMtime(p);
      if (sub > max) max = sub;
    } else {
      const m = statSync(p).mtimeMs;
      if (m > max) max = m;
    }
  }
  return max;
}

function needsBuild() {
  if (!existsSync(distAssets)) return true;
  const distMtime = latestMtime(distAssets);
  const srcMtime = latestMtime(srcDir);
  return srcMtime > distMtime;
}

describe('번들 위생 — axe-core dev-only', () => {
  beforeAll(() => {
    if (needsBuild()) {
      // CI/로컬 모두 stale dist 회피. 첫 호출은 최대 30초 정도 걸림.
      // - vitest 가 부모 process 에 `NODE_ENV=test` 를 주입하므로 그대로 상속하면
      //   vite 가 dev 빌드를 만든다. 자식 process 환경에서 NODE_ENV='production'
      //   으로 강제해야 axe-core 가 트리 셰이킹된다.
      execSync('npm run build', {
        cwd: projectRoot,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' },
      });
    }
  }, 60_000);

  it('production 번들에 axe-core / @axe-core/react 가 포함되지 않는다', () => {
    const files = readdirSync(distAssets).filter((f) => f.endsWith('.js'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(resolve(distAssets, file), 'utf-8');
      // minified 번들 안에서 axe 식별자를 찾는다 — 패키지 이름은 minify 후에도
      // 일부 메타(주석/require/내부 식별자)로 흔적이 남는다.
      expect(
        content,
        `${file} 가 axe-core 흔적을 포함`,
      ).not.toMatch(/axe-core|@axe-core\//);
    }
  });
});
