import type { TreeNode } from './types';

export interface SearchResult {
  /** Nodes whose name or owner contains the query. */
  matches: Set<string>;
  /** Every ancestor of a match. These must be expanded to reveal the matches. */
  ancestors: Set<string>;
  /** matches + ancestors: the only nodes shown while searching. */
  visible: Set<string>;
}

/** Case-insensitive search over name and owner. Returns null for a blank query. */
export function searchTree(roots: readonly TreeNode[], query: string): SearchResult | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const parentOf = new Map<string, string | null>();
  const matches = new Set<string>();
  const stack: { node: TreeNode; parentId: string | null }[] = [];
  for (const root of roots) stack.push({ node: root, parentId: null });

  while (stack.length) {
    const { node, parentId } = stack.pop()!;
    parentOf.set(node.id, parentId);
    if (node.name.toLowerCase().includes(q) || node.owner.includes(q)) matches.add(node.id);
    for (const child of node.children) stack.push({ node: child, parentId: node.id });
  }

  const ancestors = new Set<string>();
  for (const id of matches) {
    let parent = parentOf.get(id) ?? null;
    // Stop as soon as we reach an ancestor we already walked: its own ancestors are already in the set.
    while (parent !== null && !ancestors.has(parent)) {
      ancestors.add(parent);
      parent = parentOf.get(parent) ?? null;
    }
  }

  const visible = new Set<string>(matches);
  for (const id of ancestors) visible.add(id);

  return { matches, ancestors, visible };
}
