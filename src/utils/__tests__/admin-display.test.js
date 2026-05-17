// find_error_v3 (2026-05-18) — actor 라벨 표시용 변환 helper.
//
// 백엔드 DB 의 actor 컬럼 값(admin / admin1 / customer / system / null)은
// 그대로 보존하면서, 사용자 화면(어드민 nav 우상단, 내역 페이지 actor 컬럼)
// 에서만 'admin'/'admin1' → '어드민'으로 변환한다.
//
// 회귀:
//  - 'admin' → '어드민'
//  - 'admin1' → '어드민'
//  - 'customer' / 'system' / 기타 → 그대로 유지
//  - null / undefined → '' 빈 문자열 (UI 안전 fallback)
import { describe, it, expect } from 'vitest';
import { displayActor } from '../admin-display.js';

describe('displayActor (find_error_v3 admin1 → 어드민)', () => {
  it("'admin' → '어드민'", () => {
    expect(displayActor('admin')).toBe('어드민');
  });

  it("'admin1' → '어드민'", () => {
    expect(displayActor('admin1')).toBe('어드민');
  });

  it("'customer' → 'customer' (변환 X)", () => {
    expect(displayActor('customer')).toBe('customer');
  });

  it("'system' → 'system' (변환 X)", () => {
    expect(displayActor('system')).toBe('system');
  });

  it('null → 빈 문자열', () => {
    expect(displayActor(null)).toBe('');
  });

  it('undefined → 빈 문자열', () => {
    expect(displayActor(undefined)).toBe('');
  });

  it("임의 문자열 'guest' → 'guest' (변환 X)", () => {
    expect(displayActor('guest')).toBe('guest');
  });

  it("빈 문자열 '' → '' (그대로)", () => {
    expect(displayActor('')).toBe('');
  });
});
