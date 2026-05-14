// C-1 — useOrderPolling hook (SSE 폴링 fallback).
//
// 배경:
//  - useOrderStream 은 GET /api/orders/:id/stream EventSource 연결을 시도하지만
//    서버에 해당 라우트가 없어 404 → isConnected=false → "⚠️ 실시간 연결 끊김" 영구 표시.
//  - 서버 SSE 구현 전까지 5초 폴링으로 fallback. 시그니처는 useOrderStream 과 호환.
//
// 시그니처 (useOrderStream 과 동일):
//   { snapshot, status, error, isConnected }
//
// §3.5 5조 (이벤트 핸들러):
//  - 부수효과(진동·깜박)는 onStatusChange 핸들러에서 — useEffect deps 에 status 두지 X.
//  - 첫 fetch 는 prevStatus=null 이라 콜백 호출 X → 새로고침 후 READY 직진입 시 진동 0회.
//
// StrictMode 호환:
//  - AbortController + cancelled flag + clearInterval cleanup.
//  - StrictMode mount-unmount-mount 시 활성 폴링 1개 보장.
//
// onStatusChange latest ref 패턴:
//  - 호출자가 inline 화살표 함수로 매 렌더 새 함수를 넘겨도 effect 재실행 X.
//  - effect deps 는 [orderId, authToken, enabled, intervalMs] 만.
//
// G13 (BusinessClosedError):
//  - apiFetch 가 423 시 BusinessClosedError throw → useGlobalErrorHandler 가 전역 위임.
//  - 본 hook 은 catch 후 다시 throw — error state 에 잡지 X.
import { useEffect, useRef, useState } from 'react';
import { apiFetch, BusinessClosedError } from '../api/client.js';
import { OrderSchema } from '../api/schemas.js';
import { API } from '../api/routes.js';

const POLL_INTERVAL_MS = 5_000;

/**
 * @param {Object} options
 * @param {string|number} options.orderId - 주문 ID. falsy 면 폴링 X.
 * @param {string} [options.authToken] - 외부인 토큰 (학생은 세션 쿠키).
 * @param {function} [options.onStatusChange] - (prev, next) => void. status 전이 시 호출.
 * @param {boolean} [options.enabled=true] - false 면 폴링 X.
 * @param {number} [options.intervalMs=5000] - 폴링 간격 ms.
 * @returns {{ snapshot, status, error, isConnected }}
 */
export function useOrderPolling({
  orderId,
  authToken,
  onStatusChange,
  enabled = true,
  intervalMs = POLL_INTERVAL_MS,
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // 이전 status — 전이 감지에 사용. ref 라 setState 트리거 X.
  const prevStatusRef = useRef(null);

  // latest ref — onStatusChange 매 렌더 새 함수여도 effect 재실행 X.
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    if (!enabled || !orderId) {
      setIsConnected(false);
      return;
    }

    // 새 연결마다 prevStatus 초기화 — 첫 fetch 가 prev=null 이라 콜백 X.
    prevStatusRef.current = null;

    let cancelled = false;
    const controller = new AbortController();

    const fetchOnce = async () => {
      try {
        const params = authToken
          ? `?token=${encodeURIComponent(authToken)}`
          : '';
        const order = await apiFetch(`${API.ORDER(orderId)}${params}`, {
          schema: OrderSchema,
          signal: controller.signal,
        });
        if (cancelled) return;
        const prevStatus = prevStatusRef.current;
        const nextStatus = order?.status ?? null;
        setSnapshot(order);
        setIsConnected(true);
        setError(null);
        if (
          prevStatus !== null &&
          nextStatus !== null &&
          nextStatus !== prevStatus &&
          onStatusChangeRef.current
        ) {
          onStatusChangeRef.current(prevStatus, nextStatus);
        }
        if (nextStatus !== null) prevStatusRef.current = nextStatus;
      } catch (err) {
        if (cancelled || err?.name === 'AbortError') return;
        // G13 — BusinessClosedError 는 전역 핸들러 위임. error state 에 잡지 X.
        if (err instanceof BusinessClosedError) {
          setIsConnected(false);
          throw err;
        }
        setError(err);
        setIsConnected(false);
      }
    };

    // 즉시 1회 — 새로고침 후 직진입 시 즉시 표시.
    fetchOnce();
    const id = setInterval(fetchOnce, intervalMs);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(id);
      setIsConnected(false);
    };
  }, [orderId, authToken, enabled, intervalMs]);

  return {
    snapshot,
    status: snapshot?.status ?? null,
    error,
    isConnected,
  };
}
