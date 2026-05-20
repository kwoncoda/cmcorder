// 메뉴 10종 데이터 — G10 본명 + ADR-006 PUBG 매핑 / 결정 b 일러스트 매핑.
// 원천: docs/design-bundle/data.js (7차 기획서·DESIGN §10.5).
// menu_update 라운드 (2026-05-20): 신규 메뉴 2종(생수/양념 소스) 추가 + 기존 6종 가격 갱신
// + id=5 sold_out 기본값 false. 표시명은 보존(사용자 지시 — 이름 임의 변경 X).
//
// 본 파일이 메뉴 데이터의 single source of truth (Phase 2~4 기간).
// 추후 백엔드 GET /api/menus 응답으로 대체 가능하지만, 그 전까지는 본 상수에서 직접 로드.
//
// 형식 결정:
// - id: 숫자 (DB 정수 PK 가정 — design-bundle 'm1' 문자열은 프로토타입용)
// - code: PUBG 회복 아이템 코드 (ADR-006 — 일러스트 매핑·로깅·assets 파일명 키)
//         menu_update 라운드: 신규 메뉴는 사용자 지시에 따라 lowercase(bluezone/fuel).
// - name: 본명 (한국어, G10 — 콜라/사이다 그대로, 리스킨 X)
// - category: 'chicken' | 'side' | 'drink' (MenuFallback 이모지 매핑과 일치 — 영문 키)
// - basePrice: 정수 원 (ADR-020 Pattern B — 가격 자체 계산용 서버 ground truth)
// - image: 자산 경로 (자산 미수령 시 MenuFallback 분류 이모지 fallback)
// - sub: PUBG 효과 부가 텍스트 (옵션 — 회복량/부스트 등)
// - recommended: 기본 추천 여부 (관리자가 토글 가능 — 본 데이터는 초깃값)
// - soldOut: 기본 품절 여부 (관리자 토글 — 본 데이터는 초깃값)
//
// 분류·가격은 design-bundle/data.js 와 일치 (7차 기획서 기준 — 회귀 시 menus.test.js 가 보호).
export const MENUS = [
  { id:  1, code: 'BANDAGE',    name: '후라이드',       category: 'chicken', basePrice:  8000, image: '/items/bandage.webp',    sub: '회복량 +10',   recommended: true,  soldOut: false },
  { id:  2, code: 'FIRST_AID',  name: '양념',           category: 'chicken', basePrice:  9000, image: '/items/first-aid.webp',  sub: '회복량 +75',   recommended: false, soldOut: false },
  { id:  3, code: 'MED_KIT',    name: '뿌링클',         category: 'chicken', basePrice: 11000, image: '/items/med-kit.webp',    sub: '회복량 +100',  recommended: true,  soldOut: false },
  { id:  4, code: 'SYRINGE',    name: '감자튀김',       category: 'side',    basePrice:  4000, image: '/items/syringe.webp',    sub: '부활',         recommended: false, soldOut: false },
  { id:  5, code: 'DEFIB',      name: '뿌링감자튀김',   category: 'side',    basePrice:  5000, image: '/items/defib.webp',      sub: '소생',         recommended: false, soldOut: false },
  { id:  6, code: 'ADRENALINE', name: '칠리스',         category: 'side',    basePrice:  4500, image: '/items/adrenaline.webp', sub: '부스트 +100%', recommended: false, soldOut: false },
  { id:  7, code: 'PAINKILLER', name: '콜라',           category: 'drink',   basePrice:  2000, image: '/items/painkiller.webp', sub: '부스트 +60%',  recommended: false, soldOut: false },
  { id:  8, code: 'ENERGY',     name: '사이다',         category: 'drink',   basePrice:  2000, image: '/items/energy.webp',     sub: '부스트 +40%',  recommended: false, soldOut: false },
  { id:  9, code: 'bluezone',   name: '생수',           category: 'side',    basePrice:  1000, image: '/items/bluezone.webp',   sub: '목마름 -35%',  recommended: false, soldOut: false },
  { id: 10, code: 'fuel',       name: '양념 소스',      category: 'side',    basePrice:   500, image: '/items/fuel.webp',       sub: '연료 +35%',    recommended: false, soldOut: false },
];

// 분류 매핑 — MenuFallback 이모지 + 라벨 (한글 표기).
// chicken: 🍗  / side: 🍟  / drink: 🥤  — ADR-006.
export const CATEGORY_MAP = {
  chicken: { label: '치킨',   emoji: '🍗' },
  side:    { label: '사이드', emoji: '🍟' },
  drink:   { label: '음료',   emoji: '🥤' },
};
