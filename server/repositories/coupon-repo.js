// Task 6.5 — 쿠폰 리포지토리.
//
// 검증·UNIQUE 위반 변환은 domain/coupon.js가 담당.
// 본 모듈은 단순 조회 helper만 제공 (관리자 통계 화면 등).

/**
 * 학번+이름 조합이 이미 쿠폰을 사용했는지 확인.
 */
export function hasCouponBeenUsed(db, studentId, name) {
  const row = db
    .prepare('SELECT id FROM used_coupons WHERE student_id = ? AND name = ?')
    .get(studentId, name);
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
