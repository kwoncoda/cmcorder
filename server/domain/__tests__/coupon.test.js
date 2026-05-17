// Task 6.3 — 쿠폰 검증 (ADR-019 변경) + find_error_v3 (student_id 단일 UNIQUE).
//
// 학번 정규식 `^\d{2}\d{2}37\d{3}$` — 학과 코드 37 (입학년·일련번호는 자유).
// 4단계 검증: format · department(37, 정규식 포함) · name · duplicate.
//
// find_error_v3 (2026-05-18): used_coupons UNIQUE 기준이 (student_id, name) → (student_id).
// 같은 학번은 이름을 바꿔도 쿠폰 재사용 불가. 에러 문구도 학번 단위로 변경.
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import {
  validateCoupon,
  consumeCoupon,
  CouponError,
  STUDENT_ID_PATTERN,
} from '../coupon.js';

let db;

beforeEach(() => {
  db = new Database(':memory:');
  bootstrapDatabase(db);
  // 더미 주문 — used_coupons.order_id FK 충족
  db.prepare(
    `INSERT INTO orders (no, operating_date, name, total_price)
     VALUES (1, '2026-05-20', '테스트', 18000)`,
  ).run();
  // 두 번째 더미 주문 — 동일 학번 다른 주문 재사용 시도 시 FK 충족용
  db.prepare(
    `INSERT INTO orders (no, operating_date, name, total_price)
     VALUES (2, '2026-05-20', '테스트2', 18000)`,
  ).run();
});

describe('coupon — STUDENT_ID_PATTERN (ADR-019 변경)', () => {
  it('★ 정상 학번 (예: 20263701, 19223712, 22253199)', () => {
    expect(STUDENT_ID_PATTERN.test('202637001')).toBe(true);
    expect(STUDENT_ID_PATTERN.test('192237012')).toBe(true);
    expect(STUDENT_ID_PATTERN.test('222537199')).toBe(true);
    expect(STUDENT_ID_PATTERN.test('999937999')).toBe(true);
  });

  it('★ 학과 코드가 37이 아니면 거부 (예: 202627001)', () => {
    expect(STUDENT_ID_PATTERN.test('202627001')).toBe(false);
    expect(STUDENT_ID_PATTERN.test('202647001')).toBe(false);
    expect(STUDENT_ID_PATTERN.test('202600001')).toBe(false);
  });

  it('★ 길이 불일치 거부 (8자리, 10자리)', () => {
    expect(STUDENT_ID_PATTERN.test('20263701')).toBe(false); // 8자
    expect(STUDENT_ID_PATTERN.test('2026370001')).toBe(false); // 10자
  });

  it('★ 영문/특수문자 거부', () => {
    expect(STUDENT_ID_PATTERN.test('20263701a')).toBe(false);
    expect(STUDENT_ID_PATTERN.test('202637-01')).toBe(false);
    expect(STUDENT_ID_PATTERN.test('')).toBe(false);
  });
});

describe('validateCoupon — 4단계', () => {
  it('★ 정상 검증 통과', () => {
    const r = validateCoupon(
      { studentId: '202637001', name: '홍길동' },
      db,
    );
    expect(r.ok).toBe(true);
    expect(r.studentId).toBe('202637001');
    expect(r.name).toBe('홍길동');
  });

  it('★ 형식 오류 거부 (INVALID_FORMAT)', () => {
    try {
      validateCoupon({ studentId: '20263701', name: '홍길동' }, db);
      expect.fail('throw 해야 함');
    } catch (err) {
      expect(err).toBeInstanceOf(CouponError);
      expect(err.code).toBe('INVALID_FORMAT');
    }
  });

  it('★ 학과 코드 37 X 거부 (INVALID_FORMAT)', () => {
    expect(() =>
      validateCoupon({ studentId: '202627001', name: '홍길동' }, db),
    ).toThrow(CouponError);
  });

  it('★ 이름 빈 거부 (NAME_REQUIRED)', () => {
    try {
      validateCoupon({ studentId: '202637001', name: '' }, db);
      expect.fail('throw 해야 함');
    } catch (err) {
      expect(err).toBeInstanceOf(CouponError);
      expect(err.code).toBe('NAME_REQUIRED');
    }
  });

  it('★ 이름 공백만 거부 (NAME_REQUIRED)', () => {
    expect(() =>
      validateCoupon({ studentId: '202637001', name: '   ' }, db),
    ).toThrow(CouponError);
  });

  it('★ 중복 사용 거부 (ALREADY_USED) — 같은 학번/같은 이름', () => {
    db.prepare(
      `INSERT INTO used_coupons (student_id, name, order_id)
       VALUES (?, ?, ?)`,
    ).run('202637001', '홍길동', 1);

    try {
      validateCoupon({ studentId: '202637001', name: '홍길동' }, db);
      expect.fail('throw 해야 함');
    } catch (err) {
      expect(err).toBeInstanceOf(CouponError);
      expect(err.code).toBe('ALREADY_USED');
    }
  });

  // ── find_error_v3 (2026-05-18) — student_id 단일 UNIQUE ───────────────
  it('★ find_error_v3 — 같은 학번/다른 이름이라도 거부 (ALREADY_USED)', () => {
    db.prepare(
      `INSERT INTO used_coupons (student_id, name, order_id)
       VALUES (?, ?, ?)`,
    ).run('202637001', '홍길동', 1);

    try {
      validateCoupon({ studentId: '202637001', name: '김철수' }, db);
      expect.fail('같은 학번이면 이름 달라도 거부해야 함');
    } catch (err) {
      expect(err).toBeInstanceOf(CouponError);
      expect(err.code).toBe('ALREADY_USED');
    }
  });

  it('★ find_error_v3 — ALREADY_USED 에러 메시지가 학번 기준 안내', () => {
    db.prepare(
      `INSERT INTO used_coupons (student_id, name, order_id)
       VALUES (?, ?, ?)`,
    ).run('202637001', '홍길동', 1);

    try {
      validateCoupon({ studentId: '202637001', name: '홍길동' }, db);
      expect.fail('throw 해야 함');
    } catch (err) {
      expect(err.message).toBe('이미 쿠폰을 사용한 학번이에요.');
    }
  });

  it('★ find_error_v3 — 다른 학번은 영향 없이 통과', () => {
    db.prepare(
      `INSERT INTO used_coupons (student_id, name, order_id)
       VALUES (?, ?, ?)`,
    ).run('202637001', '홍길동', 1);

    const r = validateCoupon(
      { studentId: '202637002', name: '홍길동' },
      db,
    );
    expect(r.ok).toBe(true);
  });

  it('★ 같은 학번이라도 이름 다르면 trim 후 비교 — 동일 거부 (student_id UNIQUE)', () => {
    db.prepare(
      `INSERT INTO used_coupons (student_id, name, order_id)
       VALUES (?, ?, ?)`,
    ).run('202637001', '홍길동', 1);

    // 같은 학번 + 앞뒤 공백 이름 → 거부 (student_id UNIQUE)
    expect(() =>
      validateCoupon({ studentId: '202637001', name: '  홍길동  ' }, db),
    ).toThrow(CouponError);
  });
});

describe('consumeCoupon — used_coupons INSERT', () => {
  it('★ 정상 소비 — used_coupons 행 추가', () => {
    consumeCoupon(
      { studentId: '202637001', name: '홍길동', orderId: 1 },
      db,
    );
    const row = db
      .prepare('SELECT student_id, name, order_id FROM used_coupons')
      .get();
    expect(row.student_id).toBe('202637001');
    expect(row.name).toBe('홍길동');
    expect(row.order_id).toBe(1);
  });

  it('★ UNIQUE 위반 시 CouponError (ALREADY_USED)', () => {
    consumeCoupon(
      { studentId: '202637001', name: '홍길동', orderId: 1 },
      db,
    );

    // 동일 학번 재시도 — validateCoupon이 먼저 막거나 INSERT가 막거나
    expect(() =>
      consumeCoupon(
        { studentId: '202637001', name: '홍길동', orderId: 2 },
        db,
      ),
    ).toThrow(CouponError);
  });

  // ── find_error_v3 — DB UNIQUE 위반 race 시뮬레이션 ───────────────
  it('★ find_error_v3 — validateCoupon 우회 후 직접 INSERT 두 번 → SQLITE_CONSTRAINT_UNIQUE', () => {
    db.prepare(
      `INSERT INTO used_coupons (student_id, name, order_id) VALUES (?, ?, ?)`,
    ).run('202637001', '홍길동', 1);

    // 같은 student_id, 다른 이름으로 직접 INSERT → DB UNIQUE 제약이 잡아야.
    let err;
    try {
      db.prepare(
        `INSERT INTO used_coupons (student_id, name, order_id) VALUES (?, ?, ?)`,
      ).run('202637001', '김철수', 2);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('SQLITE_CONSTRAINT_UNIQUE');
  });

  it('★ find_error_v3 — 같은 학번 다른 이름으로 consumeCoupon 시도 → ALREADY_USED', () => {
    consumeCoupon(
      { studentId: '202637001', name: '홍길동', orderId: 1 },
      db,
    );

    try {
      consumeCoupon(
        { studentId: '202637001', name: '김철수', orderId: 2 },
        db,
      );
      expect.fail('throw 해야 함');
    } catch (err) {
      expect(err).toBeInstanceOf(CouponError);
      expect(err.code).toBe('ALREADY_USED');
      expect(err.message).toBe('이미 쿠폰을 사용한 학번이에요.');
    }
  });
});
