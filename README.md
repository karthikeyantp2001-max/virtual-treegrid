# Virtual TreeGrid

A tree grid in **React + TypeScript** that renders only the rows you can see, so it stays smooth on hundreds of thousands of rows. No UI or grid libraries: the virtualization, tree flattening, search and keyboard handling are all written from scratch.

**Live demo:** https://virtual-treegrid.vercel.app/

## What it does

- **Row virtualization.** About 25 rows are in the DOM whether the tree has 10,000 or 500,000 nodes. The scroll area keeps its full height, so the scrollbar behaves normally.
- **Tree behaviour.** Expand and collapse, expand all, collapse all, indentation by depth.
- **Frozen column.** The Name column stays pinned while you scroll horizontally (CSS `position: sticky`).
- **Search.** Matches name or owner, opens every branch that contains a match, and still lets you collapse them.
- **Keyboard and accessibility.** Follows the WAI-ARIA treegrid pattern: `role="treegrid"`, `aria-level`, `aria-expanded`, `aria-selected`, `aria-rowcount`, and `aria-activedescendant` so focus survives rows being recycled.
- **Live metrics panel.** Nodes, rows visible, DOM rows rendered, build / flatten / search time, and an FPS meter.
- **Tests.** Unit tests for all the logic and component tests for rendering, scrolling and keyboard behaviour.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + component tests (Vitest, Testing Library)
npm run typecheck  # strict TypeScript
npm run build      # production build in dist/
npm run bench      # times the data work for 10k / 100k / 500k nodes
```

## How it works

```
generateTree()  ──►  searchTree()  ──►  useExpansion()  ──►  flattenVisible()  ──►  <TreeGrid rows={...}>
 seeded data        matches +           which rows are        tree → flat list        computeRange() picks
                    ancestors           open                  of visible rows         the ~25 rows to render
```

| File | Job |
| --- | --- |
| `src/lib/data.ts` | Seeded, deterministic tree generator (exactly N nodes) |
| `src/lib/flatten.ts` | Turns the tree plus the expanded set into a flat list of visible rows. Iterative, so depth cannot overflow the stack |
| `src/lib/search.ts` | Finds matches and every ancestor that must be opened |
| `src/lib/virtual.ts` | `computeRange` (which rows to render) and `scrollTopToReveal` |
| `src/lib/keyboard.ts` | Pure function: key + state in, action out (move focus, toggle, nothing) |
| `src/hooks/useExpansion.ts` | Expanded-state with search-aware behaviour |
| `src/components/TreeGrid.tsx` | The grid itself |
| `src/components/GridDemo.tsx` | Wires data, search, expansion and the grid together |

### The virtualization idea

1. The tree is flattened into one array of visible rows, in display order.
2. A tall spacer gives the scroll area the height of **all** rows: `rows × rowHeight`.
3. On scroll, `first = floor(scrollTop / rowHeight)`. Only rows `first - overscan … first + visibleCount + overscan` are rendered.
4. Each rendered row is positioned absolutely at `index × rowHeight`, so it sits exactly where it would in a full list.
5. Rows are `React.memo`'d and keyed by node id, so a scroll step only mounts and unmounts the rows entering and leaving the window.

### Decisions worth knowing

- **Flatten, then virtualize.** Expand and collapse change a flat array, so the virtualizer never has to know about trees.
- **Pure logic in `src/lib`.** Anything testable without React is a plain function: easy to test, easy to benchmark, no hidden state.
- **`aria-activedescendant` instead of moving DOM focus.** The grid container keeps focus and points at the active row. A row that scrolls out of the DOM cannot steal focus.
- **No scroll throttling.** Browsers already fire scroll events at most once per frame, and the per-event work is tiny.

## Measure it yourself (do this before putting numbers on your resume)

The numbers you quote should come from your own machine. Record them in `RESULTS.md`.

1. **Data work:** run `npm run bench` and copy the table.
2. **Rendering:** run `npm run build && npm run preview`, open Chrome, choose **500,000 nodes**, click **Expand all**.
3. Open DevTools → **Performance**, click Record, scroll the grid quickly for 5 seconds, stop. Note the FPS and any long tasks. The in-app FPS meter is only an approximation.
4. Open DevTools → **Elements** and count the rows under the grid. This is the "DOM rows" number.
5. For a before and after comparison, temporarily render every row (set `range.start = 0` and `range.end = rows.length` in `TreeGrid.tsx`) with 10,000 nodes and record the same measurements. Then revert.

## Deploy

**GitHub Pages:** push to a repo on `main`, then in the repo go to Settings → Pages → Source → **GitHub Actions**. The workflow in `.github/workflows/deploy.yml` tests, builds and publishes.

**Vercel or Netlify:** import the repo. Build command `npm run build`, output directory `dist`.

## Known limits and next steps

- Building a 500k-node tree and searching it run on the main thread and block the UI for a moment. Moving search into a Web Worker, or generating nodes lazily, would fix that.
- Row height is fixed. Variable-height rows need a measured-offsets index.
- Possible features: column sorting, column resize and reorder, lazy loading children from a server (RemoteData style), row selection with checkboxes, horizontal virtualization for very wide grids.

## Stack

React 18, TypeScript (strict), Vite, Vitest, Testing Library. No runtime dependencies besides React.
