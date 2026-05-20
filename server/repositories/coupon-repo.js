// Task 6.5 — 쿠폰 리포지토리.
//
// 검증·UNIQUE 위반 변환은 domain/coupon.js가 담당.
// 본 모듈은 단순 조회 helper만 제공 (관리자 통계 화면 등).

/**
 * 학번이 이미 쿠폰을 사용했는지 확인.
 *
 * find_error_v3 (2026-05-18): UNIQUE 기준이 (student_id, name) → (student_id).
 * 두 번째 인자 name은 호출자 호환을 위해 시그니처는 보존하되, 쿼리에서는 사용 X.
 */
// eslint-disable-next-line no-unused-vars
export function hasCouponBeenUsed(db, studentId, name) {
  const row = db
    .prepare('SELECT id FROM used_coupons WHERE student_id = ?')
    .get(studentId);
  return !!row;
}

/**
 * 사용된 쿠폰 전체 행 (관리자 화면).
 */
export function listUsedCoupons(db) {
  return db
    .prepare('SELECT * FROM used_coupons ORDER BY used_at DESC')
    .all();
}

/**
 * 사용된 쿠폰 누적 카운트.
 */
export function countUsedCoupons(db) {
  return db.prepare('SELECT COUNT(*) AS c FROM used_coupons').get().c;
}

/**
 * find_error_v2 — operating_date 필터 + orders JOIN(order_no) 쿠폰 사용 내역.
 *
 * used_coupons 테이블은 used_at만 보유. orders와 JOIN해야 operating_date 필터링과
 * order_no(일자별 시퀀스 표시번호) 동봉이 가능. 쿠폰명/할인 금액은 ADR-019 상수
 * (재구현 없음) — 라우트에서 일정한 상수를 응답에 덧붙인다.
 *
 * 2026-05-21 (coupon-tab-scope-toggle):
 *   - SELECT에 o.operating_date 추가 — 어드민 "전체 누적" 모드에서 행별 영업일 표시용.
 *   - operating_date === 'all' 분기 — WHERE 절 제거하여 양일 합산. 기존 호출자
 *     (auto-snapshot ZIP, server/jobs/auto-snapshot.js:476)는 항상 구체 일자만
 *     넘기므로 영향 0.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ operating_date: 'all' | string }} params
 * @returns {Array<{ id, order_id, order_no, student_id, name, used_at, operating_date }>}
 */
export function listCouponUsage(db, { operating_date }) {
  const select = `SELECT uc.id, uc.order_id, o.no AS order_no,
                         uc.student_id, uc.name, uc.used_at,
                         o.operating_date AS operating_date
                    FROM used_coupons uc
                    JOIN orders o ON o.id = uc.order_id`;
  const order = `ORDER BY uc.used_at DESC, uc.id DESC`;
  if (operating_date === 'all') {
    return db.prepare(`${select} ${order}`).all();
  }
  return db
    .prepare(`${select} WHERE o.operating_date = ? ${order}`)
    .all(operating_date);
}
