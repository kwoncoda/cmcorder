// P1-6 (Codex 리뷰) — CSRF 토큰 클라이언트 헬퍼.
//
// 책임:
//  - /admin/api/csrf-token 호출로 토큰 받고 메모리 캐시.
//  - 403 CSRF_INVALID 응답 시 캐시 무효화 + 재발급 트리거.
//  - apiFetch가 admin mutation 호출 시 자동 사용.

let cached = null;
let inflight = null;

const TOKEN_PATH = '/admin/api/csrf-token';

/**
 * 캐시된 토큰을 반환. 없으면 fetch.
 * 동시 호출 시 1회만 fetch (inflight promise 공유).
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<string|null>}
 */
export async function getCsrfToken({ signal } = {}) {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(TOKEN_PATH, {
        method: 'GET',
        credentials: 'same-origin',
        signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      cached = typeof data?.token === 'string' ? data.token : null;
      return cached;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * 캐시 무효화 — 403 응답 또는 로그아웃 시 호출.
 */
export function clearCsrfToken() {
  cached = null;
}
