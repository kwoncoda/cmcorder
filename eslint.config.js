// ESLint 9 flat config — 본 PR 에서 react-hooks/rules-of-hooks 1개 룰만 활성.
// (2026-05-17, MenuPage #310 재발 방지)
//
// 의도적 최소 범위:
//   - rules-of-hooks 만 켬 → MenuPage 같은 hook-after-early-return 패턴을 빌드 직전에 차단.
//   - exhaustive-deps 미설정 — 이 프로젝트엔 이미 useApi.js:71 처럼 정당한
//     eslint-disable 주석이 있어 D-day 직전 켜면 노이즈 큼. 별도 PR 에서 다룸.
//   - 그 외 (react, jsx-a11y, import, style 등) 어떤 룰도 켜지 않음.
//
// 사용: `npm run lint` → exit 0 + 위반 0건 이어야 함.
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
