// CustomerLayout — Task 4.1 + P0-5 (Codex 리뷰).
//
// 사용자 페이지 공통 레이아웃:
//  - 헤더 (로고 + 🗺️ 지도 아이콘)
//  - 본문은 React Router 6 <Outlet/> 로 자식 라우트 렌더
//  - 423 BusinessClosedError 글로벌 catch → /closed redirect (결정 i, G13)
//  - P0-5: 마운트 시 /api/business-state 1회 sync — CLOSED면 /closed redirect.
//    (기존 423 reactive는 POST 호출 의존이라 사용자가 GET만 하면 CLOSED를 모름.
//     SPA 진입 시점에 영업 상태를 강제 확인해 잘못된 메뉴 노출 차단.)
//
// 진행 중 주문 페이지(/orders/:id/{complete,transfer,status})에서는 redirect X.
// 이미 PAID/READY/DONE 등 정산 가드 통과 상태 — 영업 종료와 무관하게 사용자가 자기 주문은 봐야 함.
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import { useCallback, useEffect } from 'react';
import { Map } from 'lucide-react';
import { useGlobalErrorHandler } from '../../hooks/useGlobalErrorHandler.js';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch } from '../../api/client.js';
import { API } from '../../api/routes.js';
import { BusinessStateSchema } from '../../api/schemas.js';
import useBusinessStateStore from '../../store/businessState.js';
import Icon from '../atoms/Icon.jsx';

// 진행 중 주문 페이지인지 (redirect 보호 대상).
function isOrderInProgressPath(pathname) {
  return /^\/orders\/\d+\/(complete|transfer|status)$/.test(pathname);
}

// CLOSED일 때도 머물러 있어도 되는 경로 (자기 자신 redirect 방지).
function isClosedAllowedPath(pathname) {
  return pathname === '/closed' || pathname === '/map' || isOrderInProgressPath(pathname);
}

export default function CustomerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const syncFromServer = useBusinessStateStore((s) => s.syncFromServer);
  const status = useBusinessStateStore((s) => s.status);

  // P0-5: 마운트 시 1회 영업 상태 sync (DashboardPage I-2 패턴과 동일).
  const businessQuery = useApi(
    ({ signal }) => apiFetch(API.BUSINESS_STATE, { schema: BusinessStateSchema, signal }),
    [],
  );
  useEffect(() => {
    if (businessQuery.data?.status) syncFromServer(businessQuery.data);
  }, [businessQuery.data, syncFromServer]);

  // CLOSED + 진행 중 주문/허용 경로 외 → /closed redirect.
  // *서버 응답 수신 후*에만 발화 — store 기본값 'CLOSED'로 인한 잘못된 redirect 방지.
  useEffect(() => {
    if (!businessQuery.data) return;
    if (status === 'CLOSED' && !isClosedAllowedPath(location.pathname)) {
      navigate('/closed', { replace: true });
    }
  }, [businessQuery.data, status, location.pathname, navigate]);

  const handleBusinessClosed = useCallback(() => {
    if (isOrderInProgressPath(location.pathname)) return;
    navigate('/closed', { replace: true });
  }, [navigate, location.pathname]);

  useGlobalErrorHandler({ onBusinessClosed: handleBusinessClosed });

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <header className="flex items-center justify-between p-md bg-elevated">
        <Link to="/menu" className="font-display font-bold text-lg">
          🍗 치킨이닭
        </Link>
        <Link
          to="/map"
          aria-label="부스 약도 열기"
          className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-divider focus-visible:outline-2 focus-visible:outline-accent"
          data-testid="header-map-link"
        >
          <Icon decorative>
            <Map size={20} />
          </Icon>
        </Link>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
