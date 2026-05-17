// Bug 7 — SQLite datetime('now')의 UTC timestamp가 브라우저 KST로 540분 오차 표시되는 문제 방어.
//
// SQLite는 'YYYY-MM-DD HH:MM:SS' 형식으로 UTC 시각을 저장하지만 timezone marker가 없어
// new Date(str)가 브라우저 local time(KST UTC+9)으로 잘못 해석한다.
// 예) '2026-05-17 12:21:29' → 브라우저는 "KST 12:21" 로 해석 → 실제 UTC 21:21 → 9시간 = 540분 어긋남.
//
// 본 util은 두 형식을 모두 UTC로 안전 처리:
//   - SQLite space 형식 'YYYY-MM-DD HH:MM:SS' → ' ' → 'T' 치환 + 'Z' 부여하여 UTC 강제 파싱
//   - ISO 8601 ('T...Z' 또는 오프셋) → Date 생성자 그대로 통과
//
// 서버 측 ISO Z 직렬화(첫 단계 방어)와 함께 두 단계 방어 구성 — 네트워크 외 경로(테스트, 직접 호출)도 안전.

const SQL_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;

export function parseTimestamp(input) {
  if (input == null || input === '') return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input !== 'string') return null;
  // SQLite space 형식 → 명시적으로 Z 부여하여 UTC 파싱.
  const normalized = SQL_RE.test(input) ? input.replace(' ', 'T') + 'Z' : input;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function elapsedMinutes(start, now = new Date()) {
  const startDate = parseTimestamp(start);
  if (!startDate) return 0;
  // 음수 클램프 — 시계 어긋남(NTP) 또는 transferred_at 이 약간 미래로 기록된 경우에도
  // 운영자에게 "-1분 경과" 같은 음수가 노출되지 않도록 0 으로 고정.
  return Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 60000));
}
