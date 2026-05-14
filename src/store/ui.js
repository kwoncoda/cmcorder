// UI store (zustand v5) — Task 3.1.
//
// 범위: *모달 스택만*. 미니맵 open 도 modal stack에 통합 ({ id: 'minimap' }).
// 스크롤 위치는 전역화하지 않음 — 페이지 내부 ref / history state로 처리.
// 전역에 두면 모든 페이지가 스크롤 변경마다 리렌더 트리거됨 (§3.5 2조 위반).
//
// 사용 예:
//   useUiStore(uiSelectors.isModalOpen('minimap'))
//   useUiStore(uiSelectors.topModal)
//   const open = useUiStore((s) => s.openModal); open('minimap')
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const uiImpl = (set) => ({
  // [{ id: string, props?: object }]. 같은 id가 다시 열리면 기존 entry를 제거 후 푸시 (중복 X).
  modalStack: [],

  openModal: (id, props = {}) => set((state) => ({
    modalStack: [
      ...state.modalStack.filter((m) => m.id !== id),
      { id, props },
    ],
  })),

  closeModal: (id) => set((state) => ({
    modalStack: state.modalStack.filter((m) => m.id !== id),
  })),

  closeAllModals: () => set({ modalStack: [] }),
});

// 셀렉터 — modalStack 배열의 reference 변경에도 결과값이 같으면 리렌더 X.
// isModalOpen은 *팩토리* — id를 받아 셀렉터를 반환.
export const uiSelectors = {
  isModalOpen: (id) => (s) => s.modalStack.some((m) => m.id === id),
  topModal: (s) => s.modalStack[s.modalStack.length - 1] ?? null,
};

const useUiStore = import.meta.env.DEV
  ? create(devtools(uiImpl, { name: 'UiStore' }))
  : create(uiImpl);

export default useUiStore;
