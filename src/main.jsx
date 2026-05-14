// Vite 진입점. React 18 createRoot + StrictMode.
// 디자인 토큰(tokens.css) + 전역 스타일(globals.css, Tailwind 포함) 적재.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
