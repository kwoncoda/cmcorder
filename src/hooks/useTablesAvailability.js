// useTablesAvailability — Subagent 5.
//
// 마운트 1회 fetch + refresh() 로 제출 직전 1회 재확인.
// 실패 시 null 반환 (서버 409가 최후 가드 — fallback 허용).
import { useCallback } from 'react';
import { z } from 'zod';
import { useApi } from './useApi.js';
import { apiFetch } from '../api/client.js';
import { API } from '../api/routes.js';

const TableSchema = z.object({
  table_no: z.number(),
  status: z.enum(['available', 'occupied', 'dining', 'locked']),
});
export const TablesAvailabilitySchema = z.array(TableSchema);

export function useTablesAvailability() {
  const query = useApi(
    ({ signal }) =>
      apiFetch(API.TABLES_AVAILABILITY, { schema: TablesAvailabilitySchema, signal }).catch(
        () => null,
      ),
    [],
  );

  const refresh = useCallback(async () => {
    try {
      return await apiFetch(API.TABLES_AVAILABILITY, { schema: TablesAvailabilitySchema });
    } catch {
      return null;
    }
  }, []);

  return {
    availability: query.data ?? null,
    isReady: !query.isLoading,
    refresh,
  };
}
