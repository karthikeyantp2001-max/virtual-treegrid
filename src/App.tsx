import { useState } from 'react';
import { GridDemo } from './components/GridDemo';

const SIZES = [10_000, 100_000, 500_000] as const;

export function App() {
  const [size, setSize] = useState<number>(100_000);

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>Virtual TreeGrid</h1>
          <p className="lede">
            A tree grid in React and TypeScript that keeps only the rows you can see in the DOM, so it stays smooth on
            hundreds of thousands of rows. It has a frozen name column, search, and full keyboard support.
          </p>
        </div>
        <label className="field size-field">
          <span>Dataset size</span>
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s.toLocaleString('en-US')} nodes
              </option>
            ))}
          </select>
        </label>
      </header>

      {/* key remounts the demo so expansion, search and focus reset for the new dataset */}
      <GridDemo key={size} size={size} />
    </main>
  );
}
