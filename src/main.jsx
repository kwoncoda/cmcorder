// Vite 진입점. React 18 createRoot + StrictMode.
// 디자인 토큰·전역 스타일·라우터는 Task 0.2 이후 단계에서 도입한다.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
