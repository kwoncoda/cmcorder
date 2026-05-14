// 단일 pino 인스턴스. 향후 pino-pretty는 dev에서만 별도 transport로 추가.
// - LOG_LEVEL 명시 시 우선. 없으면 NODE_ENV 기준 (prod=info, 그 외=debug).
// - base.pid/hostname 제거로 로그 노이즈 감소 — 부스 운영 시 한 줄이 길어지지 않게.
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { pid: undefined, hostname: undefined },
});
