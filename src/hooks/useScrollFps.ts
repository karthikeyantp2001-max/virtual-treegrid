import { useCallback, useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';

/**
 * Measures frames per second with requestAnimationFrame.
 *
 * `lastScrollRef` holds the timestamp (performance.now()) of the latest scroll
 * event. A half-second window counts as "while scrolling" if a scroll happened
 * in it, and the lowest such value is kept as `worst`. This is an approximation
 * meant for a quick visual check. Use Chrome DevTools Performance for real numbers.
 */
export function useScrollFps(lastScrollRef: MutableRefObject<number>) {
  const [fps, setFps] = useState(0);
  const [worst, setWorst] = useState<number | null>(null);

  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') return;

    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();
    let scrolledInWindow = false;

    const tick = (now: number) => {
      frames++;
      if (now - lastScrollRef.current < 100) scrolledInWindow = true;

      const elapsed = now - windowStart;
      if (elapsed >= 500) {
        const value = Math.round((frames * 1000) / elapsed);
        setFps(value);
        if (scrolledInWindow) setWorst((prev) => (prev === null ? value : Math.min(prev, value)));
        frames = 0;
        windowStart = now;
        scrolledInWindow = false;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lastScrollRef]);

  const resetWorst = useCallback(() => setWorst(null), []);

  return { fps, worst, resetWorst };
}
