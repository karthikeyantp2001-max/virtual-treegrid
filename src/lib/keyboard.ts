import type { FlatRow } from './types';

export type KeyAction =
  | { type: 'focus'; index: number }
  | { type: 'toggle'; id: string }
  | { type: 'none' };

const NONE: KeyAction = { type: 'none' };
const focus = (index: number): KeyAction => ({ type: 'focus', index });

/**
 * Keyboard behaviour for a tree grid, following the WAI-ARIA treegrid pattern.
 * Pure function: given the key and the current state, say what should happen.
 *
 * - Arrow Up/Down, Home/End, Page Up/Down move focus between rows
 * - Arrow Right expands a collapsed row, or moves to its first child when already open
 * - Arrow Left collapses an open row, or moves to the parent row
 * - Enter / Space toggle a row that has children
 */
export function keyboardAction(
  key: string,
  rows: readonly FlatRow[],
  focusedIndex: number,
  expanded: ReadonlySet<string>,
  pageSize: number,
): KeyAction {
  if (rows.length === 0) return NONE;
  const last = rows.length - 1;

  // Nothing focused yet: any navigation key lands on a sensible first row.
  if (focusedIndex < 0) {
    switch (key) {
      case 'End':
      case 'ArrowUp':
      case 'PageUp':
        return focus(key === 'End' ? last : 0);
      case 'ArrowDown':
      case 'ArrowRight':
      case 'Home':
      case 'PageDown':
        return focus(0);
      default:
        return NONE;
    }
  }

  const row = rows[focusedIndex];
  const id = row.node.id;

  switch (key) {
    case 'ArrowDown':
      return focus(Math.min(focusedIndex + 1, last));
    case 'ArrowUp':
      return focus(Math.max(focusedIndex - 1, 0));
    case 'Home':
      return focus(0);
    case 'End':
      return focus(last);
    case 'PageDown':
      return focus(Math.min(focusedIndex + pageSize, last));
    case 'PageUp':
      return focus(Math.max(focusedIndex - pageSize, 0));
    case 'ArrowRight':
      if (!row.hasChildren) return NONE;
      if (!expanded.has(id)) return { type: 'toggle', id };
      return rows[focusedIndex + 1]?.parentId === id ? focus(focusedIndex + 1) : NONE;
    case 'ArrowLeft':
      if (row.hasChildren && expanded.has(id)) return { type: 'toggle', id };
      if (row.parentId !== null) {
        for (let i = focusedIndex - 1; i >= 0; i--) {
          if (rows[i].node.id === row.parentId) return focus(i);
        }
      }
      return NONE;
    case 'Enter':
    case ' ':
      return row.hasChildren ? { type: 'toggle', id } : NONE;
    default:
      return NONE;
  }
}
