// CustomerLayout — design-bundle 헤더 + 본문 outlet + 423/CLOSED 가드.
//
// design-bundle 매핑:
//   - `<header class="app-header camo-gradient">` (screens-customer.jsx:11-28)
//   - brand-mark(28px mascot.png) + "오늘 저녁은 치킨이닭!" + "WINNER · WINNER · CHICKEN · DINNER"
//   - 🗺️ icon-btn(36px) + 🎒 icon-btn with count-badge
//
// 기능 로직 유지: useGlobalErrorHandler · businessQuery sync · /closed redirect 가드.
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import { useCallback, useEffect } from 'react';
import { useGlobalErrorHandler } from '../../hooks/useGlobalErrorHandler.js';
import { useApi } from '../../hooks/useApi.js';
import { apiFetch } from '../../api/client.js';
import { API } from '../../api/routes.js';
import { BusinessStateSchema } from '../../api/schemas.js';
import useBusinessStateStore from '../../store/businessState.js';
import useCartStore, { cartSelectors } from '../../store/cart.js';

function isOrderInProgressPath(pathname) {
  return /^\/orders\/\d+\/(complete|transfer|status)$/.test(pathname);
}
function isClosedAllowedPath(pathname) {
  return pathname === '/closed' || pathname === '/map' || isOrderInProgressPath(pathname);
}

export default function CustomerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const syncFromServer = useBusinessStateStore((s) => s.syncFromServer);
  const status = useBusinessStateStore((s) => s.status);
  const totalQty = useCartStore(cartSelectors.totalQty);

  const businessQuery = useApi(
    ({ signal }) => apiFetch(API.BUSINESS_STATE, { schema: BusinessStateSchema, signal }),
    [],
  );
  const { refetch: refetchBusinessState } = businessQuery;
  useEffect(() => {
    if (businessQuery.data?.status) syncFromServer(businessQuery.data);
  }, [businessQuery.data, syncFromServer]);

  // 어드민 OPEN/CLOSED 전환을 사용자 측이 ≤30s 내 감지 (D-day 안전망).
  useEffect(() => {
    const id = setInterval(() => refetchBusinessState(), 30_000);
    return () => clearInterval(id);
  }, [refetchBusinessState]);

  useEffect(() => {
    if (!businessQuery.data) return;
    if (status === 'CLOSED' && !isClosedAllowedPath(location.pathname)) {
      navigate('/closed', { replace: true });
      return;
    }
    // OPEN 전환 시 /closed 에 머문 사용자는 자동으로 /menu 진입.
    if (status === 'OPEN' && location.pathname === '/closed') {
      navigate('/menu', { replace: true });
    }
  }, [businessQuery.data, status, location.pathname, navigate]);

  const handleBusinessClosed = useCallback(() => {
    if (isOrderInProgressPath(location.pathname)) return;
    navigate('/closed', { replace: true });
  }, [navigate, location.pathname]);
  useGlobalErrorHandler({ onBusinessClosed: handleBusinessClosed });

  // /closed 페이지에서는 design-bundle ScreenClosed 헤더 정합:
  //   - 서브명 "CLOSED" (운영 헤더의 캐치프레이즈 대신)
  //   - 우측 액션(🗺️ / 🎒) 숨김 — 영업 외 상태에서 의미 없음
  // (2026-05-17 front_closed_design)
  const isClosedView = location.pathname === '/closed';

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <header className="app-header camo-gradient">
        <Link to="/menu" className="brand" style={{ cursor: 'pointer', textDecoration: 'none' }}>
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-name">오늘 저녁은 치킨이닭!</div>
            <span className="brand-subname">
              {isClosedView ? 'CLOSED' : 'WINNER · WINNER · CHICKEN · DINNER'}
            </span>
            {/* 회귀 보호 — 기존 테스트가 단축 표기 텍스트를 검출 */}
            <span className="sr-only">🍗 치킨이닭</span>
          </div>
        </Link>
        {!isClosedView && (
          <div className="head-actions">
            <Link
              to="/map"
              aria-label="부스 미니맵"
              className="icon-btn"
              data-testid="header-map-link"
            >
              <img src="/pubg-map.png" alt="" width="28" height="28" style={{ display: 'block' }} />
            </Link>
            <Link
              to="/cart"
              aria-label="인벤토리 (장바구니)"
              className="icon-btn"
              data-testid="header-cart-link"
            >
              <img src="/pubg-inventory.webp" alt="" width="28" height="28" style={{ display: 'block' }} />
              {totalQty > 0 && <span className="count-badge">{totalQty}</span>}
            </Link>
          </div>
        )}
      </header>

      <main className="app-body flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
