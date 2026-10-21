/**
 * Measures the pure data work behind the grid (no DOM, no React).
 *
 *   npm run bench
 *
 * Results depend on your machine, so record your own numbers in RESULTS.md.
 * Rendering cost is measured separately in the browser (see README).
 */
import { collectFolderIds, generateTree } from '../src/lib/data';
import { flattenVisible } from '../src/lib/flatten';
import { searchTree } from '../src/lib/search';
import { computeRange } from '../src/lib/virtual';

const SIZES = [10_000, 100_000, 500_000];
const RUNS = 5;

function time<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function medianMs(fn: () => unknown): number {
  fn(); // warm up
  return median(Array.from({ length: RUNS }, () => time(fn).ms));
}

const fmt = (ms: number) => `${ms.toFixed(1)} ms`;

const table: Record<string, Record<string, string>> = {};

for (const size of SIZES) {
  const generated = time(() => generateTree(size));
  const roots = generated.value;
  const allOpen = new Set(collectFolderIds(roots));
  const rootsOpen = new Set(roots.map((r) => r.id));

  const rowsAllOpen = flattenVisible(roots, allOpen).length;

  // computeRange runs on every scroll event, so measure it per call.
  const CALLS = 1_000_000;
  const rangeTotal = time(() => {
    let sink = 0;
    for (let i = 0; i < CALLS; i++) sink += computeRange(i * 7, 524, 32, rowsAllOpen).end;
    return sink;
  }).ms;

  table[`${size.toLocaleString('en-US')} nodes`] = {
    'build tree': fmt(generated.ms),
    'flatten (roots open)': fmt(medianMs(() => flattenVisible(roots, rootsOpen))),
    'flatten (all open)': fmt(medianMs(() => flattenVisible(roots, allOpen))),
    'rows when all open': rowsAllOpen.toLocaleString('en-US'),
    'search "a" (many hits)': fmt(medianMs(() => searchTree(roots, 'a'))),
    'search "invoice-1" (few hits)': fmt(medianMs(() => searchTree(roots, 'invoice-1'))),
    'computeRange per call': `${((rangeTotal / CALLS) * 1e6).toFixed(0)} ns`,
  };
}

console.log(`\nMedian of ${RUNS} runs after a warm-up (build tree is a single run).\n`);
console.table(table);
