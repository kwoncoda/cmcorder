// Bug 7 — 시간 540분 경과 오차 회귀 방지.
//
// 근본 원인:
//   SQLite datetime('now') 출력 = 'YYYY-MM-DD HH:MM:SS' (UTC, timezone marker 없음).
//   브라우저(KST UTC+9)에서 new Date(str) → "KST 시각" 으로 잘못 해석 → 9시간 = 540분 오차.
//
// 본 util은 두 가지 형식을 모두 UTC로 안전 처리한다:
//   - SQLite space 형식 'YYYY-MM-DD HH:MM:SS' → 강제 UTC 파싱
//   - ISO 8601 'T...Z' / 오프셋 포함 → Date 생성자 통과
import { describe, it, expect } from 'vitest';
import { parseTimestamp, elapsedMinutes } from '../time.js';

describe('parseTimestamp (Bug 7)', () => {
  it('null/undefined/빈 문자열 → null', () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp('')).toBeNull();
  });

  it('SQLite space 형식 "YYYY-MM-DD HH:MM:SS" → UTC로 파싱', () => {
    // 2026-05-17 12:21:29 UTC = 2026-05-17 21:21:29 KST.
    const d = parseTimestamp('2026-05-17 12:21:29');
    expect(d).toBeInstanceOf(Date);
    expect(d.toISOString()).toBe('2026-05-17T12:21:29.000Z');
  });

  it('ISO 8601 Z 형식 → Date 생성자 통과', () => {
    const d = parseTimestamp('2026-05-17T12:21:29Z');
    expect(d.toISOString()).toBe('2026-05-17T12:21:29.000Z');
  });

  it('타임존 오프셋 포함 ISO → 보존 (오프셋 정확 변환)', () => {
    const d = parseTimestamp('2026-05-17T21:21:29+09:00');
    expect(d.toISOString()).toBe('2026-05-17T12:21:29.000Z');
  });

  it('잘못된 문자열 → null', () => {
    expect(parseTimestamp('garbage')).toBeNull();
    expect(parseTimestamp('not-a-date')).toBeNull();
  });
});

describe('elapsedMinutes (Bug 7)', () => {
  it('start null이면 0', () => {
    expect(elapsedMinutes(null, new Date())).toBe(0);
  });

  it('UTC SQL timestamp + KST now — 정확한 분 계산', () => {
    // SQL: 2026-05-17 12:00:00 UTC
    // now: 2026-05-17T12:06:00Z (6분 후)
    const now = new Date('2026-05-17T12:06:00Z');
    expect(elapsedMinutes('2026-05-17 12:00:00', now)).toBe(6);
  });

  it('★ Bug 7 회귀 — 540분 오차 재발 방지', () => {
    // 핵심 회귀: UTC SQL 시각 직후 KST tick. 0~1분 사이여야 한다.
    const sqlNow = '2026-05-17 12:00:00'; // UTC 시각
    const browserNow = new Date('2026-05-17T12:00:30Z'); // 30초 후 UTC
    const mins = elapsedMinutes(sqlNow, browserNow);
    expect(mins).toBe(0); // 30초는 0분
    // 540분 오차 (브라우저가 KST로 잘못 해석) 시 발생할 값
    expect(mins).not.toBe(540);
    expect(mins).not.toBe(-540);
  });

  it('ISO Z 형식과 SQL space 형식 결과 동일', () => {
    const now = new Date('2026-05-17T12:05:00Z');
    const a = elapsedMinutes('2026-05-17 12:00:00', now);
    const b = elapsedMinutes('2026-05-17T12:00:00Z', now);
    expect(a).toBe(b);
    expect(a).toBe(5);
  });

  // 미래 시각 클램프 — 시계 어긋남(서버/클라이언트 NTP 미스매치) 또는
  // transferred_at 이 약간 미래로 기록된 경우에도 "-1분 경과" 같은 음수 노출 차단.
  it('★ 미래 timestamp → 0 (음수 방지 클램프)', () => {
    const now = new Date('2026-05-17T12:00:00Z');
    // start가 now보다 1분 미래 — 정상이라면 -1, 클램프 시 0.
    expect(elapsedMinutes('2026-05-17T12:01:00Z', now)).toBe(0);
  });

  it('★ 과거 timestamp → 양수 그대로 (회귀 보장)', () => {
    const now = new Date('2026-05-17T12:05:00Z');
    expect(elapsedMinutes('2026-05-17T12:00:00Z', now)).toBe(5);
  });
});
