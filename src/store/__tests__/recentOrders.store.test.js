// Bug 13 — 진행 중 주문 재진입을 위한 recentOrders store 회귀 테스트.
//
// 회귀 보호:
//  - 초기 빈 배열
//  - addOrder: prepend
//  - addOrder: 동일 id 중복 시 기존 제거 후 최신 unshift
//  - addOrder: 10개 초과 시 가장 오래된 것 pop
//  - removeOrder: 지정 id 제거
//  - localStorage 영속화 (zustand persist)
import { describe, it, expect, beforeEach } from 'vitest';
import useRecentOrdersStore from '../recentOrders.js';

describe('recentOrdersStore (Bug 13)', () => {
  beforeEach(() => {
    // localStorage 초기화 + store 리셋
    localStorage.clear();
    useRecentOrdersStore.setState({ orders: [] });
  });

  it('초기 orders는 빈 배열', () => {
    expect(useRecentOrdersStore.getState().orders).toEqual([]);
  });

  it('addOrder — 신규 주문 prepend', () => {
    const { addOrder } = useRecentOrdersStore.getState();
    addOrder({ id: 1, no: 5, token: 't1', operating_date: '2026-05-20' });
    expect(useRecentOrdersStore.getState().orders).toHaveLength(1);
    expect(useRecentOrdersStore.getState().orders[0]).toMatchObject({ id: 1, no: 5, token: 't1' });
  });

  it('addOrder — 동일 id 중복 시 기존 제거 후 최신 unshift (중복 X)', () => {
    const { addOrder } = useRecentOrdersStore.getState();
    addOrder({ id: 1, no: 5, token: 't1', operating_date: '2026-05-20' });
    addOrder({ id: 1, no: 5, token: 't2', operating_date: '2026-05-20' });
    expect(useRecentOrdersStore.getState().orders).toHaveLength(1);
    expect(useRecentOrdersStore.getState().orders[0].token).toBe('t2');
  });

  it('addOrder — 10개 초과 시 가장 오래된 것 pop', () => {
    const { addOrder } = useRecentOrdersStore.getState();
    for (let i = 1; i <= 11; i++) {
      addOrder({ id: i, no: i, token: `t${i}`, operating_date: '2026-05-20' });
    }
    const orders = useRecentOrdersStore.getState().orders;
    expect(orders).toHaveLength(10);
    expect(orders[0].id).toBe(11);
    expect(orders.find((o) => o.id === 1)).toBeUndefined();
  });

  it('removeOrder — 지정 id 제거', () => {
    const { addOrder, removeOrder } = useRecentOrdersStore.getState();
    addOrder({ id: 1, no: 1, token: 't', operating_date: '2026-05-20' });
    addOrder({ id: 2, no: 2, token: 't', operating_date: '2026-05-20' });
    removeOrder(1);
    expect(useRecentOrdersStore.getState().orders).toHaveLength(1);
    expect(useRecentOrdersStore.getState().orders[0].id).toBe(2);
  });

  it('localStorage 영속화 — addOrder 후 localStorage에 저장', () => {
    const { addOrder } = useRecentOrdersStore.getState();
    addOrder({ id: 1, no: 5, token: 't1', operating_date: '2026-05-20' });
    const raw = localStorage.getItem('chickenedak:recent-orders');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    // zustand persist는 { state, version } 구조 — 핵심 필드만 확인.
    expect(JSON.stringify(parsed)).toMatch(/"id":1/);
    expect(JSON.stringify(parsed)).toMatch(/"token":"t1"/);
  });

  // ── P2-3 (Codex 리뷰) TTL pruning ─────────────────────────────────
  it('★ P2-3 — pruneStale: 48시간 이상 지난 항목 제거', () => {
    const now = Date.now();
    const FORTY_NINE_HOURS = 49 * 60 * 60 * 1000;
    useRecentOrdersStore.setState({
      orders: [
        { id: 1, no: 1, token: 't', operating_date: '2026-05-20', savedAt: now - FORTY_NINE_HOURS }, // stale
        { id: 2, no: 2, token: 't', operating_date: '2026-05-20', savedAt: now - 1000 },             // fresh
      ],
    });
    useRecentOrdersStore.getState().pruneStale(now);
    const remaining = useRecentOrdersStore.getState().orders;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(2);
  });

  it('★ P2-3 — pruneStale: savedAt 없는 항목도 stale로 간주하여 제거', () => {
    const now = Date.now();
    useRecentOrdersStore.setState({
      orders: [{ id: 9, no: 9, token: 't', operating_date: '2026-05-20' }], // savedAt 누락
    });
    useRecentOrdersStore.getState().pruneStale(now);
    expect(useRecentOrdersStore.getState().orders).toHaveLength(0);
  });
});
