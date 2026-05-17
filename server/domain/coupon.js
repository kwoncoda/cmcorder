// ============================================================
// Task 6.3 — 쿠폰 검증 (ADR-019 변경 + find_error_v3).
//
// 학번 정규식 — ADR-019 변경 (prefix `202637` → 학과 코드 `37`만):
//   `^\d{2}\d{2}37\d{3}$`
//   - [시작년 2자리] [입학년 2자리] [학과 37] [일련번호 3자리] = 9자리
//   - 예: 202637001, 192237012, 222537199
//
// 4단계 검증:
//   1. format (정규식)
//   2. department (학과 코드 37 — 정규식에 포함)
//   3. name (비어있지 않음, trim 후)
//   4. duplicate (used_coupons UNIQUE — find_error_v3: student_id 단일 기준)
//
// find_error_v3 (2026-05-18): 중복 검사 기준을 (student_id, name) → (student_id)로 변경.
// 같은 학번이 이름을 바꿔 쿠폰을 재사용하던 실사용 버그를 차단. 에러 안내도 학번 단위로.
//
// 절대 깨지면 안 되는 ADR (CLAUDE.md):
//   - ADR-019/021 학번 정규식 + 이름 + used_coupons UNIQUE(student_id)
// ============================================================

/**
 * 학번 정규식 (ADR-019 변경).
 * 9자리, 5-6번째 자리가 `37`.
 */
export const STUDENT_ID_PATTERN = /^\d{2}\d{2}37\d{3}$/;

/**
 * CouponError — 쿠폰 검증 실패.
 * @property {string} code — INVALID_FORMAT · NAME_REQUIRED · ALREADY_USED
 */
export class CouponError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CouponError';
    this.code = code;
  }
}

/**
 * 쿠폰 검증 — 4단계.
 * 통과 시 { ok, studentId, name(trimmed) } 반환. 실패 시 CouponError throw.
 *
 * @param {object} input
 * @param {string} input.studentId
 * @param {string} input.name
 * @param {import('better-sqlite3').Database} db
 */
export function validateCoupon({ studentId, name }, db) {
  // 1. format + 2. department (정규식이 둘 다 검증)
  // find_error_v2: 9자리 통과한 학번이라도 학과(37)가 아니면 쿠폰만 거부.
  if (!STUDENT_ID_PATTERN.test(studentId)) {
    throw new CouponError(
      '해당 학번은 쿠폰 대상이 아니에요.',
      'INVALID_FORMAT',
    );
  }
  // 3. name
  if (!name?.trim()) {
    throw new CouponError('이름이 필요합니다', 'NAME_REQUIRED');
  }
  const trimmedName = name.trim();
  // 4. duplicate — find_error_v3: student_id 단일 기준
  const existing = db
    .prepare('SELECT id FROM used_coupons WHERE student_id = ?')
    .get(studentId);
  if (existing) {
    throw new CouponError('이미 쿠폰을 사용한 학번이에요.', 'ALREADY_USED');
  }
  return { ok: true, studentId, name: trimmedName };
}

/**
 * 쿠폰 소비 — validateCoupon 후 used_coupons INSERT.
 * UNIQUE 위반 시 CouponError로 변환 (race condition 가드).
 *
 * @param {object} input
 * @param {string} input.studentId
 * @param {string} input.name
 * @param {number} input.orderId
 * @param {import('better-sqlite3').Database} db
 */
export function consumeCoupon({ studentId, name, orderId }, db) {
  const { name: trimmedName } = validateCoupon({ studentId, name }, db);
  try {
    db.prepare(
      'INSERT INTO used_coupons (student_id, name, order_id) VALUES (?, ?, ?)',
    ).run(studentId, trimmedName, orderId);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new CouponError('이미 쿠폰을 사용한 학번이에요.', 'ALREADY_USED');
    }
    throw err;
  }
}
