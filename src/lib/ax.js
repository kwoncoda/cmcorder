// 개발 모드에서만 axe-core를 React DOM에 attach해 콘솔에 a11y violation을 출력한다.
// production 번들에 포함되지 않도록 main.jsx에서 `if (import.meta.env.DEV)` 가드 +
// 동적 `import('./lib/ax.js')` 로만 진입한다.
// 1000 ms 디바운스로 라우트 전환 시 중복 검사 비용을 줄인다.
export async function initAxe(React, ReactDOM) {
  if (typeof window === 'undefined') return;
  const axe = (await import('@axe-core/react')).default;
  axe(React, ReactDOM, 1000);
}
