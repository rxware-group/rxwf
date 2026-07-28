import { t, useLabels } from '../i18n/labels.js';
import { Select } from './Select.js';

export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;
export const DEFAULT_PAGE_SIZE = 20;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface PaginationProps {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const labels = useLabels();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return (
    <nav className="list-pagination" aria-label={t(labels, 'common.pagination', undefined, '分页')}>
      <span className="list-pagination-info">
        {t(
          labels,
          'common.pageInfo',
          { page: String(safePage), totalPages: String(totalPages) },
          `第 ${safePage} / ${totalPages} 页`,
        )}
      </span>
      <label className="list-pagination-size">
        <Select
          value={String(pageSize)}
          aria-label={t(labels, 'common.pagination', undefined, '分页')}
          onChange={(next) => onPageSizeChange(Number(next) as PageSize)}
          options={PAGE_SIZE_OPTIONS.map((size) => ({
            value: String(size),
            label: t(
              labels,
              'common.pageSizeOption',
              { size: String(size) },
              `${size}/页`,
            ),
          }))}
        />
      </label>
      <button
        type="button"
        className="btn-secondary"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
      >
        {t(labels, 'common.prevPage')}
      </button>
      <button
        type="button"
        className="btn-secondary"
        disabled={safePage >= totalPages}
        onClick={() => onPageChange(safePage + 1)}
      >
        {t(labels, 'common.nextPage')}
      </button>
    </nav>
  );
}
