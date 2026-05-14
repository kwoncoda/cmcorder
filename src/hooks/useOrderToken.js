// P0-4 (Codex 리뷰) — 주문 access_token 헬퍼.
//
// 책임:
//  - URL ?token= 우선, 없으면 sessionStorage[`order:${id}:token`] 조회.
//  - URL에 토큰이 있고 storage에 없으면 캐시 (새로고침/딥링크 호환).
//  - 토큰이 없으면 null 반환 → 호출자가 401 처리.
//
// CheckoutPage가 POST /api/orders 응답 access_token을 받아
// sessionStorage 저장 + URL search param으로 navigate해야 함.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const STORAGE_KEY = (id) => `order:${id}:token`;

/**
 * 주문 토큰을 URL 또는 sessionStorage에서 가져온다.
 * @param {string|number} orderId
 * @returns {{ token: string|null, query: string, withQuery: (path: string) => string }}
 *   - token: 원시 토큰 (없으면 null)
 *   - query: ?token=... or '' (라우터 path 뒤에 단순 concat 가능)
 *   - withQuery(path): path + query 헬퍼
 */
export function useOrderToken(orderId) {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token');
  return useMemo(() => {
    const empty = { token: null, query: '', withQuery: (p) => p };
    if (!orderId) return empty;
    const key = STORAGE_KEY(orderId);
    let resolved = null;
    if (urlToken) {
      try {
        sessionStorage.setItem(key, urlToken);
      } catch {
        /* ignore */
      }
      resolved = urlToken;
    } else {
      try {
        resolved = sessionStorage.getItem(key);
      } catch {
        resolved = null;
      }
    }
    if (!resolved) return empty;
    const query = `?token=${encodeURIComponent(resolved)}`;
    return { token: resolved, query, withQuery: (p) => `${p}${query}` };
  }, [orderId, urlToken]);
}

/**
 * 주문 생성 직후 호출 — token을 sessionStorage에 저장.
 */
export function storeOrderToken(orderId, token) {
  if (!orderId || !token) return;
  try {
    sessionStorage.setItem(STORAGE_KEY(orderId), token);
  } catch {
    /* ignore */
  }
}
