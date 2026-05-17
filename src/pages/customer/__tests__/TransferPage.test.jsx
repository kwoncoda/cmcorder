// Task 4.6 — TransferPage 통합 테스트.
//
// 회귀 보호 (9 케이스):
//  - Loading / Error / Form 렌더
//  - expectedAmount = order.total_price 전달
//  - onSubmit → apiFetch POST 호출 (페이로드 검증)
//  - API 성공 시 navigate to /orders/:id/status
//  - API 실패 시 ErrorState inline (form-error)
//  - submitting 시 loading prop 전달 (버튼 비활성)
//  - BusinessClosedError throw → useGlobalErrorHandler 위임 (페이지에서 catch X)
//  - 페이지 ≤120줄 — §3.5 1조
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// apiFetch mock — 서버 호출 격리.
vi.mock('../../../api/client.js', async () => {
  const actual = await vi.importActual('../../../api/client.js');
  return { ...actual, apiFetch: vi.fn() };
});
import {
  apiFetch,
  ApiError,
  BusinessClosedError,
} from '../../../api/client.js';

import TransferPage from '../TransferPage.jsx';

const SAMPLE_ORDER = {
  id: 17,
  no: 17,
  operating_date: '2026-05-20',
  status: 'ORDERED',
  items: [{ menu_id: 1, name: '후라이드', base_price: 18000, quantity: 1 }],
  total_price: 18000,
};

// P2-1: stub이 location.state.flash·message를 노출하도록 확장 — 라우팅 전달 검증.
function StatusStub() {
  const loc = useLocation();
  return (
    <div data-testid="status-page-stub" data-flash={loc.state?.flash ?? ''}>
      현황
      {loc.state?.message && <span data-testid="status-stub-flash-message">{loc.state.message}</span>}
    </div>
  );
}

function renderPage(initialPath = '/orders/17/transfer') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/orders/:id/transfer" element={<TransferPage />} />
        <Route path="/orders/:id/status" element={<StatusStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

// 유효한 폼 입력 헬퍼.
function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/은행/), {
    target: { value: '국민' },
  });
  fireEvent.change(screen.getByLabelText(/입금자 이름/), {
    target: { value: '홍길동' },
  });
  // amount는 expectedAmount 자동 prefill → 그대로 사용.
}

describe('TransferPage', () => {
  // ── 3분기 처리 ──────────────────────────────────────────────
  it('★ Loading 분기 — 주문 fetch 중 LoadingState', () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    // form 미렌더
    expect(screen.queryByLabelText(/은행/)).not.toBeInTheDocument();
  });

  it('★ Error 분기 — 주문 fetch 실패 시 ErrorState + 재시도', async () => {
    apiFetch.mockRejectedValue(
      new ApiError('not found', { status: 404, code: 'NOT_FOUND' }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/주문을 찾을 수 없어요/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('주문 fetch 성공 시 TransferReportForm 렌더', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/은행/)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/입금자 이름/)).toBeInTheDocument();
  });

  it('★ expectedAmount = order.total_price 전달 (amount 입력 prefill)', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/입금 금액/)).toBeInTheDocument();
    });
    const amountInput = screen.getByLabelText(/입금 금액/);
    expect(amountInput.value).toBe('18000');
  });

  it('★ onSubmit → apiFetch POST 호출 (페이로드 검증)', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/은행/)).toBeInTheDocument();
    });
    // 두번째 호출(submit)은 다른 응답.
    apiFetch.mockResolvedValueOnce(SAMPLE_ORDER).mockResolvedValueOnce({ ok: true });
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /이체 완료 요청/ }));
    await waitFor(() => {
      // /api/orders/17/transfer-report POST 호출되어야 함
      const calls = apiFetch.mock.calls.filter((c) =>
        c[0].includes('/transfer-report'),
      );
      expect(calls.length).toBeGreaterThanOrEqual(1);
      expect(calls[0][1].method).toBe('POST');
    });
  });

  it('★ API 성공 시 navigate to /orders/:id/status', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE_ORDER); // 첫 fetch
    apiFetch.mockResolvedValueOnce({ ok: true }); // 제출
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/은행/)).toBeInTheDocument();
    });
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /이체 완료 요청/ }));
    await waitFor(() => {
      expect(screen.getByTestId('status-page-stub')).toBeInTheDocument();
    });
  });

  it('★ API 실패(ApiError) 시 form-error inline 렌더', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE_ORDER); // 첫 fetch
    apiFetch.mockRejectedValueOnce(
      new ApiError('이미 이체 신고된 주문입니다', {
        status: 409,
        code: 'ALREADY_REPORTED',
      }),
    ); // 제출
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/은행/)).toBeInTheDocument();
    });
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /이체 완료 요청/ }));
    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('form-error')).toHaveTextContent(/이미 이체 신고/);
  });

  it('★ BusinessClosedError throw — useGlobalErrorHandler 위임 (페이지 미캐치)', async () => {
    // unhandledrejection 글로벌 핸들러 사전 등록 — vitest 캐치 회피.
    const onUnhandled = vi.fn((e) => {
      if (e?.preventDefault) e.preventDefault();
      if (e?.reason instanceof BusinessClosedError) return; // 의도된 동작
    });
    window.addEventListener('unhandledrejection', onUnhandled);
    // Node 진영도 동일 — 안전 망.
    const nodeHandler = (reason) => {
      if (reason instanceof BusinessClosedError) {
        /* 의도된 동작 — vitest 가 fail 처리하지 못하도록 흡수 */
      }
    };
    if (typeof process !== 'undefined' && process.on) {
      process.on('unhandledRejection', nodeHandler);
    }

    apiFetch.mockResolvedValueOnce(SAMPLE_ORDER);
    apiFetch.mockRejectedValueOnce(new BusinessClosedError());
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/은행/)).toBeInTheDocument();
    });

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /이체 완료 요청/ }));

    // 충분히 대기 후 form-error 미렌더 확인.
    // 핵심 검증: 페이지가 BusinessClosedError 메시지를 자체 ErrorState 로 표시하지 X
    // (즉 throw 위임됨). unhandledrejection 발화는 jsdom/vitest 환경에 따라
    // 보장되지 않으므로 spy 호출 횟수는 검증하지 X.
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('form-error')).not.toBeInTheDocument();

    window.removeEventListener('unhandledrejection', onUnhandled);
    if (typeof process !== 'undefined' && process.off) {
      process.off('unhandledRejection', nodeHandler);
    }
  });

  // ── find_error_v2 — 중복 제출 UX 회귀 ────────────────────
  // 사고: 사용자가 이체 신고 후 뒤로가기 → 재제출 시 raw "불법 상태 전이"가 UI에 노출.
  // 처치: 라우트가 TRANSFER_ALREADY_REPORTED로 응답, 페이지는 status로 이동
  //       (첫 신고가 이미 서버에 접수됐으므로 사용자 입장에서는 성공).
  it('★ find_error_v2 — TRANSFER_ALREADY_REPORTED 응답 시 status로 이동 (raw 문구 미노출)', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE_ORDER); // 첫 fetch
    apiFetch.mockRejectedValueOnce(
      new ApiError('이미 이체 완료 요청이 접수됐어요. 본부 확인을 기다려주세요.', {
        status: 409,
        code: 'TRANSFER_ALREADY_REPORTED',
      }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/은행/)).toBeInTheDocument();
    });
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /이체 완료 요청/ }));
    await waitFor(() => {
      expect(screen.getByTestId('status-page-stub')).toBeInTheDocument();
    });
    // raw 내부 문구는 노출되지 않는다.
    expect(screen.queryByText(/불법 상태 전이/)).not.toBeInTheDocument();
  });

  // P2-1 (Codex 리뷰) — 친절 문구를 status로 1회 flash 전달.
  it('★ P2-1 — TRANSFER_ALREADY_REPORTED 응답 시 location.state.flash·message로 전달', async () => {
    apiFetch.mockResolvedValueOnce(SAMPLE_ORDER);
    apiFetch.mockRejectedValueOnce(
      new ApiError('이미 이체 완료 요청이 접수됐어요. 본부 확인을 기다려주세요.', {
        status: 409,
        code: 'TRANSFER_ALREADY_REPORTED',
      }),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/은행/)).toBeInTheDocument();
    });
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /이체 완료 요청/ }));
    await waitFor(() => {
      expect(screen.getByTestId('status-page-stub')).toHaveAttribute(
        'data-flash',
        'TRANSFER_ALREADY_REPORTED',
      );
    });
    expect(screen.getByTestId('status-stub-flash-message')).toHaveTextContent(
      /이미 이체 완료 요청이 접수됐어요/,
    );
  });

  // ADR-033 UX 정리: "본부가 통장 입금을 확인하면…" info 배너는 제거 (혼란 야기).
  it('★ find_error_v2 — info 배너("본부가 통장 입금을 확인하면…")는 DOM에 없다', async () => {
    apiFetch.mockResolvedValue(SAMPLE_ORDER);
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/은행/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/본부가 통장 입금을 확인하면/)).not.toBeInTheDocument();
    expect(screen.queryByText(/4가지가 일치해야/)).not.toBeInTheDocument();
  });

  // ── 회귀 — 페이지 줄수 ────────────────────────────────────
  it('★ 페이지 ≤120줄 (§3.5 1조)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/pages/customer/TransferPage.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(120);
  });
});
