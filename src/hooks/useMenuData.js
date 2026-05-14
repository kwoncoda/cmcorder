// useMenuData hook — Task 4.2.
//
// MenuPage 의 data 위임. useApi + zod 스키마 검증을 캡슐화하고,
// "popular" 는 별도 fetch 없이 menus 에서 파생 (결정 E — 정적 BEST).
//
// 결정 E 규칙:
//  - recommended=true 메뉴 → TOP 3 (학생회가 메뉴 관리자에서 토글)
//  - 없으면 menus 첫 3개 fallback (메뉴 적을 때도 영역 채움)
//  - 동적 인기 집계 X — 백엔드 GET /api/popular 미구현 + 일회성 서비스.
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
  // popular 파생: recommended=true 우선, 없으면 첫 3개. 둘 다 최대 3.
  const recommended = menus.filter((m) => m.recommended).slice(0, 3);
  const popular = recommended.length > 0 ? recommended : menus.slice(0, 3);

  return {
    menus,
    popular,
    isLoading: menuQuery.isLoading,
    error: menuQuery.error,
    refetch: menuQuery.refetch,
  };
}
