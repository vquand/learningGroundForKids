import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

interface ScrollCheckpointsResult {
  coverage: number;
  isCovered: boolean;
}

export function useScrollCheckpoints(
  containerRef: RefObject<HTMLElement | null>,
  enabled = true,
): ScrollCheckpointsResult {
  const [coverage, setCoverage] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    setCoverage(0);
    if (!container || !enabled) return;
    const checkpoints = new Set<Element>();
    const covered = new Set<Element>();
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const updateCoverage = () => setCoverage(checkpoints.size ? covered.size / checkpoints.size : 1);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target;
          if (!checkpoints.has(el)) continue;
          // A long recipe/description may be taller than the viewport: dwell
          // on a visible section rather than requiring half the entire block.
          if (entry.isIntersecting) {
            // Start 3-second timer if not already observed
            if (!covered.has(el) && !timers.has(el)) {
              const timer = setTimeout(() => {
                covered.add(el);
                timers.delete(el);
                updateCoverage();
              }, 3000);
              timers.set(el, timer);
            }
          } else {
            // Clear timer if element leaves viewport before 3s
            const timer = timers.get(el);
            if (timer !== undefined) {
              clearTimeout(timer);
              timers.delete(el);
            }
          }
        }
      },
      { threshold: 0 }
    );

    const syncCheckpoints = () => {
      const current = new Set(container.querySelectorAll('[data-checkpoint]'));
      for (const el of checkpoints) {
        if (current.has(el)) continue;
        observer.unobserve(el);
        clearTimeout(timers.get(el));
        timers.delete(el);
        covered.delete(el);
        checkpoints.delete(el);
      }
      for (const el of current) {
        if (checkpoints.has(el)) continue;
        checkpoints.add(el);
        observer.observe(el);
      }
      updateCoverage();
    };
    const mutations = new MutationObserver(syncCheckpoints);
    mutations.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-checkpoint'] });
    syncCheckpoints();

    return () => {
      observer.disconnect();
      mutations.disconnect();
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, [containerRef, enabled]);

  return {
    coverage,
    isCovered: enabled && coverage >= 0.8,
  };
}
