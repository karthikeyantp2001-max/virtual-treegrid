import { describe, expect, it } from 'vitest';
import { collectFolderIds, countNodes, generateTree } from './data';
import { flattenVisible } from './flatten';
import { keyboardAction } from './keyboard';
import { searchTree } from './search';
import type { FlatRow, TreeNode } from './types';
import { computeRange, scrollTopToReveal } from './virtual';

function node(id: string, children: TreeNode[] = [], name = id, owner = 'alice'): TreeNode {
  return {
    id,
    name,
    kind: children.length ? 'folder' : 'file',
    size: 1,
    owner,
    modified: 0,
    checksum: '0',
    children,
  };
}

/**
 *  a
 *  ├─ a1
 *  │   └─ a1x
 *  └─ a2
 *  b
 */
const sample = (): TreeNode[] => [node('a', [node('a1', [node('a1x')]), node('a2')]), node('b')];

describe('generateTree', () => {
  it.each([1, 7, 1000, 12_345])('creates exactly %i nodes', (n) => {
    expect(countNodes(generateTree(n))).toBe(n);
  });

  it('is deterministic for a seed and different across seeds', () => {
    const a = JSON.stringify(generateTree(500, 1));
    expect(JSON.stringify(generateTree(500, 1))).toBe(a);
    expect(JSON.stringify(generateTree(500, 2))).not.toBe(a);
  });

  it('gives every node a unique id', () => {
    const ids = new Set<string>();
    const stack = [...generateTree(5000)];
    while (stack.length) {
      const n = stack.pop()!;
      expect(ids.has(n.id)).toBe(false);
      ids.add(n.id);
      stack.push(...n.children);
    }
    expect(ids.size).toBe(5000);
  });

  it('never nests deeper than maxDepth', () => {
    const maxDepth = 4;
    let deepest = 0;
    const stack = generateTree(20_000, 3, maxDepth).map((n) => ({ n, d: 0 }));
    while (stack.length) {
      const { n, d } = stack.pop()!;
      deepest = Math.max(deepest, d);
      for (const c of n.children) stack.push({ n: c, d: d + 1 });
    }
    expect(deepest).toBeLessThanOrEqual(maxDepth);
  });

  it('returns an empty forest for a non-positive total', () => {
    expect(generateTree(0)).toEqual([]);
  });

  it('collectFolderIds returns only nodes with children', () => {
    expect(collectFolderIds(sample()).sort()).toEqual(['a', 'a1']);
  });
});

describe('flattenVisible', () => {
  it('shows only roots when nothing is expanded', () => {
    const rows = flattenVisible(sample(), new Set());
    expect(rows.map((r) => r.node.id)).toEqual(['a', 'b']);
  });

  it('lists children right after their parent, in order, with depth', () => {
    const rows = flattenVisible(sample(), new Set(['a', 'a1']));
    expect(rows.map((r) => [r.node.id, r.depth])).toEqual([
      ['a', 0],
      ['a1', 1],
      ['a1x', 2],
      ['a2', 1],
      ['b', 0],
    ]);
  });

  it('hides grandchildren when only the parent is open', () => {
    const rows = flattenVisible(sample(), new Set(['a']));
    expect(rows.map((r) => r.node.id)).toEqual(['a', 'a1', 'a2', 'b']);
  });

  it('records parent ids and hasChildren', () => {
    const rows = flattenVisible(sample(), new Set(['a']));
    expect(rows.find((r) => r.node.id === 'a1')).toMatchObject({ parentId: 'a', hasChildren: true });
    expect(rows.find((r) => r.node.id === 'a2')).toMatchObject({ parentId: 'a', hasChildren: false });
  });

  it('respects a visible filter', () => {
    const rows = flattenVisible(sample(), new Set(['a', 'a1']), new Set(['a', 'a1', 'a1x']));
    expect(rows.map((r) => r.node.id)).toEqual(['a', 'a1', 'a1x']);
  });

  it('handles a very deep tree without overflowing the stack', () => {
    let leaf = node('d0');
    const expanded = new Set<string>();
    for (let i = 1; i <= 20_000; i++) {
      leaf = node(`d${i}`, [leaf]);
      expanded.add(`d${i}`);
    }
    expect(flattenVisible([leaf], expanded)).toHaveLength(20_001);
  });
});

describe('searchTree', () => {
  const tree = () => [
    node('a', [node('a1', [node('a1x', [], 'invoice-1.csv')]), node('a2', [], 'notes.md', 'esha')]),
    node('b', [], 'readme.md'),
  ];

  it('returns null for a blank query', () => {
    expect(searchTree(tree(), '   ')).toBeNull();
  });

  it('finds matches case-insensitively and collects ancestors', () => {
    const result = searchTree(tree(), 'INVOICE')!;
    expect([...result.matches]).toEqual(['a1x']);
    expect([...result.ancestors].sort()).toEqual(['a', 'a1']);
    expect([...result.visible].sort()).toEqual(['a', 'a1', 'a1x']);
  });

  it('matches on owner too', () => {
    expect([...searchTree(tree(), 'esha')!.matches]).toEqual(['a2']);
  });

  it('returns empty sets when nothing matches', () => {
    const result = searchTree(tree(), 'zzz')!;
    expect(result.visible.size).toBe(0);
  });

  it('shows a filtered, fully opened tree when combined with flattenVisible', () => {
    const roots = tree();
    const result = searchTree(roots, 'invoice')!;
    const rows = flattenVisible(roots, result.ancestors, result.visible);
    expect(rows.map((r) => r.node.id)).toEqual(['a', 'a1', 'a1x']);
  });
});

describe('computeRange', () => {
  it('renders from the top with overscan below', () => {
    expect(computeRange(0, 320, 32, 1000, 5)).toEqual({ start: 0, end: 16, totalHeight: 32_000 });
  });

  it('moves the window as the user scrolls', () => {
    const { start, end } = computeRange(3200, 320, 32, 1000, 5);
    expect(start).toBe(95);
    expect(end).toBe(116);
  });

  it('never goes past the last row', () => {
    const { start, end } = computeRange(10_000_000, 320, 32, 100, 5);
    expect(end).toBe(100);
    expect(start).toBeGreaterThanOrEqual(0);
  });

  it('handles an empty list', () => {
    expect(computeRange(500, 320, 32, 0)).toEqual({ start: 0, end: 0, totalHeight: 0 });
  });

  it('renders a bounded number of rows however large the list is', () => {
    const { start, end } = computeRange(2_000_000, 524, 32, 500_000, 6);
    expect(end - start).toBeLessThan(40);
  });
});

describe('scrollTopToReveal', () => {
  it('does nothing when the row is already visible', () => {
    expect(scrollTopToReveal(5, 32, 0, 320)).toBe(0);
  });

  it('scrolls up to a row above the viewport', () => {
    expect(scrollTopToReveal(2, 32, 320, 320)).toBe(64);
  });

  it('scrolls down so a row below the viewport ends at the bottom edge', () => {
    expect(scrollTopToReveal(20, 32, 0, 320)).toBe(20 * 32 + 32 - 320);
  });
});

describe('keyboardAction', () => {
  const rowsFor = (expanded: string[]): FlatRow[] => flattenVisible(sample(), new Set(expanded));
  const run = (key: string, index: number, expanded: string[] = []) =>
    keyboardAction(key, rowsFor(expanded), index, new Set(expanded), 3);

  it('moves focus down and up, clamped at the ends', () => {
    expect(run('ArrowDown', 0)).toEqual({ type: 'focus', index: 1 });
    expect(run('ArrowDown', 1)).toEqual({ type: 'focus', index: 1 });
    expect(run('ArrowUp', 0)).toEqual({ type: 'focus', index: 0 });
  });

  it('supports Home, End and paging', () => {
    const open = ['a', 'a1'];
    expect(run('Home', 3, open)).toEqual({ type: 'focus', index: 0 });
    expect(run('End', 0, open)).toEqual({ type: 'focus', index: 4 });
    expect(run('PageDown', 0, open)).toEqual({ type: 'focus', index: 3 });
    expect(run('PageUp', 4, open)).toEqual({ type: 'focus', index: 1 });
  });

  it('expands a collapsed row with ArrowRight', () => {
    expect(run('ArrowRight', 0)).toEqual({ type: 'toggle', id: 'a' });
  });

  it('moves to the first child with ArrowRight on an open row', () => {
    expect(run('ArrowRight', 0, ['a'])).toEqual({ type: 'focus', index: 1 });
  });

  it('does nothing with ArrowRight on a leaf', () => {
    expect(run('ArrowRight', 2, ['a'])).toEqual({ type: 'none' });
  });

  it('collapses an open row with ArrowLeft', () => {
    expect(run('ArrowLeft', 0, ['a'])).toEqual({ type: 'toggle', id: 'a' });
  });

  it('moves to the parent with ArrowLeft on a leaf or closed row', () => {
    expect(run('ArrowLeft', 2, ['a'])).toEqual({ type: 'focus', index: 0 });
    expect(run('ArrowLeft', 1, ['a'])).toEqual({ type: 'focus', index: 0 });
  });

  it('toggles with Enter and Space only when the row has children', () => {
    expect(run('Enter', 0)).toEqual({ type: 'toggle', id: 'a' });
    expect(run(' ', 1, ['a'])).toEqual({ type: 'toggle', id: 'a1' });
    expect(run('Enter', 2, ['a'])).toEqual({ type: 'none' });
  });

  it('lands on the first row when nothing is focused yet', () => {
    expect(run('ArrowDown', -1)).toEqual({ type: 'focus', index: 0 });
    expect(run('End', -1)).toEqual({ type: 'focus', index: 1 });
    expect(run('x', -1)).toEqual({ type: 'none' });
  });

  it('ignores unrelated keys and empty grids', () => {
    expect(run('a', 0)).toEqual({ type: 'none' });
    expect(keyboardAction('ArrowDown', [], -1, new Set(), 3)).toEqual({ type: 'none' });
  });
});
