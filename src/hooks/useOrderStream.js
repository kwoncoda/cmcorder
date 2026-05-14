// useOrderStream hook — Task 3.3.
//
// SSE 주문 스트림 — 1 주문에 대한 상태 갱신 수신.
//
// 책임:
//  - EventSource 래핑 + 브라우저 기본 재연결에 위임 (custom backoff X — KISS).
//  - 'message' / 'status' / 'business-closed' 이벤트 수신.
//  - 단계 전이 콜백 onStatusChange(prev, next) — 호출자가 부수효과(진동·깜박)를 처리.
//  - useEffect cleanup으로 EventSource close — StrictMode 2회 mount에도 메모리 누수 0.
//  - orderId / authToken / enabled / baseUrl 변경 시 재연결.
//
// 인증 분기:
//  - 학생: 세션 쿠키 (withCredentials=true).
//  - 외부인: authToken 쿼리 파라미터 (token=<UUID>, withCredentials=false).
//
// §3.5 5조 (이벤트 핸들러):
//  - 부수효과(진동·깜박)는 onStatusChange 핸들러에서 — useEffect deps에 status 두지 X.
//  - 호출자(StatusPage)는 onStatusChange(prev, next)에서 navigator.vibrate / setTimeout 처리.
//
// §3.5 3조 (cleanup 정확):
//  - useEffect return에서 es.close() — StrictMode mount-unmount-mount 시 모든 인스턴스 정리.
//
// onStatusChange latest ref 패턴:
//  - 호출자가 inline 화살표 함수로 매 렌더 새 함수를 넘겨도 effect 재실행 X.
//  - effect deps는 [orderId, authToken, enabled, baseUrl]만 — 핸들러는 ref로 분리.
import { useEffect, useRef, useState } from 'react';

/**
 * @param {Object} options
 * @param {string|number} options.orderId - 주문 ID. falsy면 연결 X.
 * @param {string} [options.authToken] - 외부인 토큰 (학생은 세션 쿠키).
 * @param {function} [options.onStatusChange] - (prev, next) => void. status 전이 시 호출.
 * @param {boolean} [options.enabled=true] - false면 연결 X.
 * @param {string} [options.baseUrl=''] - 테스트 환경 mock 서버 등 지정.
 * @returns {{ snapshot, status, error, isConnected }}
 */
export function useOrderStream({
  orderId,
  authToken,
  onStatusChange,
  enabled = true,
  baseUrl = '',
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // 이전 status — 전이 감지에 사용. ref로 보관해 setState 트리거 X.
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

    // 새 연결마다 prevStatus 초기화 — 첫 snapshot이 prev=null이라 콜백 X.
    prevStatusRef.current = null;

    const params = new URLSearchParams();
    if (authToken) params.set('token', authToken);
    const qs = params.toString();
    const url = `${baseUrl}/api/orders/${orderId}/stream${qs ? `?${qs}` : ''}`;

    let es;
    try {
      // 학생(세션 쿠키): withCredentials=true. 외부인(토큰): withCredentials=false.
      es = new EventSource(url, { withCredentials: !authToken });
    } catch (err) {
      setError(err);
      return;
    }

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    // 공통: snapshot 갱신 + status 전이 콜백.
    const handleSnapshot = (data, { merge = false } = {}) => {
      const prevStatus = prevStatusRef.current;
      const nextStatus = data?.status ?? null;
      if (merge) {
        setSnapshot((prev) => ({ ...(prev ?? {}), ...data }));
      } else {
        setSnapshot(data);
      }
      if (
        prevStatus !== null &&
        nextStatus !== null &&
        nextStatus !== prevStatus &&
        onStatusChangeRef.current
      ) {
        onStatusChangeRef.current(prevStatus, nextStatus);
      }
      if (nextStatus !== null) prevStatusRef.current = nextStatus;
    };

    es.onmessage = (ev) => {
      // 기본 message — 전체 snapshot JSON.
      try {
        const data = JSON.parse(ev.data);
        handleSnapshot(data);
      } catch (err) {
        setError(err);
      }
    };

    // 'status' — 부분 갱신 (status 전이 전용 이벤트).
    es.addEventListener('status', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        handleSnapshot(data, { merge: true });
      } catch (err) {
        setError(err);
      }
    });

    // 'business-closed' — 영업 종료. snapshot에 플래그 설정 (호출자가 처리).
    es.addEventListener('business-closed', () => {
      setSnapshot((prev) => ({ ...(prev ?? {}), business_closed: true }));
    });

    es.onerror = () => {
      // EventSource는 브라우저 기본 재연결 — error는 일시적일 수 있어 throw X.
      setIsConnected(false);
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [orderId, authToken, enabled, baseUrl]);

  return {
    snapshot,
    status: snapshot?.status ?? null,
    error,
    isConnected,
  };
}
