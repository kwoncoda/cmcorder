// 단일 pino 인스턴스 + P1-3 (Codex v3 2026-05-15) token redaction.
//
// 설계:
//   - LOG_LEVEL 명시 시 우선. 없으면 NODE_ENV 기준 (prod=info, 그 외=debug).
//   - base.pid/hostname 제거로 로그 노이즈 감소.
//   - P1-3: access_token이 PII → URL query / 객체 필드 모두 redaction.
//
// redact 전략:
//   - `req.query.token`, `query.token` → '[REDACTED]' 문자열 치환 (pino 표준)
//   - `req.url`은 censor 함수로 `token=...` 부분만 마스킹, 다른 query 보존
//   - createLogger({ stream })로 테스트 stream 주입 가능
import pino from 'pino';

const TOKEN_QUERY_RE = /([?&])token=([^&]*)/gi;

function censorUrl(value) {
  if (typeof value !== 'string') return value;
  if (!TOKEN_QUERY_RE.test(value)) return value;
  // RegExp.test는 stateful (global flag) → lastIndex 리셋.
  TOKEN_QUERY_RE.lastIndex = 0;
  return value.replace(TOKEN_QUERY_RE, '$1token=[REDACTED]');
}

const DEFAULT_REDACT_PATHS = [
  'req.query.token',
  'query.token',
  'body.token',
  'access_token',
  'response.access_token',
];

/**
 * pino logger factory — 테스트 stream 주입 가능.
 *
 * @param {object} [opts]
 * @param {NodeJS.WritableStream} [opts.stream] — 테스트용 (기본: stdout)
 * @param {string} [opts.level]
 */
/**
 * pino-http 옵션 — req.url의 token query 마스킹용 serializer 제공.
 * server/app.js에서 pinoHttp({ logger, ...pinoHttpRedactOptions }) 식으로 사용.
 */
export function pinoHttpRedactOptions() {
  return {
    serializers: {
      req(req) {
        const std = pino.stdSerializers.req(req);
        if (std.url) std.url = censorUrl(std.url);
        if (std.originalUrl) std.originalUrl = censorUrl(std.originalUrl);
        return std;
      },
    },
  };
}

export function createLogger({ stream, level } = {}) {
  function reqSerializer(req) {
    const std = pino.stdSerializers.req(req);
    if (std.url) std.url = censorUrl(std.url);
    if (std.originalUrl) std.originalUrl = censorUrl(std.originalUrl);
    return std;
  }
  const resolved = pino(
    {
      level: level ?? process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      base: { pid: undefined, hostname: undefined },
      serializers: { req: reqSerializer },
      // 첫 인자 객체가 req serializer를 거치지 않는 단순 케이스(예: { req: { url } })
      // 도 추가 안전망으로 censor.
      formatters: {
        log(obj) {
          if (obj?.req?.url) obj.req.url = censorUrl(obj.req.url);
          if (obj?.req?.originalUrl) obj.req.originalUrl = censorUrl(obj.req.originalUrl);
          if (obj?.url) obj.url = censorUrl(obj.url);
          return obj;
        },
      },
      redact: {
        paths: DEFAULT_REDACT_PATHS,
        censor: '[REDACTED]',
      },
    },
    stream,
  );
  return resolved;
}

export const logger = createLogger();
