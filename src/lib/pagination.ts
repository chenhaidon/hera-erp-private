import { useMemo, useState, useCallback, useRef, useEffect } from 'react';

export interface PaginationOptions {
  defaultPageSize?: number;
  pageSizeOptions?: number[];
}

export interface PaginationState<T> {
  paginatedItems: T[];
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  startItem: number;
  endItem: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export function usePagination<T>(
  items: T[],
  options: PaginationOptions = {}
): PaginationState<T> {
  const { defaultPageSize = 10, pageSizeOptions = [10, 20, 50, 100] } = options;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const prevTotalRef = useRef(totalItems);
  useEffect(() => {
    if (totalItems !== prevTotalRef.current) {
      prevTotalRef.current = totalItems;
      setPage(1);
    }
  }, [totalItems]);

  const setPageSize = useCallback((size: number) => {
    if (!pageSizeOptions.includes(size)) return;
    setPageSizeState(size);
    setPage(1);
  }, [pageSizeOptions]);

  return {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    startItem,
    endItem,
    setPage,
    setPageSize,
  };
}
