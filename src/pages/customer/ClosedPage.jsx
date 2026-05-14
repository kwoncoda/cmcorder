// C-9 영업 외 안내 페이지 — Task 4.9.
//
// ClosedScreen organism 합성 (§3.5 1조 — 페이지 ≤120줄).
//  - ?reason=before-open|after-close|after-settlement|both-days-done
//  - ?date=YYYY-MM-DD — 오늘 일자 강조 (운영 일정 카드)
//  - 새로고침 CTA — window.location.reload() (G13 reactive 단일 진입점).
import { useSearchParams } from 'react-router-dom';
import ClosedScreen from '../../components/organisms/ClosedScreen.jsx';

export default function ClosedPage() {
  const [searchParams] = useSearchParams();
  // 기본값 'before-open' — 쿼리 미지정 시 안전 fallback.
  const reason = searchParams.get('reason') ?? 'before-open';
  // 기본 일자 — D-day 5/20.
  const operatingDate = searchParams.get('date') ?? '2026-05-20';

  return (
    <div data-testid="closed-page">
      <ClosedScreen
        reason={reason}
        operatingDate={operatingDate}
        onRefresh={() => window.location.reload()}
      />
    </div>
  );
}
