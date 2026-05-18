// ClosedScreen — design-bundle ScreenClosed (.closed-screen) 정합.
//
// 4 reason 매핑 + 운영 일정 카드(.schedule).
// 마스코트(MascotState) → 웹로고(<img>) 교체 (2026-05-17 front_closed_design).
// 자물쇠/새로고침 제거 (2026-05-17 front_closed_design)
//   — CustomerLayout 30초 폴링이 OPEN 전환을 자동 수행하므로 새로고침 CTA 불요.
import { forwardRef } from 'react';

// Bug 12 / P2-1 — 5/20·5/21 양일 모두 오후 3시(15:00) 오픈으로 통일 (사용자 결정).
const REASON_CONFIG = {
  'before-open':     { title: '아직 영업 시작 전이에요',     body: '오늘 부스는 오후 3시에 오픈할 예정입니다. 잠시 후 다시 와 주세요.' },
  'after-close':     { title: '오늘 영업이 끝났어요',         body: '오늘 부스는 종료되었습니다. 내일 오후 3시에 다시 만나요!' },
  'after-settlement':{ title: '오늘 부스 정산 마감!',         body: '오늘 영업이 끝났습니다. 내일 오후 3시에 다시 만나요!' },
  'both-days-done':  { title: '축제 부스가 종료되었습니다',   body: '이용해 주셔서 감사합니다! 또 만나요 🪖' },
};

const OPERATING_SCHEDULE = [
  { date: '2026-05-20', label: '5월 20일 (수)', hours: '15:00 ~ 21:00' },
  { date: '2026-05-21', label: '5월 21일 (목)', hours: '15:00 ~ 21:00' },
];

const ClosedScreen = forwardRef(function ClosedScreen(
  { reason = 'before-open', operatingDate, className = '', ...rest },
  ref,
) {
  const config = REASON_CONFIG[reason] ?? REASON_CONFIG['before-open'];

  return (
    <section
      ref={ref}
      data-testid="closed-screen"
      role="region"
      aria-labelledby="closed-title"
      className={`closed-screen ${className}`.trim()}
      {...rest}
    >
      <h1 id="closed-title">{config.title}</h1>
      <img src="/web-logo.png" alt="치킨이닭 웹 로고" className="closed-logo" />
      <p style={{ color: 'var(--color-muted)', maxWidth: 280, textAlign: 'center' }}>
        {config.body}
      </p>
      <div
        role="status"
        aria-live="polite"
        aria-label="운영 일정"
        className="schedule"
        data-testid="operating-schedule"
      >
        <h2 className="label">운영 일정</h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {OPERATING_SCHEDULE.map((s) => (
            <li
              key={s.date}
              className={`item ${s.date === operatingDate ? 'text-accent font-semibold' : ''}`.trim()}
            >
              <span>{s.label}</span>
              <span>{s.hours}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
});

export default ClosedScreen;
