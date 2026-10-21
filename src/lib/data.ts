import type { TreeNode } from './types';

const OWNERS = ['alice', 'bala', 'chitra', 'dev', 'esha', 'farid', 'gita', 'hari'] as const;
const FOLDER_WORDS = ['reports', 'assets', 'archive', 'builds', 'configs', 'designs', 'exports', 'logs', 'shared', 'tests'] as const;
const FILE_WORDS = ['summary', 'invoice', 'notes', 'backup', 'schema', 'readme', 'changelog', 'metrics', 'draft', 'profile'] as const;
const EXTENSIONS = ['ts', 'tsx', 'json', 'md', 'csv', 'png', 'pdf', 'log'] as const;

/** Small, fast, seedable PRNG so generated data is identical on every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a deterministic tree with exactly `total` nodes.
 * Folders are created breadth-first so the tree is wide and realistic,
 * and no folder is nested deeper than `maxDepth` levels.
 */
export function generateTree(total: number, seed = 42, maxDepth = 6): TreeNode[] {
  if (total <= 0) return [];

  const rand = mulberry32(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
  const baseTime = Date.UTC(2024, 0, 1);
  let nextId = 0;

  const make = (kind: 'folder' | 'file'): TreeNode => {
    const num = nextId++;
    const id = `n${num}`;
    const checksum =
      Math.floor(rand() * 0xffffffff).toString(16).padStart(8, '0') +
      Math.floor(rand() * 0xffff).toString(16).padStart(4, '0');
    return {
      id,
      name: kind === 'folder' ? `${pick(FOLDER_WORDS)}-${num}` : `${pick(FILE_WORDS)}-${num}.${pick(EXTENSIONS)}`,
      kind,
      size: kind === 'folder' ? 0 : Math.floor(rand() * 5_000_000) + 100,
      owner: pick(OWNERS),
      modified: baseTime + Math.floor(rand() * 600 * 86_400_000),
      checksum,
      children: [],
    };
  };

  const roots: TreeNode[] = [];
  const queue: { node: TreeNode; depth: number }[] = [];
  let count = 0;

  const addRoot = () => {
    const node = make('folder');
    roots.push(node);
    queue.push({ node, depth: 0 });
    count++;
  };

  const rootCount = Math.min(total, Math.max(5, Math.ceil(total / 5000)));
  for (let i = 0; i < rootCount; i++) addRoot();

  let head = 0;
  while (count < total) {
    if (head >= queue.length) {
      addRoot();
      continue;
    }
    const { node, depth } = queue[head++];
    const childCount = 3 + Math.floor(rand() * 10);
    for (let i = 0; i < childCount && count < total; i++) {
      const isFolder = depth + 1 < maxDepth && rand() < 0.35;
      const child = make(isFolder ? 'folder' : 'file');
      node.children.push(child);
      count++;
      if (isFolder) queue.push({ node: child, depth: depth + 1 });
    }
  }

  return roots;
}

/** Counts every node in the forest without recursion. */
export function countNodes(roots: readonly TreeNode[]): number {
  let count = 0;
  const stack: TreeNode[] = [...roots];
  while (stack.length) {
    const node = stack.pop()!;
    count++;
    for (const child of node.children) stack.push(child);
  }
  return count;
}

/** Ids of every node that has children. Used by "Expand all". */
export function collectFolderIds(roots: readonly TreeNode[]): string[] {
  const ids: string[] = [];
  const stack: TreeNode[] = [...roots];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.children.length > 0) {
      ids.push(node.id);
      for (const child of node.children) stack.push(child);
    }
  }
  return ids;
}
