import { setUiLanguage } from '../../src/lib/uiLanguage';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MapPage } from '../../src/pages/MapPage';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { useFilterStore } from '../../src/stores/filterStore';
import '../../src/app.css';

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const profile = { id: 'm2-child', name: 'Explorer', emoji: '🦊', color: '#2563eb', total_done: 0, badge_count: 0 };
const item = { id: 'm2-item', title: 'Explore fixture', category: 'food', latitude: 10, longitude: 105, icon_slug: 'food', quiz_required: false, has_quiz: false, start_year: 1500 };
const requests: string[] = [];
let delay = 0;
let completed = false;
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
  requests.push(url.pathname + url.search);
  if (url.pathname.endsWith('/profiles')) return Response.json([profile]);
  if (url.pathname.endsWith('/progress')) return Response.json({ done_item_ids: completed ? [item.id] : [], wip_item_ids: [] });
  if (url.pathname.endsWith('/leaves')) return Response.json({ version: 'a'.repeat(64), total: 2, items: [item, { ...item, id: 'm2-other' }], next_offset: null });
  if (url.pathname.endsWith('/views')) {
    const progress = url.searchParams.get('progress');
    if (!progress) throw new Error('Missing progress filter');
    await new Promise(resolve => setTimeout(resolve, delay));
    const visible = progress === 'all' || (progress === 'done') === completed;
    return Response.json({ version: 'a'.repeat(64), validator: 'b'.repeat(64), shared: false, total: visible ? 2 : 0,
      zoom: Number(url.searchParams.get('zoom')), next_offset: null, timeline: [{ year: 1500, count: 2 }],
      features: visible ? [{ id: 1, count: 2, latitude: 10, longitude: 105, bounds: [105, 10, 105, 10], expansionZoom: 19, item: null }] : [] });
  }
  return Response.json({});
};
useFamilyStore.setState({ familyId: 'm2-family', sessionGeneration: 1, isInitializing: false });
useProfileStore.getState().setActiveProfile(profile.id);
Object.assign(window, { m2: {
  requests,
  language: setUiLanguage,
  checkLayout: () => {
    const errors: string[] = [];
    const groups = ['.explore-progress-filter', '.explore-actions', '.explore-header', '.map-zoom-controls', '.explore-categories'];
    const controls = [...document.querySelectorAll<HTMLElement>(groups.map(group => `${group} button`).join(','))];
    for (const element of controls) {
      const box = element.getBoundingClientRect();
      if (box.width < 44 || box.height < 44 || box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight) errors.push(`Control outside usable bounds: ${element.textContent}`);
    }
    const boxes = groups.map(group => {
      const parent = document.querySelector(group)!;
      const rects = [...parent.querySelectorAll('button')].map(button => button.getBoundingClientRect());
      return { left: Math.min(...rects.map(r => r.left)), top: Math.min(...rects.map(r => r.top)),
        right: Math.max(...rects.map(r => r.right)), bottom: Math.max(...rects.map(r => r.bottom)) };
    });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!, b = boxes[j]!;
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) errors.push(`Overlap: ${groups[i]} / ${groups[j]}`);
    }
    const shell = document.querySelector('.app-shell')!;
    if (shell.scrollHeight > shell.clientHeight || shell.scrollWidth > shell.clientWidth) errors.push('Page scrolls');
    if (errors.length) throw new Error(errors.join('; '));
    return { viewport: [innerWidth, innerHeight], controls: controls.length, result: 'passed' };
  },
  delay: (ms: number) => { delay = ms; },
  complete: () => {
    completed = true;
    client.setQueryData(['profiles', 'm2-family'], [{ ...profile, total_done: 1 }]);
    client.setQueryData(['progress', 'm2-family', profile.id], { done_item_ids: [item.id], wip_item_ids: [] });
  },
  filter: (value: 'all' | 'todo' | 'done') => useFilterStore.getState().setProgress('m2-family:1', profile.id, value),
} });
if (new URLSearchParams(location.search).has('hooks')) {
  const { checkPreparedMapHook } = await import('./prepared-map-hook-checks');
  try { document.body.textContent = await checkPreparedMapHook(); }
  catch (error) { document.body.textContent = String(error); throw error; }
} else createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter><MapPage/></MemoryRouter></QueryClientProvider>);
