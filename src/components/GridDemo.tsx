import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { useExpansion } from '../hooks/useExpansion';
import { generateTree } from '../lib/data';
import { flattenVisible } from '../lib/flatten';
import { searchTree } from '../lib/search';
import { Metrics } from './Metrics';
import { TreeGrid } from './TreeGrid';

/** Runs `fn` and returns its result with how long it took, in milliseconds. */
function timed<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

/**
 * Wires the data, search, expansion and grid together.
 * App remounts this with a new `key` when the dataset size changes,
 * which resets every piece of state cleanly.
 */
export function GridDemo({ size }: { size: number }) {
  const built = useMemo(() => timed(() => generateTree(size)), [size]);
  const roots = built.value;

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const searched = useMemo(() => timed(() => searchTree(roots, deferredQuery)), [roots, deferredQuery]);
  const search = searched.value;

  const { expanded, toggle, expandAll, collapseAll } = useExpansion(roots, search);

  const flat = useMemo(
    () => timed(() => flattenVisible(roots, expanded, search ? search.visible : null)),
    [roots, expanded, search],
  );
  const rows = flat.value;

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const lastScrollRef = useRef(0);
  const onScrollActivity = useCallback(() => {
    lastScrollRef.current = performance.now();
  }, []);

  return (
    <>
      <div className="controls">
        <label className="field">
          <span>Search name or owner</span>
          <input
            type="search"
            value={query}
            placeholder="e.g. invoice, esha, .csv"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="btn-row">
          <button type="button" onClick={expandAll}>
            Expand all
          </button>
          <button type="button" onClick={collapseAll}>
            Collapse all
          </button>
        </div>
        {search && (
          <p className="hint" role="status">
            {search.matches.size.toLocaleString('en-US')} matches. Branches that contain them are opened for you.
          </p>
        )}
      </div>

      <Metrics
        totalNodes={size}
        visibleRows={rows.length}
        renderedRows={range.end - range.start}
        buildMs={built.ms}
        flattenMs={flat.ms}
        searchMs={search ? searched.ms : null}
        lastScrollRef={lastScrollRef}
      />

      <TreeGrid
        rows={rows}
        expanded={expanded}
        focusedId={focusedId}
        onFocusChange={setFocusedId}
        onToggle={toggle}
        onRangeChange={setRange}
        onScrollActivity={onScrollActivity}
      />

      <p className="keys">
        Click the grid, then use <kbd>↑</kbd> <kbd>↓</kbd> <kbd>Home</kbd> <kbd>End</kbd> <kbd>PgUp</kbd>{' '}
        <kbd>PgDn</kbd> to move, <kbd>→</kbd> to expand, <kbd>←</kbd> to collapse or go to the parent, and{' '}
        <kbd>Enter</kbd> to toggle.
      </p>
    </>
  );
}
