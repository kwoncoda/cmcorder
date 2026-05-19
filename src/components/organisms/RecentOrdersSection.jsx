// Bug 13 — 메뉴 페이지 상단 "진행 중 주문" 섹션.
//
// 책임:
//  - recentOrdersStore에 저장된 주문들의 현재 상태를 fetch.
//  - 진행 중 (DONE/CANCELED 외) 주문만 카드로 렌더.
//  - 카드 클릭 → /orders/:id/status?token=... 네비.
//  - 진행 중 0건이면 섹션 자체 미렌더.
//
// P2-3 (Codex 리뷰): terminal 주문은 store에서 즉시 removeOrder → 모든 카드가
// 사라지면 orders.length===0으로 섹션 자동 hide. 마운트 시 pruneStale로 TTL 지난 항목 정리.
// P2-2 (Codex 최종 리뷰): fetch 실패는 *카드 유지 + 안내*로 처리. 일시적 네트워크/5xx
// 오류만으로 사용자의 재진입 경로(localStorage)를 사라지게 하지 않는다.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useRecentOrdersStore from '../../store/recentOrders.js';
import { apiFetch } from '../../api/client.js';
import { API } from '../../api/routes.js';
import StatusChip from '../molecules/StatusChip.jsx';

// 사용자 진행 중 카드에서 숨길 상태. 도메인 터미널(SETTLED/CANCELED)보다 넓다 —
// DINING/DONE 도 사용자에게는 종결처럼 보여야 하므로 포함.
const TERMINAL = new Set(['DINING', 'DONE', 'SETTLED', 'CANCELED']);

// 단일 주문 카드 — mount 1회 status fetch.
// terminal(DINING/DONE/SETTLED/CANCELED): store에서 즉시 제거하여 다음 마운트에서도 사라짐.
// fetch 실패: 카드 *유지* + 안내 문구 + 클릭은 status 페이지로 — 사용자가 재시도 가능.
function RecentOrderCard({ entry, onOpen }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);
  const removeOrder = useRecentOrdersStore((s) => s.removeOrder);

  useEffect(() => {
    let alive = true;
    apiFetch(`${API.ORDER(entry.id)}?token=${encodeURIComponent(entry.token)}`)
      .then((order) => {
        if (!alive) return;
        const s = order?.status ?? null;
        setStatus(s);
        if (s && TERMINAL.has(s)) removeOrder(entry.id);
      })
      .catch(() => {
        // P2-2: 네트워크/서버 오류는 카드 유지 — 일시 오류로 재진입 경로가 사라지면 안 된다.
        // 안전한 기본 정책: 모든 fetch 실패에서 카드 보존. 사용자는 status 페이지로 가서 직접 확인.
        if (alive) setError(true);
      });
    return () => { alive = false; };
  }, [entry.id, entry.token, removeOrder]);

  // 종결 상태만 즉시 hide (store에서도 곧 제거됨). 에러는 카드 유지.
  if (status && TERMINAL.has(status)) return null;

  return (
    <button
      type="button"
      data-testid={`recent-order-card-${entry.id}`}
      className="recent-order-card"
      onClick={() => onOpen(entry)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '12px 14px', marginBottom: 8,
        background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))',
        borderRadius: 12, cursor: 'pointer', textAlign: 'left',
      }}
      aria-label={`주문 #${entry.no} 조리 현황 보기`}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong style={{ fontSize: 14 }}>주문 #{entry.no}</strong>
        {error ? (
          <span style={{ fontSize: 11, color: 'var(--color-danger, #c0392b)' }} role="status">
            상태를 불러오지 못했어요. 다시 시도해주세요.
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>조리 현황 보기 →</span>
        )}
      </span>
      {status && <StatusChip status={status} size="sm" />}
    </button>
  );
}

export default function RecentOrdersSection() {
  const orders = useRecentOrdersStore((s) => s.orders);
  const pruneStale = useRecentOrdersStore((s) => s.pruneStale);
  const navigate = useNavigate();

  // P2-3: 마운트 시 TTL 지난 오래된 항목 정리.
  useEffect(() => { pruneStale(); }, [pruneStale]);

  if (!orders || orders.length === 0) return null;

  const handleOpen = (entry) => {
    navigate(`/orders/${entry.id}/status?token=${encodeURIComponent(entry.token)}`);
  };

  return (
    <section data-testid="recent-orders-section" style={{ padding: '12px 16px 4px' }}>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>
        진행 중 주문
      </div>
      {orders.map((o) => (
        <RecentOrderCard key={o.id} entry={o} onOpen={handleOpen} />
      ))}
    </section>
  );
}
