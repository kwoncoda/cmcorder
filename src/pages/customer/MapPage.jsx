// C-7 부스 약도 페이지 — Task 4.8.
//
// BoothMinimapModal organism 합성 (§3.5 1조 — 페이지 ≤120줄).
//  - ?order_id=N 시 본인 테이블 N번 강조 (myTableNo).
//  - 직접 진입 시 (메뉴 화면 우상단 🗺️) ?from=menu — 본인 테이블 X.
//  - 닫기 시 history back (이전 페이지 복귀).
import { useSearchParams, useNavigate } from 'react-router-dom';
import BoothMinimapModal from '../../components/organisms/BoothMinimapModal.jsx';

export default function MapPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ?order_id=N → 본인 테이블 강조. N이 숫자가 아니거나 없으면 undefined.
  const orderIdParam = searchParams.get('order_id');
  const myTableNo = orderIdParam ? Number(orderIdParam) : undefined;

  const handleClose = () => {
    // 이전 페이지로 — history.back() 동등 동작.
    navigate(-1);
  };

  return (
    <div data-testid="map-page">
      <BoothMinimapModal
        open
        myTableNo={myTableNo}
        gridSize={{ cols: 4, rows: 4 }}
        onClose={handleClose}
      />
    </div>
  );
}
