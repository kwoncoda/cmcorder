// design_fix_v4 Task 1 — 홈 카테고리 바 위 "테이블 배치도" CTA organism.
//
// 사용자 확정 카피 (Q6): 제목/설명/보조 3종 그대로 노출.
// 클릭 동작 (Q1): <Link to="/map"> — 인플레이스 모달 X, 기존 MapPage 진입.
// 크기 (Q2): 가로 카드, 모바일에서 너무 작지 않게 (세로 ~88px).
// 썸네일 (Q3): public/map/table-location.webp 우측 미리보기.
//
// 헤더 미니맵 버튼(header-map-link)은 그대로 유지 — 동일 목적지이지만 본 CTA 는
// 메뉴 페이지 본문에서 더 눈에 띄게 강조하기 위한 추가 진입점.
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';

const TableMapCTA = forwardRef(function TableMapCTA(
  { className = '', ...rest },
  ref,
) {
  return (
    <Link
      ref={ref}
      to="/map"
      aria-label="테이블 배치도 보기"
      data-testid="home-table-map-cta"
      className={`table-map-cta ${className}`.trim()}
      {...rest}
    >
      <div className="table-map-cta__body">
        <div className="table-map-cta__title">테이블 배치도</div>
        <div className="table-map-cta__desc">주문 전 테이블 위치를 확인해 주세요</div>
        <div className="table-map-cta__cue">
          <span>배치도 보기</span>
          <span className="table-map-cta__arrow" aria-hidden="true">→</span>
        </div>
      </div>
      <img
        className="table-map-cta__thumb"
        src="/map/table-location.webp"
        alt=""
        width="72"
        height="72"
        loading="lazy"
      />
    </Link>
  );
});

export default TableMapCTA;
