// A-2 본부 대시보드 6 컬럼 정의 (IMPLEMENTATION_PLAN §5.2 / SCREEN §3.7).
//
// 모듈 최상위 상수로 분리 — DashboardPage(≤120줄, §3.5 1조) 경량화 + 재사용.
// status 값은 백엔드 주문 상태 enum 과 일치 (DB_DRAFT §orders.status).
// color 는 컬럼 헤더 보조 색상 클래스 (시맨틱 토큰).
export const ADMIN_COLUMNS = [
  { status: 'ORDERED',           title: '주문중',       color: 'border-info' },
  { status: 'TRANSFER_REPORTED', title: '이체확인요청', color: 'border-warning' },
  { status: 'PAID',              title: '이체완료',     color: 'border-success' },
  { status: 'COOKING',           title: '조리중',       color: 'border-accent' },
  { status: 'READY',             title: '수령대기',     color: 'border-accent' },
  { status: 'HOLD',              title: '보류',         color: 'border-danger' },
];

// 주문 배열을 컬럼별 그룹으로 분리. 알 수 없는 status 는 무시 (방어).
// 반환: { ORDERED: [...], TRANSFER_REPORTED: [...], ... } — 항상 6개 키 보장.
export function groupOrdersByStatus(orders) {
  const grouped = Object.fromEntries(ADMIN_COLUMNS.map((c) => [c.status, []]));
  if (!Array.isArray(orders)) return grouped;
  for (const o of orders) {
    if (grouped[o.status]) grouped[o.status].push(o);
  }
  return grouped;
}
