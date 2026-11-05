/** Observe one mounted list. Reveal requests are coalesced until the next layout frame. */
export function observeCalendarScrollPanel(panel: HTMLElement, content: HTMLElement, revealKey: () => string | null | undefined) {
  let frame = 0;
  let pending = true;
  const reveal = () => {
    frame = 0;
    const key = revealKey();
    if (!pending || !key) return;
    const item = Array.from(content.querySelectorAll<HTMLElement>('[data-scroll-key]')).find(element => element.dataset.scrollKey === key);
    if (!item) return;
    pending = false;
    const row = item.getBoundingClientRect(), viewport = panel.getBoundingClientRect();
    if (row.bottom > viewport.bottom) panel.scrollTop += row.bottom - viewport.bottom + 4;
    else if (row.top < viewport.top) panel.scrollTop -= viewport.top - row.top + 4;
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(reveal); };
  const resize = new ResizeObserver(schedule);
  resize.observe(panel); resize.observe(content);
  const mutation = new MutationObserver(schedule);
  mutation.observe(content, { childList: true, subtree: true, characterData: true });
  schedule();
  return {
    schedule() { pending = true; schedule(); },
    cleanup() { resize.disconnect(); mutation.disconnect(); cancelAnimationFrame(frame); },
  };
}
