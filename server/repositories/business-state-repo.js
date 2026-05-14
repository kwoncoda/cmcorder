// Task 6.5 — 영업 상태 리포지토리 (도메인 wrapper).
//
// domain/business-state.js를 라우트 친화적인 이름으로 노출.
// 단일 행 강제(CHECK id=1)는 init.sql가 보장 — repo는 추가 가드 X.
import {
  getBusinessState,
  openBusiness,
  closeBusiness,
} from '../domain/business-state.js';

export function getCurrentState(db) {
  return getBusinessState(db);
}

export function openBusinessDay(db, { operating_date }) {
  return openBusiness(db, { operating_date });
}

export function closeBusinessDay(db) {
  return closeBusiness(db);
}
