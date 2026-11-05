import { useLayoutEffect, useRef, type ReactNode } from 'react';
import './CalendarScrollPanel.css';
import { observeCalendarScrollPanel } from '../../lib/calendarScrollPanel';

/** Bounded native scrolling keeps touch, wheel and keyboard direction consistent across browsers. */
export function CalendarScrollPanel({ label, resetKey, revealKey, revealToken, children }: {
  label: string;
  resetKey?: string;
  revealKey?: string | null;
  /** A new token reveals even when the same favorite is saved again. */
  revealToken?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef(revealKey);
  revealRef.current = revealKey;
  const scheduleRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    const panel = ref.current, content = contentRef.current;
    if (!panel || !content) return;
    const observer = observeCalendarScrollPanel(panel, content, () => revealRef.current);
    scheduleRef.current = observer.schedule;
    return () => { observer.cleanup(); scheduleRef.current = null; };
  }, []);
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [resetKey]);
  // Wait until the row and any inline editor sections have been laid out.
  useLayoutEffect(() => { scheduleRef.current?.(); }, [revealKey, revealToken]);
  return <div className="calendar-scroll-frame">
    <div ref={ref} className="calendar-scroll-panel" role="region" aria-label={label} tabIndex={0}>
      <div ref={contentRef} className="calendar-scroll-content">{children}</div>
    </div>
  </div>;
}
