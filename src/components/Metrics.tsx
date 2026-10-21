import type { MutableRefObject } from 'react';
import { useScrollFps } from '../hooks/useScrollFps';

interface MetricsProps {
  totalNodes: number;
  visibleRows: number;
  renderedRows: number;
  buildMs: number;
  flattenMs: number;
  searchMs: number | null;
  lastScrollRef: MutableRefObject<number>;
}

const fmt = new Intl.NumberFormat('en-US');
const ms = (value: number) => `${value < 10 ? value.toFixed(1) : Math.round(value)} ms`;

export function Metrics({
  totalNodes,
  visibleRows,
  renderedRows,
  buildMs,
  flattenMs,
  searchMs,
  lastScrollRef,
}: MetricsProps) {
  const { fps, worst, resetWorst } = useScrollFps(lastScrollRef);

  const items: { label: string; value: string; hint?: string }[] = [
    { label: 'Nodes in tree', value: fmt.format(totalNodes) },
    { label: 'Rows visible', value: fmt.format(visibleRows), hint: 'after expand / filter' },
    { label: 'DOM rows rendered', value: fmt.format(renderedRows), hint: 'the only rows in the DOM' },
    { label: 'Tree build', value: ms(buildMs), hint: 'first render only' },
    { label: 'Flatten', value: ms(flattenMs), hint: 'last expand / collapse' },
    { label: 'Search', value: searchMs === null ? '—' : ms(searchMs) },
    { label: 'FPS', value: fps ? String(fps) : '…' },
    { label: 'Worst FPS while scrolling', value: worst === null ? '—' : String(worst) },
  ];

  return (
    <section className="metrics" aria-label="Performance metrics">
      <dl className="metrics-grid">
        {items.map((item) => (
          <div key={item.label} className="metric">
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
            {item.hint && <small>{item.hint}</small>}
          </div>
        ))}
      </dl>
      <button type="button" className="link-btn" onClick={resetWorst}>
        Reset worst FPS
      </button>
    </section>
  );
}
