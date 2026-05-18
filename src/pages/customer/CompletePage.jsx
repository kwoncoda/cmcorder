// C-4 주문 완료 (★ 절정) — design-bundle ScreenComplete (screens-customer.jsx:384-467).
// CustomerLayout 공통 헤더 사용 (P1 #1) — 자체 .app-header 제거.
// 누락 요소 복원 (P2 #7): 금액 복사 버튼, 주문 내역 receipt, 수령 정보 info banner, 조리 현황 ghost CTA.
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch } from '../../api/client.js';
import { OrderSchema } from '../../api/schemas.js';
import { API } from '../../api/routes.js';
import { useOrderToken } from '../../hooks/useOrderToken.js';
import DogTagFrame from '../../components/molecules/DogTagFrame.jsx';
import LoadingState from '../../components/state/LoadingState.jsx';
import ErrorState from '../../components/state/ErrorState.jsx';

const ACCOUNT_BANK = '국민은행';
const ACCOUNT_NUMBER = '233001-04-403536';
const ACCOUNT_HOLDER = '박동빈';
// Bug 4 — 복사 문자열에는 예금주 미포함 (은행 앱 송금란에 깨끗하게 붙여넣기). 화면 안내는 유지.
const ACCOUNT_TEXT = `${ACCOUNT_BANK} ${ACCOUNT_NUMBER}`;
const fmt = (n) => (n ?? 0).toLocaleString('ko-KR');

async function copyText(text) {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return 'copied'; } } catch { /* fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'absolute'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok ? 'copied' : 'manual';
  } catch { return 'manual'; }
}

export default function CompletePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, query: tokenQuery, withQuery } = useOrderToken(id);
  const [copyState, setCopyState] = useState('idle'); const [amountCopyState, setAmountCopyState] = useState('idle');
  // Codex final-gate P2 — 복사 성공 후 2초 idle 복귀 setTimeout이 테스트 teardown 이후 실행되어 ReferenceError를 일으키는 회귀 차단.
  const copyTimerRef = useRef(null); const amountTimerRef = useRef(null);
  useEffect(() => () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); if (amountTimerRef.current) clearTimeout(amountTimerRef.current); }, []);

  const orderQuery = useApi(({ signal }) => apiFetch(withQuery(API.ORDER(id)), { schema: OrderSchema, signal }), [id, token]);

  if (orderQuery.isLoading) return <LoadingState variant="page" label="주문 정보 가져오는 중…" minimumDelay={0} />;
  if (orderQuery.error) {
    if (orderQuery.error.status === 404) { navigate('/error/404', { replace: true }); return null; }
    return <ErrorState variant="page" title="주문 정보를 불러올 수 없어요" description="잠시 후 다시 시도해 주세요." onAction={orderQuery.refetch} actionLabel="다시 시도" />;
  }
  const order = orderQuery.data;
  if (!order) return null;

  const total = order.total_price ?? 0;
  const items = Array.isArray(order.items) ? order.items : [];
  const couponApplied = items.length > 0 && items.reduce((a, it) => a + it.base_price * it.quantity, 0) > total;

  const copyAccount = async () => { const r = await copyText(ACCOUNT_TEXT); setCopyState(r); if (r === 'copied') { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); copyTimerRef.current = setTimeout(() => setCopyState('idle'), 2000); } };
  const copyAmount = async () => { const r = await copyText(String(total)); setAmountCopyState(r); if (r === 'copied') { if (amountTimerRef.current) clearTimeout(amountTimerRef.current); amountTimerRef.current = setTimeout(() => setAmountCopyState('idle'), 2000); } };

  return (
    <section data-testid="complete-page">
      <div className="back-bar">
        <button type="button" onClick={() => navigate('/menu')} aria-label="뒤로">←</button>
        <h1>주문 완료</h1>
      </div>
      <div className="dogtag-stage">
        <DogTagFrame no={order.no} total={100} date={order.operating_date} dropping pulse />
        <h1 className="winner-copy"><span>WINNER WINNER</span><br /><span>CHICKEN DINNER</span></h1>
      </div>

      <div className="account-card" role="region" aria-labelledby="account-title" data-testid="account-info">
        <div className="acc-label" id="account-title">💸 입금 안내</div>
        <div className="acc-bank">{ACCOUNT_BANK} · 예금주 {ACCOUNT_HOLDER}</div>
        <div className="acc-no" data-testid="account-number">{ACCOUNT_NUMBER}</div>
        <div className="acc-amount">{fmt(total)} 원</div>
        <div className="acc-actions">
          <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={copyAccount} aria-label="계좌번호 복사">
            📋 {copyState === 'copied' ? '복사됨' : '계좌번호 복사'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={copyAmount} aria-label="금액 복사">
            📋 {amountCopyState === 'copied' ? '복사됨' : '금액 복사'}
          </button>
        </div>
        {(copyState === 'manual' || amountCopyState === 'manual') && (
          <p role="alert" className="text-xs text-warning mt-2xs" data-testid="copy-manual-hint">텍스트를 길게 눌러 복사해 주세요.</p>
        )}
      </div>

      <div className="receipt">
        {items.map((it) => (
          <div key={it.menu_id} className="line">
            <span className="label">{it.name} × {it.quantity}</span>
            <span className="price">{fmt(it.base_price * it.quantity)}원</span>
          </div>
        ))}
        {couponApplied && (
          <div className="line"><span className="label">쿠폰 할인</span><span className="price price-discount">−1,000원</span></div>
        )}
        <div className="line total"><span className="label">총 결제</span><span className="price price-lg" style={{ color: 'var(--color-accent)' }}>{fmt(total)}원</span></div>
      </div>

      <div className="warn-banner info">
        📍 <span><b>{order.table_no ? `매장 식사 · 테이블 ${order.table_no}` : '포장'}</b>{order.table_no && <> · 미니맵에서 위치 확인</>}</span>
      </div>
      <div className="warn-banner danger">
        ⚠️ <span><b>이체 후 "확인 요청" 버튼을 꼭 눌러주세요.</b><br />누르지 않으면 본부가 조리를 시작하지 못해요.</span>
      </div>

      <div style={{ height: 80 }} />
      <div className="sticky-bar" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40 }}>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => navigate(`/orders/${id}/transfer${tokenQuery}`)}>
          이체 완료하고 확인 요청
        </button>
      </div>
    </section>
  );
}
