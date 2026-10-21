import { useCallback, useMemo, useRef, useState } from 'react';
import { collectFolderIds } from '../lib/data';
import type { SearchResult } from '../lib/search';
import type { TreeNode } from '../lib/types';

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Owns which rows are expanded.
 *
 * While a search is active, every ancestor of a match is forced open so the
 * matches are visible. The user can still collapse those branches: those
 * choices are remembered only for the current search and reset when it changes.
 */
export function useExpansion(roots: readonly TreeNode[], search: SearchResult | null) {
  const [base, setBase] = useState<ReadonlySet<string>>(() => new Set(roots.map((r) => r.id)));
  const [override, setOverride] = useState<{ for: SearchResult | null; ids: ReadonlySet<string> }>({
    for: null,
    ids: EMPTY,
  });

  const collapsedDuringSearch = override.for === search ? override.ids : EMPTY;

  const expanded = useMemo<ReadonlySet<string>>(() => {
    if (!search) return base;
    const out = new Set(base);
    for (const id of search.ancestors) out.add(id);
    for (const id of collapsedDuringSearch) out.delete(id);
    return out;
  }, [base, search, collapsedDuringSearch]);

  // Keep the latest value in a ref so `toggle` stays referentially stable
  // and memoized rows do not re-render every time something expands.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const toggle = useCallback(
    (id: string) => {
      const isOpen = expandedRef.current.has(id);
      setBase((prev) => {
        const next = new Set(prev);
        if (isOpen) next.delete(id);
        else next.add(id);
        return next;
      });
      if (search) {
        setOverride((prev) => {
          const ids = new Set<string>(prev.for === search ? prev.ids : []);
          if (isOpen) ids.add(id);
          else ids.delete(id);
          return { for: search, ids };
        });
      }
    },
    [search],
  );

  const expandAll = useCallback(() => {
    setBase(new Set(collectFolderIds(roots)));
    setOverride({ for: search, ids: EMPTY });
  }, [roots, search]);

  const collapseAll = useCallback(() => {
    setBase(new Set());
    setOverride({ for: search, ids: new Set(search ? search.ancestors : []) });
  }, [search]);

  return { expanded, toggle, expandAll, collapseAll };
}
