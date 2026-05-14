// useGlobalErrorHandler hook — Task 3.4.
//
// 전역 unhandled promise rejection 핸들러.
//  - BusinessClosedError → onBusinessClosed 콜백 + event.preventDefault (콘솔 노이즈 차단).
//  - 그 외 모든 에러 → console.error.
//
// 책임 분리:
//  - 본 hook은 'unhandledrejection'만 — 렌더 에러는 기존 ErrorBoundary 컴포넌트가 담당.
//  - App 진입점에서 1회 호출하면 전체 트리에 적용됨.
//
// 사용 예:
//   const navigate = useNavigate();
//   useGlobalErrorHandler({ onBusinessClosed: () => navigate('/closed') });
//
// 왜 unhandledrejection만?
//  - 컴포넌트 렌더 / 생명주기 에러는 React가 ErrorBoundary로 catch.
//  - 이벤트 핸들러·비동기 콜백의 throw는 React가 못 잡음 — 전역 윈도우 리스너 필요.
//  - 423 BUSINESS_CLOSED는 useApi catch에서 콜백 발화하지만, 누락된 await/non-React 경로 안전망.
import { useEffect } from 'react';
import { BusinessClosedError } from '../api/client.js';

/**
 * @param {Object} [options]
 * @param {function} [options.onBusinessClosed] - BusinessClosedError 시 호출 (예: navigate('/closed')).
 */
export function useGlobalErrorHandler({ onBusinessClosed } = {}) {
  useEffect(() => {
    const handler = (event) => {
      const err = event.reason;
      if (err instanceof BusinessClosedError && typeof onBusinessClosed === 'function') {
        // 처리됨 — 콘솔 unhandledrejection 경고 차단.
        event.preventDefault?.();
        onBusinessClosed(err);
        return;
      }
      // BusinessClosedError지만 콜백 미제공이거나, 그 외 에러 → console.error.
      // eslint-disable-next-line no-console
      console.error('[unhandledrejection]', err);
    };

    window.addEventListener('unhandledrejection', handler);
    return () => {
      window.removeEventListener('unhandledrejection', handler);
    };
  }, [onBusinessClosed]);
}
