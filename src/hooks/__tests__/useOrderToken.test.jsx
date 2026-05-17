// Bug 13 — useOrderToken localStorage fallback 회귀 테스트.
//
// 우선순위: URL → sessionStorage → localStorage.
// 회귀 보호:
//  - URL 토큰: sessionStorage + localStorage 양쪽 캐시
//  - sessionStorage 우선 (localStorage보다 우선)
//  - sessionStorage 없을 때 localStorage fallback
//  - 어디에도 없으면 null + 빈 query
//  - storeOrderToken: sessionStorage + localStorage 양쪽 저장
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useOrderToken, storeOrderToken } from '../useOrderToken.js';

function wrapper(initial) {
  return ({ children }) => (
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/x" element={children} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('useOrderToken (Bug 13)', () => {
  it('URL 토큰 있을 때 token 반환 + sessionStorage/localStorage 양쪽 캐시', () => {
    const { result } = renderHook(() => useOrderToken(17), {
      wrapper: wrapper('/x?token=abc'),
    });
    expect(result.current.token).toBe('abc');
    expect(sessionStorage.getItem('order:17:token')).toBe('abc');
    expect(localStorage.getItem('chickenedak:order:17:token')).toBe('abc');
  });

  it('URL 없고 sessionStorage 있을 때 sessionStorage 우선', () => {
    sessionStorage.setItem('order:17:token', 'sess');
    localStorage.setItem('chickenedak:order:17:token', 'local');
    const { result } = renderHook(() => useOrderToken(17), {
      wrapper: wrapper('/x'),
    });
    expect(result.current.token).toBe('sess');
  });

  it('URL/sessionStorage 없고 localStorage 있을 때 localStorage fallback', () => {
    localStorage.setItem('chickenedak:order:17:token', 'local');
    const { result } = renderHook(() => useOrderToken(17), {
      wrapper: wrapper('/x'),
    });
    expect(result.current.token).toBe('local');
  });

  it('어디에도 없으면 token null + query 빈 문자열', () => {
    const { result } = renderHook(() => useOrderToken(17), {
      wrapper: wrapper('/x'),
    });
    expect(result.current.token).toBeNull();
    expect(result.current.query).toBe('');
  });

  it('storeOrderToken — sessionStorage + localStorage 양쪽 저장', () => {
    storeOrderToken(17, 'tkn');
    expect(sessionStorage.getItem('order:17:token')).toBe('tkn');
    expect(localStorage.getItem('chickenedak:order:17:token')).toBe('tkn');
  });
});
