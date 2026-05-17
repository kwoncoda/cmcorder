// find_error_v3 (2026-05-18) — actor 라벨 표시용 변환 helper.
//
// 백엔드 DB 의 actor 컬럼 값(admin / admin1 / customer / system / null)은
// 그대로 보존하면서, 사용자 화면(어드민 nav 우상단, 내역 페이지 actor 컬럼)
// 에서만 'admin'/'admin1' → '어드민'으로 변환한다.
//
// 사용처:
//  - src/components/layouts/AdminLayout.jsx (우상단 라벨)
//  - src/pages/admin/HistoryPage.jsx (.log-actor 행 표시)
//
// 회귀: src/utils/__tests__/admin-display.test.js (8 케이스)
export function displayActor(actor) {
  if (actor === 'admin' || actor === 'admin1') return '어드민';
  return actor ?? '';
}
