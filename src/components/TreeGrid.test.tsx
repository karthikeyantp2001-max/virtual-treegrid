import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { useMemo, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useExpansion } from '../hooks/useExpansion';
import { generateTree } from '../lib/data';
import { flattenVisible } from '../lib/flatten';
import { searchTree } from '../lib/search';
import { TreeGrid } from './TreeGrid';

const ROW_HEIGHT = 32;

function Harness({ total = 10_000 }: { total?: number }) {
  const roots = useMemo(() => generateTree(total, 7), [total]);
  const { expanded, toggle, expandAll } = useExpansion(roots, null);
  const rows = useMemo(() => flattenVisible(roots, expanded, null), [roots, expanded]);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  return (
    <>
      <button onClick={expandAll}>expand all</button>
      <output data-testid="row-count">{rows.length}</output>
      <TreeGrid rows={rows} expanded={expanded} focusedId={focusedId} onFocusChange={setFocusedId} onToggle={toggle} />
    </>
  );
}

const bodyRows = (grid: HTMLElement) =>
  within(grid)
    .getAllByRole('row')
    .filter((r) => r.id.startsWith('row-'));

const rowIndexes = (grid: HTMLElement) => bodyRows(grid).map((r) => Number(r.getAttribute('aria-rowindex')));

describe('TreeGrid', () => {
  it('renders only a small window of rows for a large dataset', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('expand all'));

    const total = Number(screen.getByTestId('row-count').textContent);
    expect(total).toBe(10_000);

    const grid = screen.getByRole('treegrid');
    expect(grid).toHaveAttribute('aria-rowcount', String(total + 1));
    const rendered = bodyRows(grid).length;
    expect(rendered).toBeGreaterThan(10);
    expect(rendered).toBeLessThan(40);
  });

  it('renders a different window after scrolling', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('expand all'));
    const grid = screen.getByRole('treegrid');

    fireEvent.scroll(grid, { target: { scrollTop: ROW_HEIGHT * 5000 } });

    const indexes = rowIndexes(grid);
    expect(Math.min(...indexes)).toBeGreaterThan(4900);
    expect(Math.max(...indexes)).toBeLessThan(5100);
  });

  it('moves focus with the arrow keys and exposes it through aria-activedescendant', () => {
    render(<Harness />);
    const grid = screen.getByRole('treegrid');

    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    const first = bodyRows(grid)[0];
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(grid).toHaveAttribute('aria-activedescendant', first.id);

    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(first).toHaveAttribute('aria-selected', 'false');
    expect(bodyRows(grid)[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('collapses and expands the focused row with ArrowLeft and ArrowRight', () => {
    render(<Harness />);
    const grid = screen.getByRole('treegrid');
    const before = Number(screen.getByTestId('row-count').textContent);

    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    const first = bodyRows(grid)[0];
    expect(first).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    expect(bodyRows(grid)[0]).toHaveAttribute('aria-expanded', 'false');
    expect(Number(screen.getByTestId('row-count').textContent)).toBeLessThan(before);

    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(bodyRows(grid)[0]).toHaveAttribute('aria-expanded', 'true');
    expect(Number(screen.getByTestId('row-count').textContent)).toBe(before);
  });

  it('jumps to the last row with End and scrolls it into view', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('expand all'));
    const grid = screen.getByRole('treegrid');

    fireEvent.keyDown(grid, { key: 'End' });

    const selected = bodyRows(grid).find((r) => r.getAttribute('aria-selected') === 'true');
    expect(selected).toBeDefined();
    expect(selected).toHaveAttribute('aria-rowindex', '10001');
    expect(grid.scrollTop).toBeGreaterThan(0);
  });

  it('toggles a row by clicking its chevron', () => {
    render(<Harness />);
    const grid = screen.getByRole('treegrid');
    const first = bodyRows(grid)[0];
    expect(first).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(within(first).getByRole('button', { name: 'Collapse' }));
    expect(bodyRows(grid)[0]).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows an empty state when there are no rows', () => {
    render(
      <TreeGrid rows={[]} expanded={new Set()} focusedId={null} onFocusChange={() => {}} onToggle={() => {}} />,
    );
    expect(screen.getByText('No matching rows')).toBeInTheDocument();
  });
});

describe('useExpansion', () => {
  const roots = generateTree(300, 5);

  it('starts with only the root level expanded', () => {
    const { result } = renderHook(() => useExpansion(roots, null));
    expect([...result.current.expanded].sort()).toEqual(roots.map((r) => r.id).sort());
  });

  it('toggles a node open and closed', () => {
    const { result } = renderHook(() => useExpansion(roots, null));
    const id = roots[0].id;
    act(() => result.current.toggle(id));
    expect(result.current.expanded.has(id)).toBe(false);
    act(() => result.current.toggle(id));
    expect(result.current.expanded.has(id)).toBe(true);
  });

  it('collapse all and expand all work', () => {
    const { result } = renderHook(() => useExpansion(roots, null));
    act(() => result.current.collapseAll());
    expect(result.current.expanded.size).toBe(0);
    act(() => result.current.expandAll());
    expect(result.current.expanded.size).toBeGreaterThan(roots.length);
  });

  it('forces ancestors of search matches open, but lets the user collapse them', () => {
    // Pick a deep leaf so it has at least two ancestors.
    const search = searchTree(roots, roots[0].children[0].name)!;
    const ancestor = [...search.ancestors][0];

    const { result } = renderHook(({ s }) => useExpansion(roots, s), { initialProps: { s: search } });
    for (const id of search.ancestors) expect(result.current.expanded.has(id)).toBe(true);

    act(() => result.current.toggle(ancestor));
    expect(result.current.expanded.has(ancestor)).toBe(false);
  });
});
