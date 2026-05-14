// Task 4.2 — CategoryTabs organism 단위 테스트.
//
// 회귀 포인트:
//  - role="tablist" + tab 4개 (전체·치킨·사이드·음료)
//  - 활성 탭: aria-selected="true" + bg-accent (배경만 — 텍스트 형광 X)
//  - 클릭 시 onChange(value) 호출
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryTabs from '../CategoryTabs.jsx';

const CATEGORIES = [
  { value: 'all',     label: '전체' },
  { value: 'chicken', label: '치킨' },
  { value: 'side',    label: '사이드' },
  { value: 'drink',   label: '음료' },
];

describe('CategoryTabs', () => {
  it('★ 4개 탭 렌더', () => {
    render(<CategoryTabs categories={CATEGORIES} value="all" onChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByText('전체')).toBeInTheDocument();
    expect(screen.getByText('치킨')).toBeInTheDocument();
    expect(screen.getByText('사이드')).toBeInTheDocument();
    expect(screen.getByText('음료')).toBeInTheDocument();
  });

  it('★ 활성 탭 aria-selected=true', () => {
    render(<CategoryTabs categories={CATEGORIES} value="chicken" onChange={() => {}} />);
    const chickenTab = screen.getByTestId('category-tab-chicken');
    expect(chickenTab).toHaveAttribute('aria-selected', 'true');
    const allTab = screen.getByTestId('category-tab-all');
    expect(allTab).toHaveAttribute('aria-selected', 'false');
  });

  it('탭 클릭 시 onChange(value) 호출', () => {
    const onChange = vi.fn();
    render(<CategoryTabs categories={CATEGORIES} value="all" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('category-tab-drink'));
    expect(onChange).toHaveBeenCalledWith('drink');
  });
});
