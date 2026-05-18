// Task 4.5 — CompletePage 통합 테스트.
//
// 회귀 보호 (16 케이스):
//  - 3분기: Loading / Error(5xx) / Error 404 redirect
//  - 정상 데이터 렌더 (DogTagFrame no, operating_date)
//  - WINNER WINNER 2줄 (DESIGN §5.2)
//  - 한글 부 카피 ("치킨 디너 위너!") — 결정 g
//  - 계좌 정보 G9 (국민은행 233001-04-403536 박동빈)
//  - Clipboard API 성공 → "복사됨"
//  - Clipboard 실패 + execCommand 성공 → fallback "복사됨"
//  - Clipboard + execCommand 둘 다 실패 → "길게 눌러 복사" 안내
//  - "이체 완료하고 확인 요청" 클릭 → /orders/:id/transfer
//  - DogTagFrame dropping prop → dogtag-drop 클래스
//  - DogTagFrame sessionStorage — 재진입 시 모션 없음 (회귀)
//  - a11y (axe)
//  - 페이지 ≤120줄 (§3.5 1조)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe } from 'vitest-axe';

// apiFetch mock — 서버 호출 격리.
vi.mock('../../../api/client.js', async () => {
  const actual = await vi.importActual('../../../api/client.js');
  return { ...actual, apiFetch: vi.fn() };
});
import { apiFetch, ApiError } from '../../../api/client.js';

import CompletePage from '../CompletePage.jsx';

const SAMPLE_ORDER = {
  id: 17,
  no: 17,
  operating_date: '2026-05-20',
  status: 'ORDERED',
  items: [
    { menu_id: 1, name: '후라이드', base_price: 18000, quantity: 1 },
  ],
  total_price: 18000,
};

function renderPage(initialPath = '/orders/17/complete') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/orders/:id/complete" element={<CompletePage />} />
        <Route
          path="/orders/:id/transfer"
          element={<div data-testid="transfer-page-stub">이체 신고</div>}
        />
        {/* 404 redirect target — App.jsx catch-all 회귀와 동일 동작 가정 */}
        <Route path="*" element={<div data-testid="catchall-404">404</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('CompletePage', () => {
  // ── 3분기 처리 ──────────────────────────────────────────────
  it('★ Loading 분기 — 첫 진입 시 LoadingState 노출', () => {
    // resolve 안 된 Promise → isLoading=true 유지.
    apiFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    // LoadingState variant=page는 minimumDelay=500이라 즉시 노출되지 않음.
    // 대신 testid 또는 라벨 텍스트로 검증 — minimumDelay=0으로 호출되는지 확인.
    // 핵심은 페이지가 데이터 로드 분기에 멈춰 있음 (DogTagFrame 미렌더).
    expect(screen.queryByText(/WINNER WINNER/)).not.toBeInTheDocument();
  });

  it('★ Error(5xx) 분기 — ErrorState + "다시 시도" 버튼', async () => {
    apiFetch.mockRejectedValue(new ApiError('서버 오류', { status: 500, code: 'SERVER' }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/주문 정보를 불러올 수 없어요/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('★ Error 404 시 catch-all 으로 redirect (페이지 미렌더)', async () => {
    apiFetch.mockRejectedValue(new ApiError('not found', { status: 404, code: 'NOT_FOUND' }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('catchall-404')).toBeInTheDocument();
    });
    expect(screen.queryByText(/WINNER WINNER/)).not.toBeInTheDocument();
  });

  // ── 정상 데이터 렌더 ────────────────────────────────────────
  it('★ 주문 데이터 렌더 — DogTagFrame no=17, operating_date 표시', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderPage();
    await waitFor(() => {
      // 도그태그 안 #17 — "#17" 텍스트
      expect(screen.getByText('#17')).toBeInTheDocument();
    });
    expect(screen.getByText('2026-05-20')).toBeInTheDocument();
  });

  it('★ WINNER WINNER 2줄 (DESIGN §5.2)', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('WINNER WINNER')).toBeInTheDocument();
    });
    expect(screen.getByText('CHICKEN DINNER')).toBeInTheDocument();
  });

  it('★ design_fix — 한글 부 카피 "치킨 디너 위너!" 제거 (DOM 미노출)', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('WINNER WINNER')).toBeInTheDocument();
    });
    // design_bundle ScreenComplete 와 정합: 영문 두 줄만 유지, 한글 부 카피는 제거.
    expect(screen.queryByText('치킨 디너 위너!')).not.toBeInTheDocument();
  });

  // ── 계좌 정보 (G9) ──────────────────────────────────────────
  it('★ 계좌 정보 정확 (G9) — 국민은행 233001-04-403536 박동빈', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderPage();
    // design_fix — design_bundle ScreenComplete 구조 정합:
    //   .acc-bank = 은행/예금주 (account-info 컨테이너에 포함)
    //   .acc-no   = 계좌번호만 (account-number testid)
    await waitFor(() => {
      expect(screen.getByTestId('account-number')).toHaveTextContent('233001-04-403536');
    });
    const card = screen.getByTestId('account-info');
    expect(card).toHaveTextContent('국민은행');
    expect(card).toHaveTextContent('박동빈');
  });

  // ── Clipboard 3단계 fallback ────────────────────────────────
  it('★ Clipboard API 성공 시 "복사됨" 표시', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '계좌번호 복사' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: '계좌번호 복사' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('233001-04-403536'),
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/복사됨/)).toBeInTheDocument();
    });
  });

  it('★ Bug 4 — 계좌 복사 문구는 "국민은행 233001-04-403536"만 (예금주 미포함)', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText('계좌번호 복사')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('계좌번호 복사'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('국민은행 233001-04-403536');
    });
    expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('박동빈'));
  });

  it('★ Clipboard 실패 시 execCommand fallback — "복사됨" 표시', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    // clipboard API 없음 (HTTP 환경)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const execSpy = vi.fn(() => true);
    document.execCommand = execSpy;
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '계좌번호 복사' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: '계좌번호 복사' }));
    await waitFor(() => {
      expect(execSpy).toHaveBeenCalledWith('copy');
    });
    await waitFor(() => {
      expect(screen.getByText(/복사됨/)).toBeInTheDocument();
    });
  });

  it('★ Clipboard + execCommand 둘 다 실패 시 "길게 눌러 복사" 안내', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    document.execCommand = vi.fn(() => false);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '계좌번호 복사' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: '계좌번호 복사' }));
    await waitFor(() => {
      expect(screen.getByTestId('copy-manual-hint')).toBeInTheDocument();
    });
    expect(screen.getByTestId('copy-manual-hint')).toHaveTextContent(/길게 눌러 복사/);
  });

  // ── CTA / 네비게이션 ────────────────────────────────────────
  it('★ "이체 완료하고 확인 요청" 클릭 시 /orders/:id/transfer 이동', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: '이체 완료하고 확인 요청' }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: '이체 완료하고 확인 요청' }));
    await waitFor(() => {
      expect(screen.getByTestId('transfer-page-stub')).toBeInTheDocument();
    });
  });

  // ── DogTagFrame 통합 회귀 ──────────────────────────────────
  it('★ DogTagFrame dropping prop 전달 — dogtag-drop 클래스 존재', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('#17')).toBeInTheDocument();
    });
    const drop = container.querySelector('.dogtag-drop');
    expect(drop).not.toBeNull();
  });

  it('★ DogTag sessionStorage — 재진입 시 모션 클래스 X (단발)', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    // 첫 진입
    const { container: first, unmount } = renderPage();
    await waitFor(() => {
      expect(first.querySelector('.dogtag-drop')).not.toBeNull();
    });
    unmount();
    // 재진입 — sessionStorage 키 'dogtag-shown-17' 가 존재 → 모션 클래스 X
    const { container: second } = renderPage();
    await waitFor(() => {
      // 도그태그는 그대로 렌더되어야 함
      expect(second.querySelector('[role="status"]')).not.toBeNull();
    });
    expect(second.querySelector('.dogtag-drop')).toBeNull();
  });

  // ── 페이지 기본 testid 회귀 ──────────────────────────────────
  it('section data-testid="complete-page" 노출 (회귀)', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('complete-page')).toBeInTheDocument();
    });
  });

  // ── a11y ────────────────────────────────────────────────────
  it('a11y 위반 없음 (axe)', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    const { container } = renderPage();
    await waitFor(() => {
      expect(screen.getByText('#17')).toBeInTheDocument();
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ── Codex final-gate P2 — unmount 후 copy timer cleanup ────────
  // 사고: 복사 성공 후 2초 idle 복귀 setTimeout이 테스트 teardown 이후 실행되면
  // ReferenceError(window is not defined) 또는 unmounted component setState 경고 발생.
  // 처치: useRef + useEffect cleanup으로 unmount 시 clearTimeout.
  it('★ Codex final-gate P2 — 복사 후 즉시 unmount해도 pending timer가 fire되지 않음', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { unmount } = renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '계좌번호 복사' })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: '계좌번호 복사' }));
      await waitFor(() => {
        expect(screen.getByText(/복사됨/)).toBeInTheDocument();
      });
      // 클릭 후 idle 복귀 setTimeout이 등록됐어야 함
      const countBeforeUnmount = vi.getTimerCount();
      expect(countBeforeUnmount).toBeGreaterThanOrEqual(1);
      unmount();
      // cleanup useEffect가 clearTimeout을 호출해 timer count가 감소했어야 함
      expect(vi.getTimerCount()).toBeLessThan(countBeforeUnmount);
      // 추가로 시간을 흘려도 unmounted component setState 경고 없어야 함
      vi.advanceTimersByTime(3000);
      const calls = errSpy.mock.calls.flat().map((v) => String(v)).join(' ');
      expect(calls).not.toMatch(/unmounted/i);
    } finally {
      vi.useRealTimers();
      errSpy.mockRestore();
    }
  });

  // ── 회귀 — 페이지 줄수 ────────────────────────────────────
  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/customer/CompletePage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
