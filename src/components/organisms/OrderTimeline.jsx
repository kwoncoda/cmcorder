// OrderTimeline — design-bundle Timeline (components.jsx:86-112) 정합.
// 5-step progressbar — .timeline + .tl-fill + .timeline-step.{done|current|future} + .tl-label.
// 미니뷰는 ADR-010 — history 시각만, 미진입 단계는 "—".
//
// design-bundle 마크업:
//   <div class="timeline" role="progressbar" ...>
//     <div class="tl-fill" style={{width:'...'}}/>
//     <div class="timeline-step done|current|future">
//       <div class="timeline-dot">{i<doneCount?'✓':i+1}</div>
//       <div class="tl-label">{short}</div>
//     </div>...
//   </div>
import { forwardRef } from 'react';

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
  let doneCount;
  if (current === 'DONE') doneCount = STEPS.length;
  else {
    const idx = STEPS.findIndex((s) => s.key === current);
    doneCount = idx < 0 ? 0 : idx;
  }
  // .tl-fill 너비 — design-bundle: calc((100% - 56px) * pct). 단순화하여 % 사용.
  const fillPct = Math.min(100, (doneCount / (STEPS.length - 1)) * 100);

  return (
    <div ref={ref} className={className}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={STEPS.length}
        aria-valuenow={doneCount}
        aria-label={`주문 진행 ${doneCount}/${STEPS.length} 단계`}
        className="timeline"
        {...rest}
      >
        <div className="tl-fill" style={{ width: `calc((100% - 56px) * ${fillPct / 100})` }} />
        {STEPS.map((s, i) => {
          const state = i < doneCount ? 'done' : i === doneCount ? 'current' : 'future';
          return (
            <div className={`timeline-step ${state}`} key={s.key}>
              <div className="timeline-dot">{i < doneCount ? '✓' : i + 1}</div>
              <div className="tl-label">{s.short}</div>
            </div>
          );
        })}
      </div>
      {showMiniview && (
        <ul className="mt-md flex flex-col gap-2xs text-xs font-mono tabular-nums" aria-label="단계별 진입 시각" style={{ listStyle: 'none', padding: 0, margin: '12px 16px 0' }}>
          {STEPS.map((s, i) => {
            const time = history[s.key];
            const state = i < doneCount ? 'done' : i === doneCount ? 'current' : 'future';
            return (
              <li key={s.key} className="flex items-center gap-xs" style={{ color: 'var(--color-muted)' }}>
                <span aria-hidden="true" className={`timeline-mini-dot timeline-mini-dot--${state}`} />
                <span style={{ width: 48 }}>{s.short}</span>
                <span style={{ color: 'var(--color-ink)' }}>{time ?? '—'}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

export default OrderTimeline;
