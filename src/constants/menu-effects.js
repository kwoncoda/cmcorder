// 어드민 메뉴 페이지 전용 정적 효과 매핑 (find_error_v3).
//
// 배경: 어드민 `/admin/api/menus` 응답에 `sub` 필드가 없어 화면이 '—' 만 표시됨.
// 결정: DB/API 확장 없이 프론트 정적 매핑으로 처리 (어드민 한정 — 사용자 메뉴 화면 영향 없음).
//
// SoT: `src/constants/menus.js` 의 MENUS[*].sub
//   - 메뉴 이름이 바뀌어도 code 기준 매핑은 안 깨짐 (ADR-006 PUBG code 안정).
//   - menus.js 한 곳을 수정하면 효과 라벨도 자동 갱신.
//
// 없는 code (예: 추후 메뉴 추가 시) → '—' fallback 으로 UI 깨짐 차단.
import { MENUS } from './menus.js';

const FALLBACK = '—';

// MENUS 의 (code, sub) 만 추출해 frozen dict 구성. 변조 차단.
export const MENU_EFFECT_BY_CODE = Object.freeze(
  MENUS.reduce((acc, m) => {
    if (m.code && m.sub) acc[m.code] = m.sub;
    return acc;
  }, {}),
);

export function effectForCode(code) {
  if (!code) return FALLBACK;
  return MENU_EFFECT_BY_CODE[code] ?? FALLBACK;
}
