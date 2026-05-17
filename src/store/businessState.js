// 영업 상태 store (zustand v5) — Task 3.1.
//
// status: 'OPEN' | 'CLOSED' — 서버 정답 (단일 진실 출처)
// operating_date: 'YYYY-MM-DD' — 오늘 운영 일자 (서버 응답)
// shouldBeOpen: *셀렉터*로 계산 (저장 X) — 일정표 + 현재 시각 기반.
//
// 운영 일정 (USER_FLOW §8.8 / Task 2.9 OPERATING_SCHEDULE 와 동기화):
//   2026-05-20: 15:00 ~ 21:00
//   2026-05-21: 15:00 ~ 21:00 (Bug 12 / P2-1 — 양일 모두 오후 3시 오픈으로 통일)
//
// 사용 예:
//   useBusinessStateStore((s) => s.status)
//   useBusinessStateStore(businessStateSelectors.shouldBeOpen)
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const SCHEDULE = {
  '2026-05-20': { start: '15:00', end: '21:00' },
  '2026-05-21': { start: '15:00', end: '21:00' },
};

const businessStateImpl = (set) => ({
  status: 'CLOSED',
  operating_date: '2026-05-20',

  setStatus: (newStatus) => set({ status: newStatus }),
  setOperatingDate: (date) => set({ operating_date: date }),

  // 서버 응답을 한 번에 통합. operating_date 미지정 시 기본 5/20 유지.
  syncFromServer: ({ status, operating_date }) => set({
    status,
    operating_date: operating_date ?? '2026-05-20',
  }),
});

// shouldBeOpen 셀렉터: 운영 일자 == 오늘 && 현재 시각 ∈ [start, end).
export const businessStateSelectors = {
  shouldBeOpen: (s) => {
    const schedule = SCHEDULE[s.operating_date];
    if (!schedule) return false;
    const now = new Date();
    const today =
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, '0')}-` +
      `${String(now.getDate()).padStart(2, '0')}`;
    if (today !== s.operating_date) return false;
    const nowHm =
      `${String(now.getHours()).padStart(2, '0')}:` +
      `${String(now.getMinutes()).padStart(2, '0')}`;
    return nowHm >= schedule.start && nowHm < schedule.end;
  },
};

export { SCHEDULE };

const useBusinessStateStore = import.meta.env.DEV
  ? create(devtools(businessStateImpl, { name: 'BusinessStateStore' }))
  : create(businessStateImpl);

export default useBusinessStateStore;
