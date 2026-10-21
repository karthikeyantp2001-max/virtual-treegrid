export interface TreeNode {
  id: string;
  name: string;
  kind: 'folder' | 'file';
  /** Size in bytes. Folders use 0 and show a dash in the UI. */
  size: number;
  owner: string;
  /** Epoch milliseconds. */
  modified: number;
  checksum: string;
  /** Always an array. Files have an empty array. */
  children: TreeNode[];
}

/** One visible row after the tree has been flattened into display order. */
export interface FlatRow {
  node: TreeNode;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
}

export type ColumnKey = 'name' | 'kind' | 'size' | 'owner' | 'modified' | 'items' | 'checksum';

export interface Column {
  key: ColumnKey;
  title: string;
  width: number;
  align?: 'left' | 'right';
  /** Frozen columns stay pinned to the left while the grid scrolls horizontally. */
  frozen?: boolean;
}
