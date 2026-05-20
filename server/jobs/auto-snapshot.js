// Task 6.9 — 자동 ZIP 스냅샷 (ADR-022 변경 — 30분 → 2시간, 6개 회전).
//
// 책임:
//   - createSnapshotZip: SQLite DB → ZIP 파일로 압축 (file system) [자동 백업 트랙]
//   - createSettlementZip: 운영자 한국어 정산 ZIP (정산서.txt + 주문내역.csv + 쿠폰내역.csv)
//     adjustment 라운드 Subagent 3 (2026-05-20) — 기존 6파일 ZIP 폐기.
//   - startAutoSnapshot: setInterval 2시간 + 6개 회전 cleanup
//
// 동작 세부:
//   - better-sqlite3는 동기 — 트랜잭션 시점 일관성
//   - WAL checkpoint(TRUNCATE)로 main DB에 모든 변경 flush
//   - 회전: 최신 N개 유지, 오래된 것 unlinkSync
//   - 즉시 1회 실행 X — startup 부담 회피 (첫 tick은 intervalMs 후)
import {
  createWriteStream,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { logger } from '../lib/logger.js';
import { logAdminEvent } from '../repositories/admin-events-repo.js';
import { getBusinessState } from '../domain/business-state.js';
import { getSettlementSummary, getMenuSales } from '../domain/settlement.js';
import { listCouponUsage } from '../repositories/coupon-repo.js';

const DEFAULT_INTERVAL_MS =
  (Number(process.env.AUTO_SNAPSHOT_INTERVAL_MIN) || 120) * 60 * 1000;
const DEFAULT_MAX_BACKUPS =
  Number(process.env.AUTO_SNAPSHOT_ROTATE) || 6;
const DEFAULT_BACKUP_DIR = process.env.BACKUP_DIR ?? './backups';

/**
 * DB를 ZIP 파일로 압축. dbPath 존재 시 raw 파일 포함,
 * 부재 시 :memory: DB 대비 .sql dump 생성.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} dbPath
 * @param {string} outputPath
 * @returns {Promise<string>} 생성된 ZIP 경로
 */
export async function createSnapshotZip(db, dbPath, outputPath) {
  const dir = path.dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // WAL checkpoint → main DB로 flush (스냅샷 일관성)
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    // :memory: DB는 WAL 미지원 — 무시
    logger.debug({ err: err.message }, '[auto-snapshot] WAL checkpoint skip');
  }

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', () => resolve(outputPath));
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    if (existsSync(dbPath)) {
      archive.file(dbPath, { name: 'order.sqlite' });
    } else {
      // :memory: DB 또는 dbPath 부재 — .sql dump
      const dump = serializeDb(db);
      archive.append(dump, { name: 'order.sql' });
    }
    archive.finalize();
  });
}

// ── adjustment 라운드 Subagent 3 — 정산 ZIP 한국어 3파일 ────────────────
// Excel 한글 호환 — UTF-8 BOM 선두 부착 (기존 코드 패턴 유지).
const UTF8_BOM = '﻿';
// CRLF — Windows 메모장/Excel 호환.
const CRLF = '\r\n';
// ADR-019 쿠폰 정액 할인 + 쿠폰명 상수 (DB 미저장).
const COUPON_DISCOUNT_PER = 1000;
const COUPON_NAME = '컴모융 1,000원 할인';

// Q7 — 상태 한국어 라벨 (TXT / CSV 공통).
const STATUS_KO = {
  SETTLED: '정리 완료',
  DONE: '완료(레거시)',
  CANCELED: '취소',
  DINING: '식사 중',
  READY: '수령 대기',
  COOKING: '조리 중',
  PAID: '결제 확인',
  TRANSFER_REPORTED: '이체 신고',
  ORDERED: '주문 접수',
  HOLD: '보류',
};

function statusLabel(s) {
  return STATUS_KO[s] ?? s ?? '';
}

// 매출 집계 상태 (settlement.js와 동일 — SETTLED + 레거시 DONE).
const COMPLETED_STATES = ['SETTLED', 'DONE'];

/**
 * 정산 ZIP — Buffer 즉시 반환 (HTTP 응답 다운로드용).
 *
 * adjustment 라운드 Subagent 3 (2026-05-20):
 *   - 기존 manifest/summary/menu-snapshot/settlement.sql 폐기.
 *   - 한국어 파일 3종:
 *     1) 정산서-{YYYY-MM-DD}.txt — 6섹션 (요약/결제 검증/메뉴별/카테고리/배달 형태/취소)
 *     2) 주문내역-{YYYY-MM-DD}.csv — 한국어 헤더 + 운영 컬럼 정제 (UTF-8 BOM + CRLF)
 *     3) 쿠폰내역-{YYYY-MM-DD}.csv — 한국어 헤더 (UTF-8 BOM + CRLF)
 *   - ZIP 내부 파일명도 한국어. archiver의 compress-commons가 비 ASCII 바이트를
 *     감지하면 자동으로 EFS bit 11(UTF-8 names flag)을 켠다. (확인됨 —
 *     `compress-commons/lib/archivers/zip/zip-archive-entry.js:294` setName에서
 *     `Buffer.byteLength(name) !== name.length`로 판정.)
 *
 * Q1 — 시그니처 확장: { operating_date?, bank_total? }.
 *   - 후방 호환: 인자 누락 시 business_state.operating_date 사용.
 * Q3 — bank_total은 라우트 ?bank= query에서 정수 파싱. 누락/유효하지 않음 → undefined.
 * Q4 — 취소시각은 status='CANCELED'일 때만 `updated_at`을 사용 (DB schema 변경 X).
 * Q8 — 합산(`all`) 모드 ZIP 없음 — UI(Subagent 4)가 단일 일자만 다운로드 허용.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ operating_date?: string, bank_total?: number }} [opts]
 * @returns {Promise<Buffer>}
 */
export async function createSettlementZip(db, opts = {}) {
  const operating_date =
    opts.operating_date ?? getBusinessState(db).operating_date;
  const bank_total =
    typeof opts.bank_total === 'number' && Number.isFinite(opts.bank_total)
      ? opts.bank_total
      : undefined;

  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    const txt = exportSettlementText(db, { operating_date, bank_total });
    const ordersCsv = exportOrdersCsv(db, operating_date);
    const couponsCsv = exportCouponsCsv(db, operating_date);

    archive.append(txt, { name: `정산서-${operating_date}.txt` });
    archive.append(ordersCsv, { name: `주문내역-${operating_date}.csv` });
    archive.append(couponsCsv, { name: `쿠폰내역-${operating_date}.csv` });
    archive.finalize();
  });
}

// ── 정산서.txt 6섹션 ─────────────────────────────────────
// 개발기획서 §5.3 템플릿 그대로. UTF-8 + CRLF.

function formatCurrency(n) {
  // 정수 원 단위. 음수 허용. 천 단위 구분(,) + "원" 접미.
  const v = Number.isFinite(n) ? Math.trunc(n) : 0;
  return `${v.toLocaleString('en-US')}원`;
}

function exportSettlementText(db, { operating_date, bank_total }) {
  const summary = getSettlementSummary(db, operating_date);
  const menuSales = getMenuSales(db, operating_date);
  const generated_at = new Date().toISOString();

  // [2] 결제 검증 — 실제 송금액 합계 (Q4: status IN COMPLETED_STATES + amount NOT NULL).
  const placeholders = COMPLETED_STATES.map(() => '?').join(',');
  const transferRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS s
         FROM orders
        WHERE operating_date = ?
          AND status IN (${placeholders})
          AND amount IS NOT NULL`,
    )
    .get(operating_date, ...COMPLETED_STATES);
  const transferSum = transferRow?.s ?? 0;

  // [4] 카테고리 소계 — order_items.category GROUP BY (chicken/side/drink).
  const categoryLabel = { chicken: '치킨', side: '사이드', drink: '음료' };
  const categoryRows = db
    .prepare(
      `SELECT oi.category AS category,
              COALESCE(SUM(oi.quantity), 0) AS quantity,
              COALESCE(SUM(oi.quantity * oi.base_price), 0) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.operating_date = ?
          AND o.status IN (${placeholders})
        GROUP BY oi.category`,
    )
    .all(operating_date, ...COMPLETED_STATES);

  // [5] 배달 형태별 — orders.delivery_type GROUP BY (dineIn/takeout).
  // adjustment Codex P1-2 후속 (2026-05-20): 매출 기준을 [3][4]와 같이 gross(주문항목
  // 단가 합계)로 통일. 이전 SUM(orders.total_price)는 NET이라 쿠폰 주문이 섞이면 [3][4]와
  // 다른 기준이 되어 정산 대조가 어긋났다. order_items JOIN으로 변경.
  const deliveryRows = db
    .prepare(
      `SELECT o.delivery_type AS type,
              COUNT(DISTINCT o.id) AS quantity,
              COALESCE(SUM(oi.quantity * oi.base_price), 0) AS revenue
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.operating_date = ?
          AND o.status IN (${placeholders})
        GROUP BY o.delivery_type`,
    )
    .all(operating_date, ...COMPLETED_STATES);
  const deliveryLabel = { dineIn: '매장', takeout: '포장' };

  // [6] 취소 — CANCELED COUNT + canceled_reason GROUP BY.
  // Q4: 각 행 시각은 status=CANCELED의 updated_at 사용. canceled_at 컬럼은 스키마에 없음.
  const cancelTotal = db
    .prepare(
      `SELECT COUNT(*) AS c FROM orders
        WHERE operating_date = ? AND status = 'CANCELED'`,
    )
    .get(operating_date).c;
  // 사유별 분포 (NULL 사유는 그대로 NULL group으로).
  const cancelReasonRows = db
    .prepare(
      `SELECT canceled_reason AS reason, COUNT(*) AS c
         FROM orders
        WHERE operating_date = ? AND status = 'CANCELED'
        GROUP BY canceled_reason`,
    )
    .all(operating_date);

  // 메뉴별 매출 합계 — adjustment Codex P1-2 (2026-05-20):
  //   기준을 summary.gross_amount(= NET + 쿠폰 할인 = 주문항목 단가 합계)로 변경.
  //   getMenuSales.revenue도 동일 기준이라 차이는 항상 0원 (정상 운영 시).
  const menuRevenueSum = menuSales.reduce((acc, m) => acc + m.revenue, 0);
  const menuRevenueDiff = menuRevenueSum - summary.gross_amount;

  // 본문 빌드.
  const lines = [];
  const sep = '='.repeat(50);
  lines.push(sep);
  lines.push('  치킨이닭 일일 매출 정산서');
  lines.push(`  운영 일자: ${operating_date}`);
  lines.push(`  생성 시각: ${generated_at}`);
  lines.push(sep);
  lines.push('');

  // [1] 요약 — adjustment Codex P1-1 (2026-05-20):
  //   orders.total_price는 calculatePrice()가 NET으로 저장 → summary.total_amount는 NET.
  //   따라서 「실수령 예상」 = summary.total_amount 그대로 (추가 차감 X).
  //   「총 상품금액」 = summary.gross_amount (= NET + 쿠폰 할인 = 주문항목 단가 합계).
  lines.push('[1] 요약');
  lines.push(`  총 주문 수            : ${summary.total_orders}건`);
  lines.push(`  총 상품금액           : ${formatCurrency(summary.gross_amount)}`);
  lines.push(`  쿠폰 사용 수          : ${summary.coupon_count}건`);
  lines.push(`  쿠폰 할인 총액        : ${formatCurrency(summary.coupon_discount_total)}`);
  lines.push(`  실수령 예상           : ${formatCurrency(summary.total_amount)}`);
  lines.push('');

  // [2] 결제 검증 — 실수령 예상(NET) 기준. 실제 송금액·통장 합계 모두 NET과 대조.
  lines.push('[2] 결제 검증');
  lines.push(`  시스템 매출 (실수령)  : ${formatCurrency(summary.total_amount)}`);
  lines.push(`  실제 송금액 합계      : ${formatCurrency(transferSum)}   (orders.amount SUM)`);
  lines.push(`  차이                  : ${formatCurrency(transferSum - summary.total_amount)}`);
  if (bank_total !== undefined) {
    lines.push(`  통장 입금 합계 (수동) : ${formatCurrency(bank_total)}`);
    lines.push(`  통장 차이             : ${formatCurrency(bank_total - summary.total_amount)}`);
  } else {
    lines.push('  통장 입금 합계 (수동) : 미입력');
  }
  lines.push('');

  // [3] 메뉴별 매출 — 메뉴 8행 ID 순. Q6: 합계 + 「합계 − 총 매출 = 차이」 1줄.
  lines.push('[3] 메뉴별 매출');
  lines.push('  ID  메뉴            수량      단가         매출');
  lines.push('  --  --------------  ----  ----------  -----------');
  for (const m of menuSales) {
    // 한글 폭 차이는 메모장/Excel 모노스페이스 환경에 따라 다르므로 단순 패딩.
    const id = String(m.menu_id).padStart(3, ' ');
    const name = String(m.name ?? '').padEnd(14, ' ');
    const qty = String(m.quantity).padStart(4, ' ');
    const unit = `${(m.base_price ?? 0).toLocaleString('en-US')}원`.padStart(10, ' ');
    const rev = `${(m.revenue ?? 0).toLocaleString('en-US')}원`.padStart(11, ' ');
    lines.push(`  ${id}  ${name}  ${qty}  ${unit}  ${rev}`);
  }
  lines.push('  ---------------------------------------------------');
  lines.push(`  합계                                  ${formatCurrency(menuRevenueSum).padStart(11, ' ')}`);
  // adjustment Codex P1-2 (2026-05-20): 「합계 − 총 상품금액 = 차이」 — 정상 운영 시 0원.
  // 기준이 모두 gross이므로 일치해야 한다. 이전 「합계 − 총 매출(NET)」은 쿠폰 할인액만큼
  // 항상 차이가 발생해 정산 대조의 의미가 어긋났다.
  lines.push(`  합계 − 총 상품금액 = 차이 : ${formatCurrency(menuRevenueDiff)}`);
  lines.push('');

  // [4] 카테고리 소계 — 영문 키 그대로 노출되지 않게 한글 라벨로.
  lines.push('[4] 카테고리 소계');
  for (const cat of ['chicken', 'side', 'drink']) {
    const r = categoryRows.find((row) => row.category === cat);
    const qty = r?.quantity ?? 0;
    const rev = r?.revenue ?? 0;
    const label = categoryLabel[cat];
    const enKey = `(${cat})`.padEnd(10, ' ');
    lines.push(`  ${label.padEnd(3, ' ')} ${enKey} : ${qty}건 / ${formatCurrency(rev)}`);
  }
  lines.push('');

  // [5] 배달 형태별
  lines.push('[5] 배달 형태별');
  for (const dt of ['dineIn', 'takeout']) {
    const r = deliveryRows.find((row) => row.type === dt);
    const qty = r?.quantity ?? 0;
    const rev = r?.revenue ?? 0;
    const label = deliveryLabel[dt];
    const enKey = `(${dt})`.padEnd(10, ' ');
    lines.push(`  ${label.padEnd(3, ' ')} ${enKey} : ${qty}건 / ${formatCurrency(rev)}`);
  }
  lines.push('');

  // [6] 취소
  lines.push('[6] 취소');
  lines.push(`  취소 건수 : ${cancelTotal}건`);
  if (cancelTotal === 0) {
    lines.push('  사유 분포 : (없음)');
  } else {
    lines.push('  사유 분포 :');
    // canceled_reason이 모두 NULL이면 "미기록" 1줄로 대체 (요구사항).
    const allNull = cancelReasonRows.every((r) => r.reason == null);
    if (allNull) {
      lines.push('    - 미기록');
    } else {
      for (const row of cancelReasonRows) {
        const label = row.reason == null || row.reason === '' ? '(사유 없음)' : `"${row.reason}"`;
        lines.push(`    - ${label} : ${row.c}건`);
      }
    }
  }
  lines.push('');

  return lines.join(CRLF);
}

// ── CSV helpers (기존 패턴 재사용) ──────────────────────
function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers, rows) {
  const head = headers.join(',');
  const body = rows
    .map((r) => headers.map((h) => csvEscape(r[h])).join(','))
    .join(CRLF);
  // 빈 본문일 때 trailing newline은 헤더만 노출.
  return `${UTF8_BOM}${head}${CRLF}${body}${body ? CRLF : ''}`;
}

// ── 주문내역.csv — 한국어 헤더 + 운영 컬럼 정제 (개발기획서 §5.4 표) ─────
//
// 유지 컬럼: 주문번호/주문상태(한글)/주문자명/학번/외부인여부/수령방식/테이블번호/
//   주문항목(JOIN)/주문금액/쿠폰할인/최종결제금액/입금자명/은행/이체확인금액/
//   주문시각/이체요청시각/결제확인시각/조리시작시각/수령대기시각/식사시작시각/
//   정리완료시각/취소시각/취소사유
// 제거 컬럼: id/external_token/access_token/use_other_name/other_name/custom_bank/
//   hold_reason/done_at/operating_date.
function exportOrdersCsv(db, operating_date) {
  const headers = [
    '주문번호',
    '주문상태',
    '주문자명',
    '학번',
    '외부인여부',
    '수령방식',
    '테이블번호',
    '주문항목',
    '주문금액',
    '쿠폰할인',
    '최종결제금액',
    '입금자명',
    '은행',
    '이체확인금액',
    '주문시각',
    '이체요청시각',
    '결제확인시각',
    '조리시작시각',
    '수령대기시각',
    '식사시작시각',
    '정리완료시각',
    '취소시각',
    '취소사유',
  ];
  // 주문 컬럼만 SELECT (id는 join용으로만 유지, 응답엔 없음).
  // adjustment Codex P2-2 (2026-05-20): custom_bank도 함께 SELECT — CSV 「은행」 컬럼
  // 표시값에 병합용. custom_bank 자체는 CSV에 별도 컬럼으로 노출 X (개발기획서 §5.4).
  const orders = db
    .prepare(
      `SELECT id, no, status, name, student_id, is_external, delivery_type,
              table_no, total_price, depositor_name, bank, custom_bank, amount,
              created_at, transferred_at, paid_at, cooking_at, ready_at,
              dining_at, settled_at, updated_at, canceled_reason
         FROM orders
        WHERE operating_date = ?
        ORDER BY no ASC`,
    )
    .all(operating_date);
  // 쿠폰 사용 주문 id set — 1,000원 할인 매핑.
  const couponOrderIds = new Set(
    db
      .prepare(
        `SELECT uc.order_id AS id
           FROM used_coupons uc
           JOIN orders o ON o.id = uc.order_id
          WHERE o.operating_date = ?`,
      )
      .all(operating_date)
      .map((r) => r.id),
  );
  // 주문항목 JOIN — "후라이드 1, 콜라 2" 형식.
  const itemStmt = db.prepare(
    `SELECT name, quantity FROM order_items WHERE order_id = ? ORDER BY id ASC`,
  );

  const rows = orders.map((o) => {
    const items = itemStmt.all(o.id);
    const itemsStr = items.map((it) => `${it.name} ${it.quantity}`).join(', ');
    const couponDiscount = couponOrderIds.has(o.id) ? COUPON_DISCOUNT_PER : 0;
    // adjustment Codex P1-1 (2026-05-20): orders.total_price는 NET(쿠폰 할인 후).
    //   주문금액 = gross (= NET + 쿠폰 할인 = 주문항목 단가 합계).
    //   최종결제금액 = total_price (NET).
    //   이전 finalAmount = total_price - couponDiscount는 쿠폰 이중 차감 결함.
    const netAmount = o.total_price ?? 0;
    const grossAmount = netAmount + couponDiscount;
    // Q4: 취소시각은 status=CANCELED일 때만 updated_at, 그 외는 빈값.
    const canceledAt = o.status === 'CANCELED' ? o.updated_at : '';
    // adjustment Codex P2-2 (2026-05-20): 「은행」 표시값에 custom_bank 병합.
    //   bank='기타'이거나 custom_bank가 채워진 경우 custom_bank를 노출 (기타 은행명 보존).
    //   그 외 일반 은행은 bank 그대로. custom_bank 컬럼 자체는 노출 X.
    const useCustomBank =
      (o.bank === '기타' || (typeof o.custom_bank === 'string' && o.custom_bank.length > 0));
    const bankLabel = useCustomBank ? (o.custom_bank ?? '') : (o.bank ?? '');
    return {
      주문번호: o.no,
      주문상태: statusLabel(o.status),
      주문자명: o.name,
      학번: o.student_id ?? '',
      외부인여부: o.is_external ? '예' : '아니오',
      수령방식: o.delivery_type === 'takeout' ? '포장' : '매장',
      테이블번호: o.table_no ?? '',
      주문항목: itemsStr,
      주문금액: grossAmount,
      쿠폰할인: couponDiscount,
      최종결제금액: netAmount,
      입금자명: o.depositor_name ?? '',
      은행: bankLabel,
      이체확인금액: o.amount ?? '',
      주문시각: o.created_at ?? '',
      이체요청시각: o.transferred_at ?? '',
      결제확인시각: o.paid_at ?? '',
      조리시작시각: o.cooking_at ?? '',
      수령대기시각: o.ready_at ?? '',
      식사시작시각: o.dining_at ?? '',
      정리완료시각: o.settled_at ?? '',
      취소시각: canceledAt ?? '',
      취소사유: o.canceled_reason ?? '',
    };
  });
  return rowsToCsv(headers, rows);
}

// ── 쿠폰내역.csv — 한국어 헤더 (개발기획서 §5.5) ──────────
function exportCouponsCsv(db, operating_date) {
  const headers = ['사용시각', '학번', '이름', '주문번호', '쿠폰명', '할인금액'];
  const usage = listCouponUsage(db, { operating_date });
  const rows = usage.map((u) => ({
    사용시각: u.used_at ?? '',
    학번: u.student_id ?? '',
    이름: u.name ?? '',
    주문번호: u.order_no ?? '',
    쿠폰명: COUPON_NAME,
    할인금액: COUPON_DISCOUNT_PER,
  }));
  return rowsToCsv(headers, rows);
}

/**
 * SQLite .dump 시뮬레이션 — createSnapshotZip가 :memory: DB 백업 시 사용.
 * 정산 ZIP 트랙(adjustment 라운드 Subagent 3)에서는 사용하지 않는다 — 운영자
 * 가치 없는 dump는 ZIP에서 제거됨. createSnapshotZip 트랙만 보존.
 */
function serializeDb(db) {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all();
  let sql = '';
  for (const { name } of tables) {
    sql += `-- ${name}\n`;
    const rows = db.prepare(`SELECT * FROM ${name}`).all();
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = Object.values(row).map((v) => {
        if (v === null) return 'NULL';
        if (typeof v === 'number') return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      sql += `INSERT INTO ${name} (${cols.join(',')}) VALUES (${vals.join(',')});\n`;
    }
  }
  return sql;
}

/**
 * 자동 스냅샷 시작 — setInterval (운영 환경 server.js에서 호출).
 * - 회전: 최신 maxBackups 개 유지, 나머지 삭제
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} [opts]
 * @param {string} [opts.dbPath]
 * @param {number} [opts.intervalMs]
 * @param {string} [opts.dir]
 * @param {number} [opts.maxBackups]
 * @returns {() => void} cleanup 함수
 */
export function startAutoSnapshot(
  db,
  {
    dbPath,
    intervalMs = DEFAULT_INTERVAL_MS,
    dir = DEFAULT_BACKUP_DIR,
    maxBackups = DEFAULT_MAX_BACKUPS,
  } = {},
) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const tick = async () => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(dir, `auto-${ts}.zip`);
    try {
      await createSnapshotZip(db, dbPath, outputPath);
      logger.info({ outputPath }, '[auto-snapshot] 백업 생성');
      rotateBackups(dir, maxBackups);
      // find_error_v3 — 백업 성공 시 system 이벤트 1행. 실패 시 기록 X.
      try {
        const state = getBusinessState(db);
        logAdminEvent(db, {
          category: 'system',
          event_type: 'AUTO_BACKUP',
          action_name: '자동 백업',
          actor: 'system',
          operating_date: state.operating_date,
          note: path.basename(outputPath),
        });
      } catch (err) {
        // business_state 미시드 (테스트 DB) 등 환경에서는 silent skip.
        logger.debug({ err: err.message }, '[auto-snapshot] AUTO_BACKUP event skip');
      }
    } catch (err) {
      logger.error({ err }, '[auto-snapshot] 백업 실패');
    }
  };

  const interval = setInterval(tick, intervalMs);
  return () => clearInterval(interval);
}

/**
 * 회전 — auto-*.zip 중 mtime 기준 최신 maxBackups 개만 유지.
 */
function rotateBackups(dir, maxBackups) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => ({
      f,
      path: path.join(dir, f),
      mtime: statSync(path.join(dir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length > maxBackups) {
    for (const old of files.slice(maxBackups)) {
      try {
        unlinkSync(old.path);
        logger.info({ removed: old.f }, '[auto-snapshot] 오래된 백업 삭제');
      } catch (err) {
        logger.warn({ err, file: old.f }, '[auto-snapshot] 삭제 실패 (무시)');
      }
    }
  }
}
