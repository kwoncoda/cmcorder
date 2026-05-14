// fetch wrapper — Task 3.2.
//
// 기능:
//  - GET/POST/PATCH/DELETE JSON 요청
//  - 5xx 재시도 (최대 2회, exponential backoff 200ms / 600ms)
//  - 4xx 재시도 X (클라이언트 실수는 재시도해도 동일)
//  - 423 BUSINESS_CLOSED → BusinessClosedError (G13 단일 reactive 진입점)
//  - timeout 기본 10s (옵션 변경 가능)
//  - 외부 AbortController.signal 지원 + 내부 timeout signal 합성
//  - zod 스키마 (옵션) 응답 검증 → 실패 시 ValidationError
//
// 사용 예:
//   import { apiFetch } from '@/api/client';
//   import { MenuListSchema } from '@/api/schemas';
//   const menus = await apiFetch('/api/menus', { schema: MenuListSchema });
//
// useApi hook과 함께 쓰면 AbortController/StrictMode 자동 처리:
//   const { data, error, isLoading } = useApi(
//     ({ signal }) => apiFetch('/api/menus', { schema: MenuListSchema, signal }),
//     [],
//   );

// ── 에러 계층 ────────────────────────────────────────────────
// ApiError: HTTP 응답 본 + 코드. BusinessClosedError·ValidationError가 상속.
// catch 측은 instanceof 또는 name 기반 분기 — 둘 다 회귀 보장.
export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// G13 핵심: 423 BUSINESS_CLOSED 단일 reactive 진입점.
// useApi가 onBusinessClosed 콜백으로 받아 /closed redirect.
export class BusinessClosedError extends ApiError {
  constructor(details) {
    super('영업이 종료되어 요청을 처리할 수 없습니다.', {
      status: 423,
      code: 'BUSINESS_CLOSED',
      details,
    });
    this.name = 'BusinessClosedError';
  }
}

// zod 스키마 실패 — 서버가 기대 형식과 다른 응답을 줬을 때.
export class ValidationError extends ApiError {
  constructor(zodError) {
    super('서버 응답 형식이 올바르지 않습니다.', {
      status: 0,
      code: 'VALIDATION_FAILED',
      details: zodError,
    });
    this.name = 'ValidationError';
  }
}

// ── 상수 ─────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 10_000;
// 재시도 backoff (ms). 길이 = 최대 재시도 횟수.
// 첫 5xx 실패 → 200ms 대기 → 2번째 시도. 2번째 실패 → 600ms 대기 → 3번째.
// 즉, 총 시도 횟수는 1 + RETRY_BACKOFFS.length = 3.
const RETRY_BACKOFFS = [200, 600];

// P1-6 (Codex 리뷰): admin mutation에 자동 CSRF 토큰 주입.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ADMIN_API_PREFIX = '/admin/api/';
function isAdminMutation(path, method) {
  return !SAFE_METHODS.has(method) && path.startsWith(ADMIN_API_PREFIX);
}

// ── 핵심 함수 ────────────────────────────────────────────────
/**
 * @param {string} path - API 경로 (또는 baseUrl과 합성될 path).
 * @param {object} [opts]
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} [opts.method='GET']
 * @param {*} [opts.body] - JSON 직렬화될 본문. undefined면 본문 X.
 * @param {object} [opts.schema] - zod 스키마. 있으면 응답 검증.
 * @param {AbortSignal} [opts.signal] - 외부 취소 시그널.
 * @param {number} [opts.timeoutMs=10000] - 타임아웃 ms.
 * @param {string} [opts.baseUrl=''] - 베이스 URL 접두사.
 */
export async function apiFetch(
  path,
  {
    method = 'GET',
    body,
    schema,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    baseUrl = '',
  } = {},
) {
  // 외부 signal + 내부 timeout signal 합성.
  const internalController = new AbortController();
  const composedSignal = composeSignals(signal, internalController.signal);
  const timer = setTimeout(() => internalController.abort(), timeoutMs);

  const url = baseUrl + path;
  const init = {
    method,
    signal: composedSignal,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  // P1-6: admin mutation 자동 CSRF 토큰 주입 (지연 import — 순환 방지).
  if (isAdminMutation(path, method)) {
    const { getCsrfToken } = await import('./csrf.js');
    const token = await getCsrfToken({ signal: composedSignal });
    if (token) init.headers['X-CSRF-Token'] = token;
  }

  // 재시도 루프: 0 ≤ attempt ≤ RETRY_BACKOFFS.length.
  for (let attempt = 0; attempt <= RETRY_BACKOFFS.length; attempt++) {
    try {
      const res = await fetch(url, init);

      // 423 — G13 BUSINESS_CLOSED. 재시도 X. 즉시 BusinessClosedError throw.
      if (res.status === 423) {
        clearTimeout(timer);
        let details = null;
        try {
          details = await res.json();
        } catch {
          // 본문 없을 수도. 무시.
        }
        throw new BusinessClosedError(details);
      }

      // 5xx — 재시도 가능. 마지막 시도가 아니면 backoff 후 재시도.
      if (res.status >= 500 && attempt < RETRY_BACKOFFS.length) {
        await sleep(RETRY_BACKOFFS[attempt]);
        continue;
      }

      // 4xx 또는 마지막 시도의 5xx — ApiError throw.
      if (!res.ok) {
        clearTimeout(timer);
        let parsed = null;
        try {
          parsed = await res.json();
        } catch {
          // 본문 없을 수도.
        }
        const { code, message } = extractErrorInfo(parsed, res.status);
        throw new ApiError(message, {
          status: res.status,
          code,
          details: parsed,
        });
      }

      // 2xx 성공 — JSON 파싱 + (옵션) 스키마 검증.
      clearTimeout(timer);
      const data = await res.json();
      if (schema) {
        const validated = schema.safeParse(data);
        if (!validated.success) {
          throw new ValidationError(validated.error);
        }
        return validated.data;
      }
      return data;
    } catch (err) {
      // AbortError → 재시도 X. 즉시 throw.
      if (err.name === 'AbortError') {
        clearTimeout(timer);
        throw err;
      }
      // BusinessClosedError, ValidationError, ApiError(4xx) → 재시도 X.
      if (
        err instanceof BusinessClosedError ||
        err instanceof ValidationError ||
        (err instanceof ApiError && err.status < 500)
      ) {
        clearTimeout(timer);
        throw err;
      }
      // 마지막 시도였으면 throw — 더 이상 재시도 못 함.
      if (attempt >= RETRY_BACKOFFS.length) {
        clearTimeout(timer);
        throw err;
      }
      // 그 외 (네트워크 에러, 5xx ApiError) → backoff 후 재시도.
      await sleep(RETRY_BACKOFFS[attempt]);
    }
  }
  // 이론적으로 도달 X — 루프는 항상 throw 또는 return.
  clearTimeout(timer);
  throw new ApiError('재시도 루프 종료 — 알 수 없는 상태', { status: 0 });
}

// ── 헬퍼 ─────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 여러 AbortSignal을 하나로 합성. 어느 하나라도 abort 되면 결과도 abort.
// AbortSignal.any가 모던 브라우저/Node 20+에 있음. 폴백은 수동 propagation.
function composeSignals(...signals) {
  const filtered = signals.filter(Boolean);
  if (filtered.length === 0) return undefined;
  if (filtered.length === 1) return filtered[0];
  if (
    typeof AbortSignal !== 'undefined' &&
    typeof AbortSignal.any === 'function'
  ) {
    return AbortSignal.any(filtered);
  }
  const ctrl = new AbortController();
  for (const s of filtered) {
    if (s.aborted) {
      ctrl.abort();
      break;
    }
    s.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return ctrl.signal;
}

// 백엔드 에러 응답에서 code/message 추출. 두 가지 포맷 지원:
//  - { ok: false, error: { code, message } } — 새 표준 (API_DRAFT)
//  - { error: 'CODE', message?: '...' }      — 단순 포맷
function extractErrorInfo(parsed, status) {
  if (!parsed) return { code: 'HTTP_ERROR', message: `HTTP ${status}` };
  if (parsed.error && typeof parsed.error === 'object') {
    return {
      code: parsed.error.code ?? 'HTTP_ERROR',
      message: parsed.error.message ?? `HTTP ${status}`,
    };
  }
  if (typeof parsed.error === 'string') {
    return {
      code: parsed.error,
      message: parsed.message ?? parsed.error,
    };
  }
  return { code: 'HTTP_ERROR', message: `HTTP ${status}` };
}
