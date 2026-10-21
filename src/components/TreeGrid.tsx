import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, UIEvent } from 'react';
import { formatDate, formatSize } from '../lib/format';
import { keyboardAction } from '../lib/keyboard';
import type { Column, ColumnKey, FlatRow } from '../lib/types';
import { computeRange, scrollTopToReveal } from '../lib/virtual';

export const DEFAULT_COLUMNS: Column[] = [
  { key: 'name', title: 'Name', width: 340, frozen: true },
  { key: 'kind', title: 'Type', width: 100 },
  { key: 'size', title: 'Size', width: 110, align: 'right' },
  { key: 'owner', title: 'Owner', width: 140 },
  { key: 'modified', title: 'Modified', width: 140 },
  { key: 'items', title: 'Items', width: 90, align: 'right' },
  { key: 'checksum', title: 'Checksum', width: 240 },
];

const rowDomId = (nodeId: string) => `row-${nodeId}`;

function cellText(row: FlatRow, key: ColumnKey): string {
  const n = row.node;
  switch (key) {
    case 'name':
      return n.name;
    case 'kind':
      return n.kind;
    case 'size':
      return n.kind === 'folder' ? '—' : formatSize(n.size);
    case 'owner':
      return n.owner;
    case 'modified':
      return formatDate(n.modified);
    case 'items':
      return n.kind === 'folder' ? String(n.children.length) : '—';
    case 'checksum':
      return n.checksum;
  }
}

function cellStyle(col: Column, left: number): CSSProperties {
  const style: CSSProperties = { width: col.width, minWidth: col.width, textAlign: col.align ?? 'left' };
  if (col.frozen) {
    style.position = 'sticky';
    style.left = left;
  }
  return style;
}

interface RowProps {
  row: FlatRow;
  index: number;
  rowHeight: number;
  columns: Column[];
  lefts: number[];
  totalWidth: number;
  expanded: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}

const GridRow = memo(function GridRow({
  row,
  index,
  rowHeight,
  columns,
  lefts,
  totalWidth,
  expanded,
  selected,
  onToggle,
  onSelect,
}: RowProps) {
  const { node, depth, hasChildren } = row;

  return (
    <div
      id={rowDomId(node.id)}
      role="row"
      aria-rowindex={index + 2} /* the header is row 1 */
      aria-level={depth + 1}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
      className={`tg-row${index % 2 === 1 ? ' tg-row-alt' : ''}`}
      style={{ top: index * rowHeight, height: rowHeight, width: totalWidth }}
      onClick={() => onSelect(node.id)}
      onDoubleClick={() => hasChildren && onToggle(node.id)}
    >
      {columns.map((col, c) => (
        <div
          key={col.key}
          role="gridcell"
          className={`tg-cell${col.frozen ? ' tg-frozen' : ''}`}
          style={cellStyle(col, lefts[c])}
        >
          {col.key === 'name' ? (
            <span className="tg-name" style={{ paddingLeft: 8 + depth * 18 }}>
              {hasChildren ? (
                <button
                  type="button"
                  tabIndex={-1}
                  className="tg-chevron"
                  aria-label={expanded ? 'Collapse' : 'Expand'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(node.id);
                  }}
                >
                  {expanded ? '▾' : '▸'}
                </button>
              ) : (
                <span className="tg-chevron-spacer" />
              )}
              <span className="tg-label" title={node.name}>
                {node.name}
              </span>
            </span>
          ) : (
            cellText(row, col.key)
          )}
        </div>
      ))}
    </div>
  );
});

export interface TreeGridProps {
  rows: readonly FlatRow[];
  expanded: ReadonlySet<string>;
  focusedId: string | null;
  onFocusChange: (id: string) => void;
  onToggle: (id: string) => void;
  columns?: Column[];
  /** Total height of the grid, header included. */
  height?: number;
  rowHeight?: number;
  headerHeight?: number;
  overscan?: number;
  /** Reports which slice of rows is in the DOM. */
  onRangeChange?: (range: { start: number; end: number }) => void;
  /** Called on every scroll event. Used by the FPS meter. */
  onScrollActivity?: () => void;
}

function TreeGridImpl({
  rows,
  expanded,
  focusedId,
  onFocusChange,
  onToggle,
  columns = DEFAULT_COLUMNS,
  height = 560,
  rowHeight = 32,
  headerHeight = 36,
  overscan = 6,
  onRangeChange,
  onScrollActivity,
}: TreeGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // The header is sticky and covers the top `headerHeight` pixels, so the
  // body is visible in a window of this height starting at scrollTop.
  const bodyHeight = height - headerHeight;
  const range = computeRange(scrollTop, bodyHeight, rowHeight, rows.length, overscan);

  const { lefts, totalWidth } = useMemo(() => {
    const offsets: number[] = [];
    let frozenOffset = 0;
    let width = 0;
    for (const col of columns) {
      offsets.push(frozenOffset);
      if (col.frozen) frozenOffset += col.width;
      width += col.width;
    }
    return { lefts: offsets, totalWidth: width };
  }, [columns]);

  const focusedIndex = useMemo(
    () => (focusedId === null ? -1 : rows.findIndex((r) => r.node.id === focusedId)),
    [rows, focusedId],
  );
  const focusedRendered = focusedIndex >= range.start && focusedIndex < range.end;

  useEffect(() => {
    onRangeChange?.({ start: range.start, end: range.end });
  }, [range.start, range.end, onRangeChange]);

  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
      onScrollActivity?.();
    },
    [onScrollActivity],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const pageSize = Math.max(1, Math.floor(bodyHeight / rowHeight) - 1);
    const action = keyboardAction(e.key, rows, focusedIndex, expanded, pageSize);
    if (action.type === 'none') return;

    e.preventDefault();
    if (action.type === 'toggle') {
      onToggle(action.id);
      return;
    }

    onFocusChange(rows[action.index].node.id);
    const el = containerRef.current;
    if (el) {
      const next = scrollTopToReveal(action.index, rowHeight, el.scrollTop, bodyHeight);
      if (next !== el.scrollTop) {
        el.scrollTop = next;
        setScrollTop(next);
      }
    }
  };

  const visibleRows = [];
  for (let i = range.start; i < range.end; i++) {
    const row = rows[i];
    visibleRows.push(
      <GridRow
        key={row.node.id}
        row={row}
        index={i}
        rowHeight={rowHeight}
        columns={columns}
        lefts={lefts}
        totalWidth={totalWidth}
        expanded={expanded.has(row.node.id)}
        selected={row.node.id === focusedId}
        onToggle={onToggle}
        onSelect={onFocusChange}
      />,
    );
  }

  return (
    <div
      ref={containerRef}
      className="tg"
      role="treegrid"
      aria-label="File tree"
      aria-rowcount={rows.length + 1}
      aria-colcount={columns.length}
      aria-activedescendant={focusedRendered && focusedId !== null ? rowDomId(focusedId) : undefined}
      tabIndex={0}
      style={{ height }}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
    >
      <div className="tg-inner" style={{ width: totalWidth }}>
        <div
          className="tg-header"
          role="row"
          aria-rowindex={1}
          style={{ height: headerHeight, width: totalWidth }}
        >
          {columns.map((col, c) => (
            <div
              key={col.key}
              role="columnheader"
              className={`tg-cell tg-head-cell${col.frozen ? ' tg-frozen' : ''}`}
              style={cellStyle(col, lefts[c])}
            >
              {col.title}
            </div>
          ))}
        </div>
        <div className="tg-body" style={{ height: range.totalHeight }}>
          {visibleRows}
          {rows.length === 0 && <div className="tg-empty">No matching rows</div>}
        </div>
      </div>
    </div>
  );
}

export const TreeGrid = memo(TreeGridImpl);
