// 카트 store (zustand v5) — Task 3.1.
//
// 핵심 규약:
// - 카트 항목 모양: { menuId, name, basePrice, category, image, code, sub, quantity }
// - items는 배열로 유지 (사용자 추가 순서 보존). 동일 menuId는 quantity 누적 병합.
// - image/code/sub은 카트·완료 화면 표시용 메타데이터(스냅샷). 메뉴 변경 후에도
//   주문 시점 시각자산이 유지되도록 함께 저장 (Bug 2 — 인벤토리에 이미지/코드 사라짐 수정).
// - totalQty / totalPrice는 *store에 저장 X*. 외부 셀렉터(`cartSelectors.*`)로 계산.
//   호출자는 useCartStore(cartSelectors.totalQty) 패턴으로 사용 — §3.5 2조.
// - devtools middleware는 dev 빌드에서만 부착 — production 번들에서 제외 (§3.5 8조).
//
// 사용 예:
//   useCartStore(cartSelectors.totalQty)        ✅
//   const { totalQty } = useCartStore()         ❌ (전체 객체 구독 금지)
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const cartImpl = (set) => ({
  items: [],

  // menu = { id, name, basePrice, category, image?, code?, sub? }. menu.id 없으면 무시 (방어).
  // image/code/sub은 카트·완료 화면 표시용 스냅샷. 누락 시 undefined (방어).
  addItem: (menu, qty = 1) => set((state) => {
    if (!menu || !menu.id) return state;
    const existing = state.items.find((i) => i.menuId === menu.id);
    if (existing) {
      return {
        items: state.items.map((i) =>
          i.menuId === menu.id ? { ...i, quantity: i.quantity + qty } : i,
        ),
      };
    }
    return {
      items: [
        ...state.items,
        {
          menuId: menu.id,
          name: menu.name,
          basePrice: menu.basePrice,
          category: menu.category,
          image: menu.image,
          code: menu.code,
          sub: menu.sub,
          quantity: qty,
        },
      ],
    };
  }),

  removeItem: (menuId) => set((state) => ({
    items: state.items.filter((i) => i.menuId !== menuId),
  })),

  // 양수면 갱신, 0 이하면 제거 — 한 함수로 통합.
  changeQty: (menuId, newQty) => set((state) => {
    if (newQty <= 0) {
      return { items: state.items.filter((i) => i.menuId !== menuId) };
    }
    return {
      items: state.items.map((i) =>
        i.menuId === menuId ? { ...i, quantity: newQty } : i,
      ),
    };
  }),

  clear: () => set({ items: [] }),
});

// 셀렉터 함수 — 호출자는 useCartStore(cartSelectors.totalQty) 형태로 구독.
// 셀렉터 결과는 zustand가 Object.is로 비교 — 값 동일하면 리렌더 X (§3.5 2조 핵심).
export const cartSelectors = {
  totalQty: (s) => s.items.reduce((sum, i) => sum + i.quantity, 0),
  totalPrice: (s) => s.items.reduce((sum, i) => sum + i.basePrice * i.quantity, 0),
};

const useCartStore = import.meta.env.DEV
  ? create(devtools(cartImpl, { name: 'CartStore' }))
  : create(cartImpl);

export default useCartStore;
