// P0-4 (Codex 리뷰) — 주문 access_token 헬퍼.
//
// 책임:
//  - URL ?token= 우선, 없으면 sessionStorage[`order:${id}:token`] 조회.
//  - sessionStorage 없으면 localStorage[`chickenedak:order:${id}:token`] fallback. (Bug 13)
//  - URL에 토큰이 있고 storage에 없으면 양쪽에 캐시 (새로고침/딥링크/세션 종료 후 복귀 호환).
//  - 토큰이 없으면 null 반환 → 호출자가 401 처리.
//
// localStorage fallback 추가 이유 (Bug 13):
//  - sessionStorage는 브라우저 세션 종료 시 소실.
//  - 사용자가 메뉴 페이지로 돌아간 뒤 새로고침/탭 닫음 시 진행 중 주문 status 재진입 불가.
//  - access_token만 저장 — recentOrdersStore와 별개 (token 단독 fallback 경로).
//
// CheckoutPage가 POST /api/orders 응답 access_token을 받아
// storeOrderToken(id, token) + URL search param으로 navigate.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const SESSION_KEY = (id) => `order:${id}:token`;
const LOCAL_KEY = (id) => `chickenedak:order:${id}:token`;

/**
 * 주문 토큰을 URL → sessionStorage → localStorage 순으로 가져온다.
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
    const sessKey = SESSION_KEY(orderId);
    const localKey = LOCAL_KEY(orderId);
    let resolved = null;
    if (urlToken) {
      try { sessionStorage.setItem(sessKey, urlToken); } catch { /* ignore */ }
      try { localStorage.setItem(localKey, urlToken); } catch { /* ignore */ }
      resolved = urlToken;
    } else {
      try { resolved = sessionStorage.getItem(sessKey); } catch { resolved = null; }
      if (!resolved) {
        try { resolved = localStorage.getItem(localKey); } catch { resolved = null; }
      }
    }
    if (!resolved) return empty;
    const query = `?token=${encodeURIComponent(resolved)}`;
    return { token: resolved, query, withQuery: (p) => `${p}${query}` };
  }, [orderId, urlToken]);
}

/**
 * 주문 생성 직후 호출 — token을 sessionStorage + localStorage 양쪽에 저장.
 * localStorage 미러는 세션 종료 후에도 토큰을 보존해 진행 중 주문에 재진입 가능하게 한다 (Bug 13).
 */
export function storeOrderToken(orderId, token) {
  if (!orderId || !token) return;
  try { sessionStorage.setItem(SESSION_KEY(orderId), token); } catch { /* ignore */ }
  try { localStorage.setItem(LOCAL_KEY(orderId), token); } catch { /* ignore */ }
}
