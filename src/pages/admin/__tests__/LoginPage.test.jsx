// Task 5.1 — LoginPage 단위 테스트 (8 케이스).
//
// 회귀 보호:
//  - PIN input + 로그인 버튼 렌더
//  - PIN 5자리 시 버튼 disabled (6자리 강제)
//  - PIN 6자리 시 버튼 활성
//  - 정상 로그인 시 /admin/dashboard 이동
//  - 401 응답 시 "PIN이 일치하지 않습니다" 인라인
//  - 500 서버 에러 시 일반 메시지
//  - PIN 숫자가 아닌 입력은 거부 (replace /\D/g)
//  - a11y 위반 없음 (axe-core)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';

// apiFetch mock — 서버 호출 격리.
vi.mock('../../../api/client.js', async () => {
  const actual = await vi.importActual('../../../api/client.js');
  return { ...actual, apiFetch: vi.fn() };
});
import { apiFetch, ApiError } from '../../../api/client.js';

// useNavigate mock — 라우터 이동 격리.
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import LoginPage from '../LoginPage.jsx';

beforeEach(() => {
  navigateMock.mockReset();
  apiFetch.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('LoginPage', () => {
  const renderPage = () => render(<MemoryRouter><LoginPage /></MemoryRouter>);

  it('PIN input + 로그인 버튼 렌더', () => {
    renderPage();
    expect(screen.getByTestId('pin-input')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('★ 카드 상단 웹로고 이미지 렌더 (front_closed_design)', () => {
    renderPage();
    const logo = screen.getByAltText('치킨이닭 웹 로고');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/web-logo.png');
  });

  it('★ PIN 5자리 시 버튼 disabled', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('pin-input'), { target: { value: '12345' } });
    expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled();
  });

  it('PIN 6자리 시 버튼 활성', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('pin-input'), { target: { value: '123456' } });
    expect(screen.getByRole('button', { name: '로그인' })).not.toBeDisabled();
  });

  it('★ 정상 로그인 시 /admin/dashboard 이동', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true });
    renderPage();
    fireEvent.change(screen.getByTestId('pin-input'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/admin/dashboard'));
  });

  it('★ 401 응답 시 "PIN이 일치하지 않습니다" 표시', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError('Unauthorized', { status: 401 }));
    renderPage();
    fireEvent.change(screen.getByTestId('pin-input'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(screen.getByText('PIN이 일치하지 않습니다')).toBeInTheDocument());
  });

  it('500 서버 에러 시 일반 메시지', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError('서버 오류', { status: 500 }));
    renderPage();
    fireEvent.change(screen.getByTestId('pin-input'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => expect(screen.getByText('서버 오류')).toBeInTheDocument());
  });

  it('PIN 숫자가 아닌 입력은 거부 (replace /\\D/g)', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('pin-input'), { target: { value: '12ab34' } });
    expect(screen.getByTestId('pin-input')).toHaveValue('1234');
  });

  it('a11y 위반 없음', async () => {
    const { container } = renderPage();
    const r = await axe(container);
    expect(r).toHaveNoViolations();
  }, 15_000);
});
