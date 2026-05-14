// Task 3.2 — apiFetch 단위 테스트.
//
// 회귀 포인트:
//  - 200 + zod 스키마 검증
//  - 423 BUSINESS_CLOSED → BusinessClosedError 분리 (G13 단일 reactive 진입점)
//  - 5xx 재시도 (2회, exponential backoff 200ms/600ms)
//  - 5xx 3회 모두 실패 → ApiError throw + fetch 호출 3회
//  - 4xx (400) 재시도 X
//  - zod 검증 실패 → ValidationError
//  - timeout 시 AbortError
//  - 외부 AbortController로 즉시 취소
//  - POST body JSON 직렬화
//  - basePath 지원
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  apiFetch,
  ApiError,
  BusinessClosedError,
  ValidationError,
} from '../client.js';

global.fetch = vi.fn();

beforeEach(() => {
  vi.useRealTimers();
  global.fetch.mockReset();
});

// 헬퍼: fetch Response 모의 — ok 플래그는 status 기반으로 계산.
const okResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

describe('apiFetch', () => {
  it('200 응답 + zod 스키마 검증 성공', async () => {
    global.fetch.mockResolvedValueOnce(
      okResponse([
        { id: 1, code: 'X', name: 'A', category: 'chicken', basePrice: 1000 },
      ]),
    );
    const schema = z.array(
      z.object({ id: z.number(), name: z.string() }).passthrough(),
    );
    const data = await apiFetch('/api/menus', { schema });
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(1);
  });

  it('스키마 없으면 raw JSON 그대로 반환', async () => {
    global.fetch.mockResolvedValueOnce(okResponse({ anything: 'goes' }));
    const data = await apiFetch('/api/menus');
    expect(data).toEqual({ anything: 'goes' });
  });

  it('★ 423 시 BusinessClosedError throw (G13)', async () => {
    global.fetch.mockResolvedValueOnce(
      okResponse({ ok: false, error: { code: 'BUSINESS_CLOSED' } }, 423),
    );
    await expect(apiFetch('/api/menus')).rejects.toThrow(BusinessClosedError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('★ 423 BusinessClosedError는 재시도 X', async () => {
    global.fetch.mockResolvedValue(okResponse({ ok: false }, 423));
    await expect(apiFetch('/api/menus')).rejects.toThrow(BusinessClosedError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('★ 5xx 시 2회 재시도 후 성공', async () => {
    global.fetch
      .mockResolvedValueOnce(okResponse({ error: 'DB' }, 500))
      .mockResolvedValueOnce(okResponse({ error: 'DB' }, 500))
      .mockResolvedValueOnce(okResponse({ ok: true }, 200));
    const data = await apiFetch('/api/menus');
    expect(data).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('★ 5xx 재시도 모두 실패 시 ApiError throw', async () => {
    global.fetch
      .mockResolvedValueOnce(okResponse({}, 500))
      .mockResolvedValueOnce(okResponse({}, 500))
      .mockResolvedValueOnce(okResponse({}, 500));
    await expect(apiFetch('/api/menus')).rejects.toThrow(ApiError);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('400 클라이언트 에러 재시도 X', async () => {
    global.fetch.mockResolvedValueOnce(
      okResponse({ ok: false, error: { code: 'BAD_INPUT' } }, 400),
    );
    await expect(apiFetch('/api/menus')).rejects.toThrow(ApiError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('★ zod 검증 실패 시 ValidationError throw', async () => {
    global.fetch.mockResolvedValueOnce(
      okResponse([{ id: 'not-a-number' }]),
    );
    const schema = z.array(z.object({ id: z.number() }));
    await expect(apiFetch('/api/menus', { schema })).rejects.toThrow(
      ValidationError,
    );
  });

  it('★ timeout 시 AbortError throw', async () => {
    // fake timers로 timeout 트리거를 결정론적으로 검증.
    vi.useFakeTimers();
    // fetch는 abort signal에 반응해야 AbortError로 reject.
    global.fetch.mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const promise = apiFetch('/api/menus', { timeoutMs: 100 });
    // unhandled rejection 방지를 위한 catch 핸들러 등록.
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(150);
    await assertion;
    vi.useRealTimers();
  });

  it('★ 외부 AbortController로 즉시 취소 가능 (AbortError)', async () => {
    global.fetch.mockImplementation((_url, init) => {
      return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const ctrl = new AbortController();
    const promise = apiFetch('/api/menus', { signal: ctrl.signal });
    // 마이크로태스크 후 abort — 단위 테스트 결정론.
    queueMicrotask(() => ctrl.abort());
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('POST 요청 body JSON 직렬화', async () => {
    global.fetch.mockResolvedValueOnce(okResponse({ ok: true }));
    await apiFetch('/api/orders', { method: 'POST', body: { x: 1 } });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ x: 1 }),
      }),
    );
  });

  it('basePath 지원 (baseUrl 옵션)', async () => {
    global.fetch.mockResolvedValueOnce(okResponse({}));
    await apiFetch('/api/menus', { baseUrl: 'http://localhost:3000' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/menus',
      expect.any(Object),
    );
  });

  it('★ AbortError는 재시도 X (5xx 와 다름)', async () => {
    let callCount = 0;
    global.fetch.mockImplementation((_url, init) => {
      callCount++;
      return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const ctrl = new AbortController();
    const promise = apiFetch('/api/menus', { signal: ctrl.signal });
    queueMicrotask(() => ctrl.abort());
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    // 재시도 안 했는지 확인 — 단 1회 호출.
    expect(callCount).toBe(1);
  });
});
