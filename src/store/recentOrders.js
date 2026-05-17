// recentOrders store — Bug 13.
// 사용자가 메뉴 페이지로 돌아갔을 때 진행 중 주문 status 페이지로 재진입 가능하도록 token 영속화.
// 보안: token은 access_token으로 GET /api/orders/:id?token=...을 호출할 때만 사용.
//
// 영속화: zustand persist + localStorage. 키 `chickenedak:recent-orders`.
// 최대 10개 (FIFO). 동일 id 중복 시 기존 제거 후 최신 unshift.
//
// 사용 예:
//   import useRecentOrdersStore from '@/store/recentOrders';
//   useRecentOrdersStore.getState().addOrder({ id, no, token, operating_date });
//   const orders = useRecentOrdersStore((s) => s.orders);
import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';

const MAX_ORDERS = 10;
// P2-3: 48시간 TTL — 축제 양일(5/20·5/21) 운영을 커버하면서 다음 학기까지 잔존 방지.
const TTL_MS = 48 * 60 * 60 * 1000;
const STORAGE_KEY = 'chickenedak:recent-orders';

const recentImpl = (set) => ({
  orders: [],

  // { id, no, token, operating_date } → unshift (최신 우선).
  // 동일 id 중복 시 기존 제거 후 추가 → 중복 X.
  // 10개 초과 시 가장 오래된 것 자동 pop.
  addOrder: (order) => set((state) => {
    if (!order || !order.id) return state;
    const filtered = state.orders.filter((o) => o.id !== order.id);
    const next = [
      { ...order, savedAt: Date.now() },
      ...filtered,
    ].slice(0, MAX_ORDERS);
    return { orders: next };
  }),

  removeOrder: (id) => set((state) => ({
    orders: state.orders.filter((o) => o.id !== id),
  })),

  // P2-3: TTL 기준으로 오래된 항목 제거. 마운트 시 한 번 호출하면 충분.
  pruneStale: (now = Date.now()) => set((state) => ({
    orders: state.orders.filter((o) => (now - (o.savedAt ?? 0)) < TTL_MS),
  })),

  clearAll: () => set({ orders: [] }),
});

const persisted = persist(recentImpl, {
  name: STORAGE_KEY,
  storage: createJSONStorage(() => localStorage),
  partialize: (s) => ({ orders: s.orders }),
});

const useRecentOrdersStore = import.meta.env.DEV
  ? create(devtools(persisted, { name: 'RecentOrdersStore' }))
  : create(persisted);

export default useRecentOrdersStore;
