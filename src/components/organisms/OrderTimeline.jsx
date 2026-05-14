// OrderTimeline — organism (IMPLEMENTATION_PLAN §2.6 / UX §5.1 보강 / ADR-010).
// 주문 진행 5단계 progressbar + 단계별 진입 시각 미니뷰.
//
// 5 단계 (8 상태 중 사용자에게 가시 단계만):
//   ORDERED → TRANSFER_REPORTED → PAID → COOKING → READY
//   DONE 은 5/5 완료 상태 (수령 완료). HOLD·CANCELED 는 별도 처리 (본 컴포넌트 범위 밖).
//
// 핵심 결정 (ADR-010 보존):
// - **분 단위 추정 X** — 미니뷰는 `history[step]` 의 *실제 시각* 만 표시.
//   진입한 단계가 없으면 "—" (em-dash) 표시. 추정·예측 절대 X.
// - **role="progressbar"** + aria-valuemin/max/now — 스크린리더가 진행률 통보.
// - **모듈 최상위 STEPS 상수** — 5 단계 순서·라벨 SoT. 호출자가 마음대로 바꿀 수 X.
// - 각 단계 점(dot) state: 'done' (이전) / 'current' (현재) / 'future' (이후).
// - DONE 일 경우 doneCount = STEPS.length (5/5) → 5 단계 전부 'done' 표시.
//
// props:
// - current: 8 주문 상태 중 하나 (default 'ORDERED'). 알 수 없는 값 → 0 단계 fallback.
// - history?: 단계별 진입 시각 객체 — { ORDERED: '17:30', COOKING: '17:38', ... }
// - showMiniview?: true (기본) → 미니뷰 표시 / false → 5 단계 progressbar 만.
import { forwardRef } from 'react';

// 5 단계 정의 (모듈 최상위 — §3.5 6조 동적 보간 회피).
// short 는 사용자 노출 라벨 (한국어 2자) — UX §5.1.
const STEPS = [
  { key: 'ORDERED',           short: '접수' },
  { key: 'TRANSFER_REPORTED', short: '입금' },
  { key: 'PAID',              short: '확인' },
  { key: 'COOKING',           short: '조리' },
  { key: 'READY',             short: '수령' },
];

const OrderTimeline = forwardRef(function OrderTimeline(
  {
    current = 'ORDERED',
    history = {},
    showMiniview = true,
    className = '',
    ...rest
  },
  ref,
) {
  // doneCount 계산:
  //   - current='DONE' → 5 (전부 완료)
  //   - current 가 STEPS 인덱스 0~4 중 하나 → 그 인덱스 (즉, *이전* 단계 수)
  //   - 알 수 없는 current → 0 fallback (안전)
  let doneCount;
  if (current === 'DONE') {
    doneCount = STEPS.length;
  } else {
    const idx = STEPS.findIndex((s) => s.key === current);
    doneCount = idx < 0 ? 0 : idx;
  }

  const wrapperCls = [
    'bg-elevated text-ink',
    'p-md rounded-md',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={STEPS.length}
      aria-valuenow={doneCount}
      aria-label={`주문 진행 ${doneCount}/${STEPS.length} 단계`}
      className={wrapperCls}
      {...rest}
    >
      {/* 5단계 progressbar — 점 + 라벨 가로 배열. */}
      <ol className="flex items-center justify-between gap-xs">
        {STEPS.map((s, i) => {
          const state =
            i < doneCount ? 'done' : i === doneCount ? 'current' : 'future';
          // 점(dot) 클래스 — done(완료·체크)·current(강조)·future(흐림).
          const dotCls =
            state === 'done'
              ? 'bg-success text-ink'
              : state === 'current'
              ? 'bg-accent text-card-ink'
              : 'bg-divider text-muted';
          const labelCls =
            state === 'current'
              ? 'text-ink font-semibold text-xs'
              : 'text-muted text-xs';
          return (
            <li key={s.key} className="flex flex-col items-center flex-1 gap-2xs">
              <div
                aria-hidden="true"
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${dotCls}`}
              >
                {state === 'done' ? '✓' : i + 1}
              </div>
              <div className={labelCls}>{s.short}</div>
            </li>
          );
        })}
      </ol>

      {/* 미니뷰 — 단계별 진입 시각 (UX §5.1 보강·ADR-010 보존). */}
      {/* 진입한 단계 → 실제 시각, 진입 X → "—" (추정·예측 절대 X). */}
      {showMiniview && (
        <ul
          className="mt-md flex flex-col gap-2xs text-xs font-mono tabular-nums"
          aria-label="단계별 진입 시각"
        >
          {STEPS.map((s, i) => {
            const time = history[s.key];
            const state =
              i < doneCount ? 'done' : i === doneCount ? 'current' : 'future';
            const icon =
              state === 'done' ? '✅' : state === 'current' ? '🔄' : '⏳';
            return (
              <li key={s.key} className="flex items-center gap-xs">
                <span aria-hidden="true">{icon}</span>
                <span className="text-muted w-12">{s.short}</span>
                <span className="text-ink">{time ?? '—'}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

export default OrderTimeline;
