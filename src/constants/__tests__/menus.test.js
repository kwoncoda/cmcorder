// 메뉴 데이터 회귀 — G10·결정 b·ADR-006.
// menu_update 라운드 (2026-05-20): 메뉴 8 → 10, 신규 코드(bluezone/fuel) 추가, 가격 갱신.
// 본 테스트는 src/constants/menus.js 가 다음을 보장하는지 확인:
//   1. 메뉴 10개 (8 + 신규 2)
//   2. PUBG 코드 8개 + 신규 lowercase 코드 2개 (ADR-006 일러스트 매핑 키)
//   3. 본명 한글 (G10 — 리스킨 X / 콜라·사이다 그대로)
//   4. basePrice 양수 정수 (ADR-020 Pattern B)
//   5. CATEGORY_MAP 3종 (chicken/side/drink — MenuFallback 매핑과 일치)
//   6. menu_update — 모든 메뉴 기본 판매 가능 (soldOut=false)
//   7. menu_update — 신규 메뉴 가격/분류 단언
import { describe, it, expect } from 'vitest';
import { MENUS, CATEGORY_MAP } from '../menus.js';

describe('메뉴 데이터 회귀 (G10·결정 b·ADR-006 + menu_update)', () => {
  it('메뉴 10개 (menu_update — 신규 2종 추가)', () => {
    expect(MENUS).toHaveLength(10);
  });

  it('PUBG 코드 8개 + 신규 코드 2개 = 총 10개 보존 (ADR-006 + menu_update)', () => {
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
        'bluezone',
        'fuel',
      ]),
    );
    // 중복 없음
    expect(new Set(codes).size).toBe(10);
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

  // ── menu_update 라운드 (2026-05-20) — 신규 회귀 ──────────────
  it('★ menu_update — 모든 메뉴 기본 판매 가능 (soldOut=false)', () => {
    for (const m of MENUS) {
      expect(m.soldOut).toBe(false);
    }
  });

  it('★ menu_update — 신규 메뉴 bluezone(생수) id=9, 가격 1000, side', () => {
    const m = MENUS.find((x) => x.code === 'bluezone');
    expect(m).toBeDefined();
    expect(m.id).toBe(9);
    expect(m.name).toBe('생수');
    expect(m.category).toBe('side');
    expect(m.basePrice).toBe(1000);
    expect(m.image).toBe('/items/bluezone.webp');
    expect(m.sub).toBe('목마름 -35%');
  });

  it('★ menu_update — 신규 메뉴 fuel(양념 소스) id=10, 가격 500, side', () => {
    const m = MENUS.find((x) => x.code === 'fuel');
    expect(m).toBeDefined();
    expect(m.id).toBe(10);
    expect(m.name).toBe('양념 소스');
    expect(m.category).toBe('side');
    expect(m.basePrice).toBe(500);
    expect(m.image).toBe('/items/fuel.webp');
    expect(m.sub).toBe('연료 +35%');
  });

  it('★ menu_update — 기존 6종 가격 갱신값과 일치', () => {
    const byCode = Object.fromEntries(MENUS.map((m) => [m.code, m]));
    expect(byCode.BANDAGE.basePrice).toBe(8000);
    expect(byCode.FIRST_AID.basePrice).toBe(9000);
    expect(byCode.MED_KIT.basePrice).toBe(11000);
    expect(byCode.SYRINGE.basePrice).toBe(4000);
    expect(byCode.DEFIB.basePrice).toBe(5000);
    expect(byCode.ADRENALINE.basePrice).toBe(4500);
    // 변경 없음
    expect(byCode.PAINKILLER.basePrice).toBe(2000);
    expect(byCode.ENERGY.basePrice).toBe(2000);
  });
});
