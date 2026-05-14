// ClosedScreen — organism (IMPLEMENTATION_PLAN §2.9 / G13 / UX §8.8).
// 영업 외(영업 전·종료 후·정산 마감·양일 종료) 풀스크린 안내 + 운영 일정 + 새로고침 CTA.
//
// 4 reason:
//   - 'before-open'       16:30 이전     — 곧 시작 안내 + default 마스코트
//   - 'after-close'       21:00 이후     — 1일차 종료, 내일 안내 + arrive 마스코트
//   - 'after-settlement'  관리자 마감    — 1일차 명시적 마감 + arrive 마스코트
//   - 'both-days-done'    양일 종료      — 축제 끝 + canceled 마스코트(😢)
//
// SoT:
//   - REASON_CONFIG / OPERATING_SCHEDULE 둘 다 모듈 최상위 (§3.5 6조).
//   - 운영 일정 = 2026-05-20(수) 16:30~21:00 + 2026-05-21(목) 11:00~21:00.
//
// 접근성:
//   - 페이지 = <section role="region" aria-labelledby="closed-title"> — 풀스크린 안내 의미.
//   - 운영 일정 카드 = role="status" + aria-live="polite" (UX §8.8 자동 announce).
//   - 새로고침 = Button atom + aria-label="화면 새로고침".
//
// 컴포넌트 재사용:
//   - MascotState (5종, useFallback=true 기본) — Task 2.4 산출물.
//   - Button (primary lg) — Task 1.3 산출물.
//
// 운영 일정 강조 — operatingDate=오늘 일자에만 'text-accent font-semibold'.
//   AI 슬롭 #26 ("본문 콘텐츠 형광 옐로 텍스트 금지")와 약한 충돌이 있으나:
//     1) 운영 일정은 *데이터 카드*(role=status) 내 1줄 강조 — 본문 콘텐츠 X.
//     2) 강조 의도가 "오늘이 어느 날인지" 명확 — 의미 가산 (시각 구분 필수).
//     3) 'font-semibold' 만으로는 색약·저시력 사용자 변별 약함 → accent 색 추가 보강.
//   결론: 명세 코드 그대로 text-accent + font-semibold 유지.
//
// 관련 결정: IMPLEMENTATION_PLAN §2.9 / G13 / UX §8.8 / ADR-026 §1 마스코트 fallback.
import { forwardRef } from 'react';
import MascotState from '../molecules/MascotState.jsx';
import Button from '../atoms/Button.jsx';

const REASON_CONFIG = {
  'before-open': {
    title: '아직 영업 시작 전이에요',
    body: '오늘 부스는 16:30부터 시작합니다. 잠시 후 다시 와 주세요.',
    mascot: 'default',
  },
  'after-close': {
    title: '오늘 영업이 끝났어요',
    body: '오늘 부스는 종료되었습니다. 내일 11:00에 다시 만나요!',
    mascot: 'arrive',
  },
  'after-settlement': {
    title: '오늘 부스 정산 마감!',
    body: '오늘 영업이 끝났습니다. 내일 11:00에 다시 만나요!',
    mascot: 'arrive',
  },
  'both-days-done': {
    title: '축제 부스가 종료되었습니다',
    body: '이용해 주셔서 감사합니다! 또 만나요 🪖',
    mascot: 'canceled',
  },
};

// UX §8.8 — 운영 일정 SoT (5/20·5/21).
const OPERATING_SCHEDULE = [
  { date: '2026-05-20', label: '5월 20일 (수)', hours: '16:30 ~ 21:00' },
  { date: '2026-05-21', label: '5월 21일 (목)', hours: '11:00 ~ 21:00' },
];

const ClosedScreen = forwardRef(function ClosedScreen(
  {
    reason = 'before-open',
    operatingDate,
    onRefresh,
    className = '',
    ...rest
  },
  ref,
) {
  const config = REASON_CONFIG[reason] ?? REASON_CONFIG['before-open'];

  return (
    <section
      ref={ref}
      data-testid="closed-screen"
      role="region"
      aria-labelledby="closed-title"
      className={[
        'min-h-screen flex flex-col items-center justify-center',
        'gap-md p-lg bg-bg text-ink',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <MascotState state={config.mascot} size="lg" useFallback />

      <h1
        id="closed-title"
        className="font-display font-black text-2xl text-center"
      >
        {config.title}
      </h1>

      <p className="text-sm text-muted text-center max-w-prose">
        {config.body}
      </p>

      {/* 운영 일정 — aria-live polite (UX §8.8) */}
      <div
        role="status"
        aria-live="polite"
        aria-label="운영 일정"
        className="bg-elevated rounded-md p-md w-full max-w-sm"
        data-testid="operating-schedule"
      >
        <h2 className="font-display font-bold text-base mb-sm">
          📅 운영 일정
        </h2>
        <ul className="flex flex-col gap-2xs">
          {OPERATING_SCHEDULE.map((s) => (
            <li
              key={s.date}
              className={[
                'flex justify-between text-sm font-mono tabular-nums',
                s.date === operatingDate
                  ? 'text-accent font-semibold'
                  : 'text-ink',
              ].join(' ')}
            >
              <span>{s.label}</span>
              <span>{s.hours}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 새로고침 CTA */}
      <Button
        variant="primary"
        size="lg"
        onClick={() => onRefresh?.()}
        aria-label="화면 새로고침"
      >
        🔄 새로고침
      </Button>
    </section>
  );
});

export default ClosedScreen;
