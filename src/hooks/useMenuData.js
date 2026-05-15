// useMenuData hook — Task 4.2 + P2-1 (Codex v3 2026-05-15).
//
// MenuPage 의 data 위임. useApi + zod 스키마 검증을 캡슐화하고,
// "popular" 는 별도 fetch 없이 menus 에서 파생 (어드민 recommended 토글 단일).
//
// 사용자 결정 (2026-05-15, ADR-017 변경):
//  - 실시간 랭킹 X · 판매 수 X
//  - 어드민이 메뉴 관리에서 recommended 토글로 BEST 직접 선택 (최대 3개)
//  - fallback("recommended 없으면 첫 3개") 제거 — 어드민 미선택 시 BEST 영역 미표시
//
// 사용 예:
//   const { menus, popular, isLoading, error, refetch } = useMenuData();
import { useApi } from './useApi.js';
import { apiFetch } from '../api/client.js';
import { MenuListSchema } from '../api/schemas.js';
import { API } from '../api/routes.js';

export function useMenuData() {
  const menuQuery = useApi(
    ({ signal }) => apiFetch(API.MENUS, { schema: MenuListSchema, signal }),
    [],
  );

  const menus = menuQuery.data ?? [];
  // popular 파생: recommended=true 만, 최대 3개. 없으면 빈 배열 (어드민 책임).
  const popular = menus.filter((m) => m.recommended).slice(0, 3);

  return {
    menus,
    popular,
    isLoading: menuQuery.isLoading,
    error: menuQuery.error,
    refetch: menuQuery.refetch,
  };
}
