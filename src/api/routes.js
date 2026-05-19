// API 경로 상수 — Task 3.2.
//
// 단일 진실 출처. 백엔드 경로 변경 시 본 파일만 갱신.
// 파라미터화된 경로는 함수 형태 (예: ORDER(123) === '/api/orders/123').
//
// 출처: docs/API_DRAFT.md §1 (사용자) + §2 (관리자).
export const API = {
  // 사용자
  MENUS: '/api/menus',
  POPULAR: '/api/popular',
  BUSINESS_STATE: '/api/business-state',
  ORDERS: '/api/orders',
  ORDER: (id) => `/api/orders/${id}`,
  ORDER_TRANSFER_REPORT: (id) => `/api/orders/${id}/transfer-report`,
  ORDER_STREAM: (id) => `/api/orders/${id}/stream`,
  ORDER_SUMMARY: '/api/orders/summary',

  // 관리자
  ADMIN_LOGIN: '/admin/login',
  ADMIN_LOGOUT: '/admin/logout',
  ADMIN_ORDERS: '/admin/api/orders',
  ADMIN_ORDER: (id) => `/admin/api/orders/${id}`,
  ADMIN_ORDER_TRANSITION: (id) => `/admin/api/orders/${id}/transition`,
  ADMIN_TRANSFERS: '/admin/api/transfers',
  ADMIN_MENU_TOGGLE: (id) => `/admin/api/menus/${id}/toggle`,
  ADMIN_BUSINESS_STATE: '/admin/api/business/state',
  ADMIN_BUSINESS_OPEN: '/admin/api/business/open',
  ADMIN_SETTLEMENT_BASE: '/admin/api/settlement',
  ADMIN_SETTLEMENT_CLOSE: '/admin/api/settlement/close',
  ADMIN_SETTLEMENT_ZIP: '/admin/api/settlement/zip',
  // find_error_v2 — 관리자 내역(history) + 쿠폰(coupons) 탭 복원.
  ADMIN_HISTORY: '/admin/api/history',
  ADMIN_COUPONS_USAGE: '/admin/api/coupons/usage',
  // Subagent 1 — 사용자용 테이블 가용성
  TABLES_AVAILABILITY: '/api/tables/availability',
  // Subagent 4 — 어드민 테이블 잠금
  ADMIN_TABLES: '/admin/api/tables',
  ADMIN_TABLE_LOCK: (n) => `/admin/api/tables/${n}/lock`,
  ADMIN_TABLE_UNLOCK: (n) => `/admin/api/tables/${n}/unlock`,
};
