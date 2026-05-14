// Smoke 테스트 — 부트스트랩 셸이 살아 있는지 확인.
// App.jsx가 환영 메시지를 렌더하면 통과.
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App.jsx';

describe('App 부트스트랩 셸', () => {
  it('환영 메시지를 렌더한다', () => {
    render(<App />);
    expect(screen.getByText(/환영합니다/)).toBeInTheDocument();
  });
});
