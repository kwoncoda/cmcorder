// find_error_v3 — 어드민 메뉴 효과 매핑 회귀.
//
// 보호 항목:
//   1. 8개 메뉴 code 각각 정확한 한국어 효과 라벨 반환 (BANDAGE → '회복량 +10' 등)
//   2. 없는 code · null · undefined → '—' fallback (UI 깨짐 X)
//   3. MENU_EFFECT_BY_CODE 는 frozen (런타임 변조 차단)
//   4. menus.js 의 sub 와 일치 (SoT = menus.js — derive 방식)
import { describe, it, expect } from 'vitest';
import { MENU_EFFECT_BY_CODE, effectForCode } from '../menu-effects.js';
import { MENUS } from '../menus.js';

describe('어드민 메뉴 효과 매핑 (find_error_v3)', () => {
  it('★ 8개 code 각각 정확한 라벨 반환', () => {
    expect(effectForCode('BANDAGE')).toBe('회복량 +10');
    expect(effectForCode('FIRST_AID')).toBe('회복량 +75');
    expect(effectForCode('MED_KIT')).toBe('회복량 +100');
    expect(effectForCode('SYRINGE')).toBe('부활');
    expect(effectForCode('DEFIB')).toBe('소생');
    expect(effectForCode('ADRENALINE')).toBe('부스트 +100%');
    expect(effectForCode('PAINKILLER')).toBe('부스트 +60%');
    expect(effectForCode('ENERGY')).toBe('부스트 +40%');
  });

  it('★ 없는 code → "—" fallback', () => {
    expect(effectForCode('UNKNOWN')).toBe('—');
    expect(effectForCode('NOT_REAL_CODE')).toBe('—');
  });

  it('★ null/undefined/빈문자열 → "—" fallback', () => {
    expect(effectForCode(null)).toBe('—');
    expect(effectForCode(undefined)).toBe('—');
    expect(effectForCode('')).toBe('—');
  });

  it('★ MENU_EFFECT_BY_CODE 는 frozen (변조 차단)', () => {
    expect(Object.isFrozen(MENU_EFFECT_BY_CODE)).toBe(true);
  });

  it('★ menus.js 의 sub 와 일치 (SoT = menus.js)', () => {
    for (const m of MENUS) {
      if (m.code && m.sub) {
        expect(MENU_EFFECT_BY_CODE[m.code]).toBe(m.sub);
      }
    }
    // 매핑된 키 수가 MENUS 의 (code+sub) 보유 항목 수와 일치
    const expected = MENUS.filter((m) => m.code && m.sub).length;
    expect(Object.keys(MENU_EFFECT_BY_CODE)).toHaveLength(expected);
  });
});
