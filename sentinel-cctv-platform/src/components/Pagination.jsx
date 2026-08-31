import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Calculates smart sliding window page numbers with ellipsis (...)
 * E.g. [1, 2, 3, 4, 5, '...', 50] or [1, '...', 3, 4, 5, 6, 7, '...', 50]
 */
export const getPaginationRange = (currentPage, totalPages, delta = 2) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const left = Math.max(1, currentPage - delta);
  const right = Math.min(totalPages, currentPage + delta);

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= left && i <= right) ||
      (currentPage <= 4 && i <= 5) ||
      (currentPage >= totalPages - 3 && i >= totalPages - 4)
    ) {
      pages.push(i);
    }
  }

  const result = [];
  let prev = null;
  for (const p of pages) {
    if (prev !== null) {
      if (p - prev === 2) {
        result.push(prev + 1);
      } else if (p - prev > 2) {
        result.push('...');
      }
    }
    result.push(p);
    prev = p;
  }

  return result;
};

export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true
}) => {
  if (totalPages <= 1) return null;

  const pages = getPaginationRange(currentPage, totalPages, 2);

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
      {showFirstLast && (
        <button
          className="btn btn-sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          title="First Page (1)"
          style={{ padding: '4px 6px', minWidth: '28px' }}
        >
          <ChevronsLeft size={14} />
        </button>
      )}

      <button
        className="btn btn-sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        title="Previous Page"
        style={{ padding: '4px 10px', gap: '4px' }}
      >
        <ChevronLeft size={14} /> Prev
      </button>

      {pages.map((item, idx) => {
        if (item === '...') {
          return (
            <span
              key={`dots-${idx}`}
              style={{
                padding: '0 4px',
                color: 'var(--text-dim)',
                fontWeight: 700,
                userSelect: 'none',
                fontSize: '13px'
              }}
            >
              ...
            </span>
          );
        }
        const isActive = currentPage === item;
        return (
          <button
            key={item}
            className={`btn btn-sm ${isActive ? 'btn-primary' : ''}`}
            style={{
              minWidth: '32px',
              padding: '4px 8px',
              fontWeight: isActive ? 700 : 500
            }}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        );
      })}

      <button
        className="btn btn-sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        title="Next Page"
        style={{ padding: '4px 10px', gap: '4px' }}
      >
        Next <ChevronRight size={14} />
      </button>

      {showFirstLast && (
        <button
          className="btn btn-sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
          title={`Last Page (${totalPages})`}
          style={{ padding: '4px 6px', minWidth: '28px' }}
        >
          <ChevronsRight size={14} />
        </button>
      )}
    </div>
  );
};

export default Pagination;
