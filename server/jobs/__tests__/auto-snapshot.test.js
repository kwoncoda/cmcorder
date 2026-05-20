// Task 6.9 — 자동 ZIP 스냅샷 회귀 (단위).
//
// ADR-022 변경: 30분 → 2시간 + 6개 회전 (데이터 손실 ≤ 2시간).
//
// adjustment 라운드 Subagent 3 (2026-05-20) 갱신:
//   - createSettlementZip: 기존 manifest/summary/menu-snapshot/settlement.sql 폐기.
//   - 한국어 3파일 (정산서.txt / 주문내역.csv / 쿠폰내역.csv).
//   - bank query 정산서 [2] 섹션 반영.
//   - ZIP 내부 본문 검증을 위해 yauzl 의존성 추가 (devDep).
//
// 다른 트랙(createSnapshotZip · startAutoSnapshot · 회전 · AUTO_BACKUP 이벤트)은
// 변경 없이 그대로 유지 (Subagent 3 작업 범위 외).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { existsSync, readdirSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yauzl from 'yauzl';
import { bootstrapDatabase } from '../../db/bootstrap.js';
import {
  createSnapshotZip,
  createSettlementZip,
  startAutoSnapshot,
} from '../auto-snapshot.js';

function freshDb() {
  const db = new Database(':memory:');
  bootstrapDatabase(db);
  return db;
}

function tmpDir() {
  const dir = path.join(os.tmpdir(), `auto-snapshot-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ZIP buffer를 yauzl로 풀어 { [name]: Buffer } 맵으로 변환.
// adjustment 라운드 Subagent 3 — ZIP 내부 본문 검증.
function unzipBuffer(buf) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      const out = {};
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        zipfile.openReadStream(entry, (err2, stream) => {
          if (err2) return reject(err2);
          const chunks = [];
          stream.on('data', (c) => chunks.push(c));
          stream.on('end', () => {
            out[entry.fileName] = Buffer.concat(chunks);
            zipfile.readEntry();
          });
          stream.on('error', reject);
        });
      });
      zipfile.on('end', () => resolve(out));
      zipfile.on('error', reject);
    });
  });
}

describe('createSnapshotZip', () => {
  it(':memory: DB라도 outputPath에 ZIP 파일 생성', async () => {
    const db = freshDb();
    const dir = tmpDir();
    const out = path.join(dir, 'snap.zip');
    await createSnapshotZip(db, '/nonexistent/path.sqlite', out);
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('createSettlementZip — adjustment 라운드 Subagent 3 (한국어 3파일)', () => {
  it('Buffer 반환 — ZIP magic bytes', async () => {
    const db = freshDb();
    const buf = await createSettlementZip(db);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
  });

  // 1. ZIP은 정확히 3파일 — 한국어 파일명.
  it('★ ZIP 내부 파일 정확히 3개 (정산서-/주문내역-/쿠폰내역-)', async () => {
    const db = freshDb();
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const names = Object.keys(files).sort();
    expect(names).toEqual(
      [
        '정산서-2026-05-20.txt',
        '주문내역-2026-05-20.csv',
        '쿠폰내역-2026-05-20.csv',
      ].sort(),
    );
  });

  // 2. 제거된 파일들은 ZIP에 없다.
  it('★ ZIP에 manifest.json / summary.json / menu-snapshot.json / settlement.sql 미존재', async () => {
    const db = freshDb();
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const names = Object.keys(files);
    expect(names).not.toContain('manifest.json');
    expect(names).not.toContain('summary.json');
    expect(names).not.toContain('menu-snapshot.json');
    expect(names).not.toContain('settlement.sql');
    expect(names).not.toContain('orders.csv');
    expect(names).not.toContain('coupons.csv');
  });

  // 3. 정산서.txt는 6섹션 헤더를 모두 포함한다.
  it('★ 정산서.txt 본문에 6섹션 헤더 모두 포함', async () => {
    const db = freshDb();
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const txt = files['정산서-2026-05-20.txt'].toString('utf8');
    expect(txt).toContain('[1] 요약');
    expect(txt).toContain('[2] 결제 검증');
    expect(txt).toContain('[3] 메뉴별 매출');
    expect(txt).toContain('[4] 카테고리 소계');
    expect(txt).toContain('[5] 배달 형태별');
    expect(txt).toContain('[6] 취소');
  });

  // 4. 메뉴 8행 모두 (ID 순). 시드된 메뉴 8개 = 후라이드…사이다.
  it('★ 정산서.txt 메뉴 8행 ID 순 (후라이드~사이다)', async () => {
    const db = freshDb();
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const txt = files['정산서-2026-05-20.txt'].toString('utf8');
    // ID 1~8 — 후라이드 / 양념 / 뿌링클 / 감자튀김 / 뿌링감자튀김 / 칠리스 / 콜라 / 사이다.
    for (const name of ['후라이드', '양념', '뿌링클', '감자튀김', '뿌링감자튀김', '칠리스', '콜라', '사이다']) {
      expect(txt).toContain(name);
    }
    // ID 순 — '후라이드' 위치가 '사이다' 위치보다 앞.
    expect(txt.indexOf('후라이드')).toBeLessThan(txt.indexOf('사이다'));
  });

  // 5. 0건 메뉴도 포함 — 시드된 메뉴 1개만 판매하고 나머지는 0건으로 표시.
  it('★ 0건 메뉴도 정산서에 포함 (시드 후 일부만 판매)', async () => {
    const db = freshDb();
    db.prepare(
      "INSERT INTO business_state (id, status, operating_date) VALUES (1, 'OPEN', '2026-05-20') ON CONFLICT(id) DO UPDATE SET status='OPEN', operating_date='2026-05-20'",
    ).run();
    // 후라이드 1건만 SETTLED. 나머지 7개 메뉴는 매출 0.
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, student_id, total_price, status)
       VALUES (1, '2026-05-20', '홍길동', '202637001', 18000, 'SETTLED')`,
    ).run();
    db.prepare(
      `INSERT INTO order_items (order_id, menu_id, name, base_price, quantity, category)
       VALUES (1, 1, '후라이드', 18000, 1, 'chicken')`,
    ).run();
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const txt = files['정산서-2026-05-20.txt'].toString('utf8');
    // 사이다(ID 8)는 0건이지만 row 노출 — "사이다" 라인에 "0" 포함.
    const sidaLine = txt.split(/\r?\n/).find((l) => l.includes('사이다'));
    expect(sidaLine).toBeDefined();
    expect(sidaLine).toMatch(/0/);
    // 후라이드는 1건 — "1" 포함.
    const friedLine = txt.split(/\r?\n/).find((l) => l.includes('후라이드'));
    expect(friedLine).toBeDefined();
    expect(friedLine).toMatch(/1/);
  });

  // 6. 주문내역.csv 헤더에 제거 컬럼 없음.
  it('★ 주문내역.csv 헤더에 제거 컬럼(external_token/use_other_name/custom_bank/hold_reason/access_token/other_name/done_at/id) 없음', async () => {
    const db = freshDb();
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const csv = files['주문내역-2026-05-20.csv'].toString('utf8');
    // 첫 줄(BOM 제거) — 헤더.
    const header = csv.replace(/^﻿/, '').split(/\r?\n/)[0];
    for (const removed of [
      'external_token',
      'use_other_name',
      'custom_bank',
      'hold_reason',
      'access_token',
      'other_name',
      'done_at',
    ]) {
      expect(header).not.toContain(removed);
    }
    // 'id'는 부분 매칭이 위험(주문번호/표제 등). 정확한 헤더 토큰만 검사.
    const headerTokens = header.split(',');
    expect(headerTokens).not.toContain('id');
  });

  // 7. 주문내역.csv 헤더에 유지 컬럼 모두 존재.
  it('★ 주문내역.csv 헤더에 유지 컬럼 모두 존재', async () => {
    const db = freshDb();
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const csv = files['주문내역-2026-05-20.csv'].toString('utf8');
    const header = csv.replace(/^﻿/, '').split(/\r?\n/)[0];
    for (const required of [
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
    ]) {
      expect(header).toContain(required);
    }
  });

  // 8. CSV 첫 바이트 UTF-8 BOM (orders + coupons 둘 다).
  it('★ 주문내역/쿠폰내역 CSV 첫 3 바이트 UTF-8 BOM (0xEF 0xBB 0xBF)', async () => {
    const db = freshDb();
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    for (const name of ['주문내역-2026-05-20.csv', '쿠폰내역-2026-05-20.csv']) {
      const csv = files[name];
      expect(csv[0]).toBe(0xef);
      expect(csv[1]).toBe(0xbb);
      expect(csv[2]).toBe(0xbf);
    }
  });

  // 9. bank=700000 query 전달 시 정산서 [2] 섹션에 통장 합계·차이.
  it('★ bank_total 지정 시 정산서 [2] 섹션에 통장 입금 합계 + 차이 반영', async () => {
    const db = freshDb();
    db.prepare(
      "INSERT INTO business_state (id, status, operating_date) VALUES (1, 'OPEN', '2026-05-20') ON CONFLICT(id) DO UPDATE SET status='OPEN', operating_date='2026-05-20'",
    ).run();
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, total_price, status)
       VALUES (1, '2026-05-20', 'A', 700000, 'SETTLED')`,
    ).run();
    const buf = await createSettlementZip(db, {
      operating_date: '2026-05-20',
      bank_total: 700000,
    });
    const files = await unzipBuffer(buf);
    const txt = files['정산서-2026-05-20.txt'].toString('utf8');
    expect(txt).toMatch(/통장 입금 합계.*700,000원/);
    expect(txt).toContain('통장 차이');
    expect(txt).not.toContain('미입력');
  });

  // 10. bank query 누락 시 "미입력" 표기.
  it('★ bank_total 누락 시 정산서 [2] 섹션에 "미입력" 표기', async () => {
    const db = freshDb();
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const txt = files['정산서-2026-05-20.txt'].toString('utf8');
    expect(txt).toMatch(/통장 입금 합계.*미입력/);
  });

  // 11. 후방 호환 — 인자 없이 호출하면 business_state.operating_date 사용.
  it('★ 인자 없이 호출 시 business_state.operating_date 자동 사용 (후방 호환)', async () => {
    const db = freshDb();
    // init.sql 시드 business_state.operating_date = '2026-05-20'.
    const buf = await createSettlementZip(db);
    const files = await unzipBuffer(buf);
    const names = Object.keys(files).sort();
    expect(names).toContain('정산서-2026-05-20.txt');
    expect(names).toContain('주문내역-2026-05-20.csv');
    expect(names).toContain('쿠폰내역-2026-05-20.csv');
  });

  // 12. 주문상태는 한글 라벨로 노출 (Q7 — TXT/CSV 양쪽).
  it('★ 주문내역.csv 주문상태 컬럼은 한글 라벨 (SETTLED→정리 완료, CANCELED→취소)', async () => {
    const db = freshDb();
    db.prepare(
      "INSERT INTO business_state (id, status, operating_date) VALUES (1, 'OPEN', '2026-05-20') ON CONFLICT(id) DO UPDATE SET status='OPEN', operating_date='2026-05-20'",
    ).run();
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, total_price, status)
       VALUES (1, '2026-05-20', 'A', 18000, 'SETTLED'),
              (2, '2026-05-20', 'B', 7000,  'CANCELED')`,
    ).run();
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const csv = files['주문내역-2026-05-20.csv'].toString('utf8');
    expect(csv).toContain('정리 완료');
    expect(csv).toContain('취소');
  });

  // 13. 쿠폰내역.csv는 listCouponUsage 기반 + 한국어 헤더 + 쿠폰명/할인금액 상수.
  it('★ 쿠폰내역.csv는 listCouponUsage 결과 + "컴모융 1,000원 할인" / 1000 상수', async () => {
    const db = freshDb();
    db.prepare(
      "INSERT INTO business_state (id, status, operating_date) VALUES (1, 'OPEN', '2026-05-20') ON CONFLICT(id) DO UPDATE SET status='OPEN', operating_date='2026-05-20'",
    ).run();
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, student_id, total_price, status)
       VALUES (1, '2026-05-20', '홍길동', '202637001', 18000, 'SETTLED')`,
    ).run();
    db.prepare(
      "INSERT INTO used_coupons (student_id, name, order_id) VALUES ('202637001', '홍길동', 1)",
    ).run();
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const csv = files['쿠폰내역-2026-05-20.csv'].toString('utf8');
    const header = csv.replace(/^﻿/, '').split(/\r?\n/)[0];
    expect(header).toContain('사용시각');
    expect(header).toContain('학번');
    expect(header).toContain('이름');
    expect(header).toContain('주문번호');
    expect(header).toContain('쿠폰명');
    expect(header).toContain('할인금액');
    // 데이터 행 — 쿠폰명 상수 + 할인금액 1000.
    expect(csv).toContain('컴모융 1,000원 할인');
    expect(csv).toContain('1000');
    expect(csv).toContain('홍길동');
  });

  // ── adjustment 라운드 Codex P1-1 — 쿠폰 이중 차감 회귀 ──
  //
  // 사실: orders.total_price는 calculatePrice()가 (subtotal - discount)로 저장.
  //   → SUM(total_price)는 이미 쿠폰 할인 후 NET. 정산서/CSV에서 또 빼면 이중 차감.
  //
  // 정책:
  //   - [1] 요약 「총 상품금액」 = summary.gross_amount (= NET + 쿠폰 할인 = 주문항목 단가 합계).
  //   - [1] 요약 「실수령 예상」 = summary.total_amount (NET). 추가 차감 X.
  //   - CSV 주문금액 = total_price + 쿠폰할인 (gross). 최종결제금액 = total_price (NET).
  //
  // 시드: 후라이드(18,000) 쿠폰 사용 SETTLED 1건 + 콜라(2,000) 일반 SETTLED 1건.
  //   pricing.js 기준 total_price: 17,000 (= 18,000 - 1,000) + 2,000.
  function seedCouponMix(db, { withCustomBank = false } = {}) {
    db.prepare(
      "INSERT INTO business_state (id, status, operating_date) VALUES (1, 'OPEN', '2026-05-20') ON CONFLICT(id) DO UPDATE SET status='OPEN', operating_date='2026-05-20'",
    ).run();
    // Order 1: 후라이드 1개 + 쿠폰 → NET 17,000.
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, student_id, total_price, status, depositor_name, bank, custom_bank, amount)
       VALUES (1, '2026-05-20', '홍길동', '202637001', 17000, 'SETTLED', '홍길동', ?, ?, 17000)`,
    ).run(
      withCustomBank ? '기타' : '국민',
      withCustomBank ? '카카오뱅크' : null,
    );
    db.prepare(
      `INSERT INTO order_items (order_id, menu_id, name, base_price, quantity, category)
       VALUES (1, 1, '후라이드', 18000, 1, 'chicken')`,
    ).run();
    db.prepare(
      "INSERT INTO used_coupons (student_id, name, order_id) VALUES ('202637001', '홍길동', 1)",
    ).run();
    // Order 2: 콜라 1개, 쿠폰 X → NET 2,000.
    db.prepare(
      `INSERT INTO orders (no, operating_date, name, student_id, total_price, status, depositor_name, bank, amount)
       VALUES (2, '2026-05-20', '김철수', '202637042', 2000, 'SETTLED', '김철수', '신한', 2000)`,
    ).run();
    db.prepare(
      `INSERT INTO order_items (order_id, menu_id, name, base_price, quantity, category)
       VALUES (2, 7, '콜라', 2000, 1, 'drink')`,
    ).run();
  }

  it('★ Codex P1-1 — 정산서 [1] 실수령 예상 = total_amount (이중 차감 X)', async () => {
    const db = freshDb();
    seedCouponMix(db);
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const txt = files['정산서-2026-05-20.txt'].toString('utf8');
    // 실수령 예상은 NET 합 19,000원 (= 17,000 + 2,000). 18,000원으로 나오면 이중 차감.
    expect(txt).toMatch(/실수령 예상\s*:\s*19,000원/);
    expect(txt).not.toMatch(/실수령 예상\s*:\s*18,000원/);
  });

  it('★ Codex P1-1 — 정산서 [1] 총 상품금액 = gross_amount (NET + 쿠폰 할인)', async () => {
    const db = freshDb();
    seedCouponMix(db);
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const txt = files['정산서-2026-05-20.txt'].toString('utf8');
    // gross = 19,000 NET + 1,000 쿠폰 = 20,000원 (= 주문항목 단가 합계 18,000 + 2,000).
    expect(txt).toMatch(/총 상품금액\s*:\s*20,000원/);
  });

  it('★ Codex P1-2 — 정산서 [3] 메뉴별 합계 === [1] 총 상품금액 (정합성)', async () => {
    const db = freshDb();
    seedCouponMix(db);
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const txt = files['정산서-2026-05-20.txt'].toString('utf8');
    // 메뉴별 합계 = 18,000 (후라이드) + 2,000 (콜라) = 20,000원. 차이 = 0원.
    expect(txt).toMatch(/합계\s+20,000원/);
    // 「합계 − 총 상품금액 = 차이」 0원.
    expect(txt).toMatch(/합계 − 총 상품금액 = 차이\s*:\s*0원/);
  });

  it('★ Codex P1-1 — CSV 쿠폰 사용 주문: 주문금액=gross(18,000) / 쿠폰할인=1,000 / 최종결제금액=17,000(NET)', async () => {
    const db = freshDb();
    seedCouponMix(db);
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const csv = files['주문내역-2026-05-20.csv'].toString('utf8');
    const lines = csv.replace(/^﻿/, '').split(/\r?\n/);
    const header = lines[0].split(',');
    const row1 = lines.find((l) => l.startsWith('1,')); // 주문번호 1
    expect(row1).toBeDefined();
    const cells = row1.split(',');
    const get = (col) => cells[header.indexOf(col)];
    expect(get('주문금액')).toBe('18000');     // gross = NET 17000 + 1000 쿠폰
    expect(get('쿠폰할인')).toBe('1000');
    expect(get('최종결제금액')).toBe('17000'); // NET = total_price
  });

  it('★ Codex P1-1 — CSV 쿠폰 없는 주문: 주문금액 = 최종결제금액 / 쿠폰할인 = 0', async () => {
    const db = freshDb();
    seedCouponMix(db);
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const csv = files['주문내역-2026-05-20.csv'].toString('utf8');
    const lines = csv.replace(/^﻿/, '').split(/\r?\n/);
    const header = lines[0].split(',');
    const row2 = lines.find((l) => l.startsWith('2,'));
    expect(row2).toBeDefined();
    const cells = row2.split(',');
    const get = (col) => cells[header.indexOf(col)];
    expect(get('주문금액')).toBe('2000');
    expect(get('쿠폰할인')).toBe('0');
    expect(get('최종결제금액')).toBe('2000');
  });

  // ── adjustment 라운드 Codex P2-2 — CSV 은행 컬럼에 custom_bank 병합 ──
  //
  // 정책: bank='기타'(또는 custom_bank 존재) → 은행 표시값 = custom_bank.
  //   custom_bank 컬럼 자체는 CSV에 별도 노출 X (개발기획서 §5.4 유지).
  it('★ Codex P2-2 — CSV 은행 컬럼: bank=기타 + custom_bank 있음 → custom_bank 표시', async () => {
    const db = freshDb();
    seedCouponMix(db, { withCustomBank: true });
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const csv = files['주문내역-2026-05-20.csv'].toString('utf8');
    const lines = csv.replace(/^﻿/, '').split(/\r?\n/);
    const header = lines[0].split(',');
    const row1 = lines.find((l) => l.startsWith('1,'));
    const cells = row1.split(',');
    expect(cells[header.indexOf('은행')]).toBe('카카오뱅크');
    // custom_bank 컬럼은 별도 노출 X.
    expect(header).not.toContain('custom_bank');
  });

  it('★ Codex P2-2 — CSV 은행 컬럼: 일반 은행은 그대로 표시 (custom_bank 무관)', async () => {
    const db = freshDb();
    seedCouponMix(db, { withCustomBank: true });
    const buf = await createSettlementZip(db, { operating_date: '2026-05-20' });
    const files = await unzipBuffer(buf);
    const csv = files['주문내역-2026-05-20.csv'].toString('utf8');
    const lines = csv.replace(/^﻿/, '').split(/\r?\n/);
    const header = lines[0].split(',');
    const row2 = lines.find((l) => l.startsWith('2,'));
    const cells = row2.split(',');
    expect(cells[header.indexOf('은행')]).toBe('신한');
  });
});

describe('startAutoSnapshot', () => {
  let dir;
  beforeEach(() => {
    dir = tmpDir();
  });
  afterEach(async () => {
    // Windows에서 archiver 핸들 해제 시간 확보
    await new Promise((r) => setTimeout(r, 50));
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 시간차 GC 미스 — 무시
    }
  });

  it('intervalMs 후 백업 파일 1개 생성 (real timer)', async () => {
    const db = freshDb();
    const stop = startAutoSnapshot(db, {
      dbPath: '/nonexistent.sqlite',
      intervalMs: 50, // 50ms — 즉시 tick
      dir,
    });
    // archiver는 비동기 — 충분히 대기 후 stop
    await new Promise((r) => setTimeout(r, 200));
    stop();
    // 최종 flush 대기
    await new Promise((r) => setTimeout(r, 50));
    const files = readdirSync(dir).filter((f) => f.startsWith('auto-') && f.endsWith('.zip'));
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('cleanup 함수가 setInterval 종료', async () => {
    const db = freshDb();
    const stop = startAutoSnapshot(db, {
      dbPath: '/nonexistent.sqlite',
      intervalMs: 10_000, // 10s — 테스트 동안 절대 발화 X
      dir,
    });
    expect(typeof stop).toBe('function');
    stop();
    await new Promise((r) => setTimeout(r, 100));
    const files = readdirSync(dir).filter((f) => f.startsWith('auto-'));
    expect(files.length).toBe(0);
  });

  // find_error_v3 — 백업 성공 시 AUTO_BACKUP admin_events 행 기록.
  it('★ find_error_v3 — 백업 tick 성공 시 admin_events에 AUTO_BACKUP system 행 INSERT', async () => {
    const db = freshDb();
    const stop = startAutoSnapshot(db, {
      dbPath: '/nonexistent.sqlite',
      intervalMs: 50,
      dir,
    });
    await new Promise((r) => setTimeout(r, 200));
    stop();
    await new Promise((r) => setTimeout(r, 50));
    const row = db
      .prepare(`SELECT * FROM admin_events WHERE event_type = 'AUTO_BACKUP'`)
      .get();
    expect(row).toBeDefined();
    expect(row.category).toBe('system');
    expect(row.actor).toBe('system');
    expect(row.action_name).toBe('자동 백업');
    expect(row.note).toMatch(/^auto-.*\.zip$/);
  });
});

describe('자동 백업 회전 (maxBackups=2)', () => {
  let dir;
  beforeEach(() => {
    dir = tmpDir();
  });
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 50));
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('maxBackups 초과 시 오래된 백업 삭제', async () => {
    const db = freshDb();
    // 가짜 기존 백업 3개 — mtime 다르게 (가장 오래된 것이 회전 대상)
    const now = Date.now();
    const fs = await import('node:fs/promises');
    for (let i = 0; i < 3; i += 1) {
      const p = path.join(dir, `auto-old-${i}.zip`);
      writeFileSync(p, 'fake');
      const past = new Date(now - (i + 1) * 3600_000);
      await fs.utimes(p, past, past);
    }
    // 새 백업 1개 → 총 4개 → maxBackups=2 → 2개만 남아야
    const stop = startAutoSnapshot(db, {
      dbPath: '/nonexistent.sqlite',
      intervalMs: 50,
      dir,
      maxBackups: 2,
    });
    await new Promise((r) => setTimeout(r, 300));
    stop();
    await new Promise((r) => setTimeout(r, 50));
    const remaining = readdirSync(dir).filter((f) => f.endsWith('.zip'));
    expect(remaining.length).toBe(2);
  });
});
