// useApi hook — Task 3.2.
//
// 데이터 fetch 표준 패턴. AbortController·StrictMode·G13 423 단일 reactive 모두 처리.
//
// 사용 예:
//   import { useApi } from '@/hooks/useApi';
//   import { apiFetch } from '@/api/client';
//   import { MenuListSchema } from '@/api/schemas';
//
//   const { data, error, isLoading, refetch } = useApi(
//     ({ signal }) => apiFetch('/api/menus', { schema: MenuListSchema, signal }),
//     [],  // deps — 빈 배열이면 mount 1회.
//     { onBusinessClosed: () => navigate('/closed') }, // G13 단일 진입점.
//   );
//
// StrictMode 회귀:
//  - 첫 mount → effect 발화 → fetch 시작.
//  - StrictMode가 즉시 unmount → cleanup → controller.abort() → fetcher AbortError.
//  - 즉시 re-mount → 새 effect → 새 fetch.
//  - 결과: 활성 fetch는 항상 *최신 1개*. 이전 호출은 abort 되어 setState X.
//
// onBusinessClosed 콜백:
//  - 어떤 API 호출이든 423 응답 받으면 발화.
//  - 호출자(Layout)가 navigate('/closed') 처리 → 폴링 불필요.
import { useState, useEffect, useRef } from 'react';
import { BusinessClosedError } from '../api/client.js';

export function useApi(fetcher, deps = [], { onBusinessClosed } = {}) {
  const [state, setState] = useState({
    data: null,
    error: null,
    isLoading: true,
  });
  // refetch trigger — 값이 바뀌면 effect 재실행.
  const [refetchCounter, setRefetchCounter] = useState(0);

  // 최신 콜백 ref — effect deps에 안 넣어도 항상 최신 호출.
  const onBusinessClosedRef = useRef(onBusinessClosed);
  useEffect(() => {
    onBusinessClosedRef.current = onBusinessClosed;
  }, [onBusinessClosed]);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, isLoading: true, error: null }));

    fetcher({ signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ data, error: null, isLoading: false });
      })
      .catch((err) => {
        // AbortError → 의도된 cleanup. 무시.
        if (err?.name === 'AbortError') return;
        if (controller.signal.aborted) return;
        // 423 BUSINESS_CLOSED → 콜백 (G13 단일 reactive 진입점).
        if (err instanceof BusinessClosedError) {
          if (typeof onBusinessClosedRef.current === 'function') {
            onBusinessClosedRef.current(err);
          }
        }
        setState({ data: null, error: err, isLoading: false });
      });

    return () => {
      controller.abort();
    };
    // fetcher는 deps에 넣지 X — 호출자가 매 렌더마다 새 함수를 만들 수 있어
    // 무한 루프 위험. 호출자는 deps 배열로 의존성을 명시.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refetchCounter]);

  const refetch = () => {
    setRefetchCounter((c) => c + 1);
  };

  return { ...state, refetch };
}
