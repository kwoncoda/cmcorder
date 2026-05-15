// C-4 주문 완료 — Task 4.5 (§3.5 1조 ≤120줄, 절정 ★).
//  - 도그태그 + WINNER WINNER 2줄(DESIGN §5.2) + 계좌 안내 + 이체 CTA.
//  - 계좌 복사 3단계 fallback (clipboard → execCommand → manual hint).
//  - P0-4: useOrderToken 으로 ?token= 자동 부착.
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch } from '../../api/client.js';
import { OrderSchema } from '../../api/schemas.js';
import { API } from '../../api/routes.js';
import { useOrderToken } from '../../hooks/useOrderToken.js';
import DogTagFrame from '../../components/molecules/DogTagFrame.jsx';
import Button from '../../components/atoms/Button.jsx';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';

// 계좌 정보 — G9 (모듈 최상위, §3.5 6조).
const ACCOUNT_BANK = '국민은행';
const ACCOUNT_NUMBER = '233001-04-403536';
const ACCOUNT_HOLDER = '박동빈';
const ACCOUNT_TEXT = `${ACCOUNT_BANK} ${ACCOUNT_NUMBER} ${ACCOUNT_HOLDER}`;

// 클립보드 3단계 fallback — clipboard API → execCommand → manual.
// 'copied' | 'manual' 반환. setState 책임은 호출자.
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch { /* clipboard 실패 — execCommand 로 폴백 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok ? 'copied' : 'manual';
  } catch {
    return 'manual';
  }
}

export default function CompletePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  // P0-4: 학생/외부인 모두 access_token 필수.
  const { token, query: tokenQuery, withQuery } = useOrderToken(id);
  const [copyState, setCopyState] = useState('idle');

  const orderQuery = useApi(
    ({ signal }) => apiFetch(withQuery(API.ORDER(id)), { schema: OrderSchema, signal }),
    [id, token],
  );

  if (orderQuery.isLoading) {
    return <LoadingState variant="page" label="주문 정보 가져오는 중…" minimumDelay={0} />;
  }
  if (orderQuery.error) {
    if (orderQuery.error.status === 404) {
      navigate('/error/404', { replace: true });
      return null;
    }
    return (
      <ErrorState variant="page" title="주문 정보를 불러올 수 없어요"
        description="잠시 후 다시 시도해 주세요."
        onAction={orderQuery.refetch} actionLabel="다시 시도" />
    );
  }

  const order = orderQuery.data;
  if (!order) return null;

  const copyAccount = async () => {
    const result = await copyText(ACCOUNT_TEXT);
    setCopyState(result);
    if (result === 'copied') setTimeout(() => setCopyState('idle'), 2000);
  };

  return (
    <section data-testid="complete-page" className="flex flex-col items-center gap-md p-md">
      <div className="font-stencil text-4xl text-accent leading-none text-center" aria-label="치킨 디너 위너">
        <div>WINNER WINNER</div>
        <div>CHICKEN DINNER</div>
      </div>
      <p className="font-display font-bold text-base text-ink">치킨 디너 위너!</p>
      <DogTagFrame no={order.no} total={100} date={order.operating_date} dropping pulse={false} />
      <div role="region" aria-labelledby="account-title"
        className="w-full bg-elevated rounded-md p-md flex flex-col gap-sm" data-testid="account-info">
        <h2 id="account-title" className="font-display font-bold text-base">입금 계좌</h2>
        <p className="font-mono tabular-nums text-lg text-ink" data-testid="account-number">
          {ACCOUNT_BANK} {ACCOUNT_NUMBER}
        </p>
        <p className="text-sm text-muted">예금주: {ACCOUNT_HOLDER}</p>
        <Button type="button" variant="secondary" onClick={copyAccount} aria-label="계좌번호 복사">
          {copyState === 'copied' ? '복사됨' : '계좌번호 복사'}
        </Button>
        {copyState === 'manual' && (
          <p role="alert" className="text-xs text-warning" data-testid="copy-manual-hint">
            텍스트를 길게 눌러 복사해 주세요.
          </p>
        )}
      </div>
      <Button variant="primary" size="lg" block onClick={() => navigate(`/orders/${id}/transfer${tokenQuery}`)}>
        이체 완료하고 확인 요청
      </Button>
    </section>
  );
}
