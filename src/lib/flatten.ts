import type { FlatRow, TreeNode } from './types';

/**
 * Turns the tree into the flat, ordered list of rows that are currently visible.
 *
 * Only expanded nodes contribute their children, so collapsing a branch removes
 * its whole subtree from the list. Uses an explicit stack (no recursion) so very
 * large or deep trees cannot overflow the call stack.
 *
 * When `visible` is given (during search), nodes outside that set are skipped.
 */
export function flattenVisible(
  roots: readonly TreeNode[],
  expanded: ReadonlySet<string>,
  visible: ReadonlySet<string> | null = null,
): FlatRow[] {
  const rows: FlatRow[] = [];
  const stack: { node: TreeNode; depth: number; parentId: string | null }[] = [];

  for (let i = roots.length - 1; i >= 0; i--) {
    stack.push({ node: roots[i], depth: 0, parentId: null });
  }

  while (stack.length) {
    const { node, depth, parentId } = stack.pop()!;
    if (visible && !visible.has(node.id)) continue;

    const hasChildren = node.children.length > 0;
    rows.push({ node, depth, parentId, hasChildren });

    if (hasChildren && expanded.has(node.id)) {
      // Push in reverse so children pop in their original order.
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], depth: depth + 1, parentId: node.id });
      }
    }
  }

  return rows;
}
