// 메뉴 데이터 회귀 — G10·결정 b·ADR-006.
// 본 테스트는 src/constants/menus.js 가 다음을 보장하는지 확인:
//   1. 메뉴 8개 (design-bundle/data.js 와 일치)
//   2. PUBG 코드 8개 보존 (ADR-006 일러스트 매핑 키)
//   3. 본명 한글 (G10 — 리스킨 X / 콜라·사이다 그대로)
//   4. basePrice 양수 정수 (ADR-020 Pattern B)
//   5. CATEGORY_MAP 3종 (chicken/side/drink — MenuFallback 매핑과 일치)
import { describe, it, expect } from 'vitest';
import { MENUS, CATEGORY_MAP } from '../menus.js';

describe('메뉴 데이터 회귀 (G10·결정 b·ADR-006)', () => {
  it('메뉴 8개', () => {
    expect(MENUS).toHaveLength(8);
  });

  it('PUBG 코드 8개 보존 (ADR-006)', () => {
    const codes = MENUS.map((m) => m.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'BANDAGE',
        'FIRST_AID',
        'MED_KIT',
        'SYRINGE',
        'DEFIB',
        'ADRENALINE',
        'PAINKILLER',
        'ENERGY',
      ]),
    );
    // 중복 없음
    expect(new Set(codes).size).toBe(8);
  });

  it('본명 모두 한글 (G10 — 리스킨 X)', () => {
    for (const m of MENUS) {
      // 한글 음절(가-힣) 1자 이상 포함. 영문/숫자 단독 이름 차단.
      expect(m.name).toMatch(/[가-힣]/);
    }
  });

  it('basePrice 양수 정수 (ADR-020 Pattern B)', () => {
    for (const m of MENUS) {
      expect(m.basePrice).toBeGreaterThan(0);
      expect(Number.isInteger(m.basePrice)).toBe(true);
    }
  });

  it('category 는 chicken/side/drink 중 하나 (MenuFallback 매핑과 일치)', () => {
    const allowed = new Set(['chicken', 'side', 'drink']);
    for (const m of MENUS) {
      expect(allowed.has(m.category)).toBe(true);
    }
  });

  it('CATEGORY_MAP 3종 (chicken/side/drink)', () => {
    expect(Object.keys(CATEGORY_MAP).sort()).toEqual(['chicken', 'drink', 'side']);
    expect(CATEGORY_MAP.chicken.emoji).toBe('🍗');
    expect(CATEGORY_MAP.side.emoji).toBe('🍟');
    expect(CATEGORY_MAP.drink.emoji).toBe('🥤');
  });
});
