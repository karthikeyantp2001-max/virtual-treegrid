export interface VirtualRange {
  /** Index of the first row to render (inclusive). */
  start: number;
  /** Index after the last row to render (exclusive). */
  end: number;
  /** Height of the full scroll area, as if every row were in the DOM. */
  totalHeight: number;
}

/**
 * Works out which rows are inside the viewport, plus a few extra rows
 * above and below (overscan) so fast scrolling never shows blank space.
 */
export function computeRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  rowCount: number,
  overscan = 6,
): VirtualRange {
  const totalHeight = rowCount * rowHeight;
  if (rowCount === 0) return { start: 0, end: 0, totalHeight: 0 };

  // Clamp in case scrollTop is stale after rows were removed (for example a collapse).
  const first = Math.min(Math.floor(Math.max(0, scrollTop) / rowHeight), rowCount - 1);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 1;

  return {
    start: Math.max(0, first - overscan),
    end: Math.min(rowCount, first + visibleCount + overscan),
    totalHeight,
  };
}

/** The smallest scroll change that brings a row fully into view. */
export function scrollTopToReveal(
  index: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
): number {
  const top = index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return scrollTop;
}
