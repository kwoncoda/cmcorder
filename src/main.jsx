// Vite 진입점. React 18 createRoot + StrictMode.
// 디자인 토큰(tokens.css) + 전역 스타일(globals.css, Tailwind 포함) 적재.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as ReactDOM from 'react-dom';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/globals.css';

// 개발 모드에서만 axe-core를 동적 import — production 번들에서 완전히 제외.
// Task 0.4 §3.5 8조 (번들 위생): src/__tests__/bundle.test.js 회귀가 강제.
if (import.meta.env.DEV) {
  import('./lib/ax.js').then(({ initAxe }) => initAxe(React, ReactDOM));
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
