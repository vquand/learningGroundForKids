import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createMinikuPuzzle, fetchMinikuPuzzles, fetchMinikuSettings, updateMinikuPuzzle, updateMinikuSettings, type MinikuPuzzle } from '../../api/minikuCatalog';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { useParentRequests } from '../../hooks/useParentRequests';
import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';

export function MinikuPuzzleListPage({ admin = false, embedded = false, routed = false }: { admin?: boolean; embedded?: boolean; routed?: boolean }) {
  useUiLanguage();
  const familyId = useFamilyStore(state => state.familyId);
  const cache = useQueryClient();
  const navigate = useNavigate(), location = useLocation();
  const { puzzleId } = useParams();
  const [params, setParams] = useSearchParams();
  const newPuzzle = routed && location.pathname.endsWith('/new');
  const editorRoute = routed && (newPuzzle || !!puzzleId);
  const requests = useParentRequests();
  const hintRequests = useParentRequests();
  const initializedEditor = useRef('');
  const key = familyQueryKey('miniku-puzzles', familyId, admin);
  const puzzles = useQuery({ queryKey: key, queryFn: familyScopedQuery(familyId, () => fetchMinikuPuzzles(admin)), enabled: !!familyId });
  const settingsKey = familyQueryKey('miniku-settings', familyId);
  const settings = useQuery({ queryKey: settingsKey, queryFn: familyScopedQuery(familyId, fetchMinikuSettings), enabled: !!familyId && !admin });
  const [localFilter, setLocalFilter] = useState(0);
  const filter = routed ? ([3,4,5].includes(Number(params.get('size'))) ? Number(params.get('size')) : 0) : localFilter;
  const setFilter = (size: number) => routed ? setParams(size ? {size:String(size)} : {}) : setLocalFilter(size);
  const [draft, setDraft] = useState<MinikuPuzzle | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingHints, setSavingHints] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const editor = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!routed && draft && editor.current && !editor.current.open) editor.current.showModal(); }, [draft,routed]);
  useEffect(() => {
    if(!routed) return;
    if(!editorRoute) {initializedEditor.current='';setDraft(null);return;}
    const key = newPuzzle ? `new:${filter||3}` : puzzleId!;
    if(initializedEditor.current===key) return;
    if(newPuzzle) {
      const size = (filter||3) as 3|4|5;
      setDraft({id:'',size,givens:Array(size*size).fill(0),enabled:true,revision:0,ownerFamilyId:familyId});
    } else {
      if(!puzzles.data) return;
      const row = puzzles.data.find(row=>row.id===puzzleId && row.ownerFamilyId===familyId);
      if(!row) {setError('Puzzle not found.');setDraft(null);} else setDraft(structuredClone(row));
    }
    initializedEditor.current=key;
  },[routed,editorRoute,newPuzzle,filter,puzzleId,puzzles.data,familyId]);
  function closeEditor() { setDraft(null); if(routed) navigate('/parent/lists/miniku'); }
  function create(size: 3|4|5) {
    setError('');
    if(routed) {navigate(`/parent/lists/miniku/new?size=${size}`);return;}
    setDraft({id:'',size,givens:Array(size*size).fill(0),enabled:true,revision:0,ownerFamilyId:admin?null:familyId});
  }
  function edit(puzzle: MinikuPuzzle) { setError(''); if(routed) navigate(`/parent/lists/miniku/${encodeURIComponent(puzzle.id)}/edit`); else setDraft(structuredClone(puzzle)); }

  async function save(puzzle: MinikuPuzzle) {
    await requests.run(()=>puzzle.id?updateMinikuPuzzle(puzzle,admin):createMinikuPuzzle(puzzle,admin),{
      start:()=>{setBusy(true);setError('');setMessage('');},
      success:saved=>{
        cache.setQueryData<MinikuPuzzle[]>(key,rows=>rows?.some(row=>row.id===saved.id)?rows.map(row=>row.id===saved.id?saved:row):[...(rows??[]),saved]);
        setDraft(null);setMessage('Puzzle saved. Games already in progress stay unchanged.');
        if(editorRoute) navigate(`/parent/lists/miniku?size=${saved.size}`);
      },error:caught=>setError(caught instanceof Error?caught.message:'Unable to save puzzle.'),finish:()=>setBusy(false),
    });
  }
  async function toggleHints(hints: boolean) {
    await hintRequests.run(()=>updateMinikuSettings(hints),{
      start:()=>{setSavingHints(true);setError('');},success:saved=>{cache.setQueryData(settingsKey,saved);void cache.invalidateQueries({queryKey:familyQueryKey('miniku',familyId)});},
      error:caught=>setError(caught instanceof Error?caught.message:'Unable to save hints.'),finish:()=>setSavingHints(false),
    });
  }
  const visible = (puzzles.data ?? []).filter(puzzle => (admin || puzzle.ownerFamilyId === familyId) && (!filter || puzzle.size === filter));
  const Container = embedded ? 'div' : 'main';
  const Heading = 'h1';
  const Editor = routed ? 'section' : 'dialog';
  return <Container className={embedded ? 'mt-5' : 'min-h-screen bg-gray-50 p-6'}><div className="mx-auto max-w-6xl">
    {!embedded && <Link to={admin ? '/admin' : '/parent'} className="text-blue-700">← {admin ? uiText("Admin dashboard") : uiText("Parent Space")}</Link>}
    <Heading className={embedded ? 'my-3 text-lg font-semibold text-gray-900' : 'my-4 text-3xl font-bold text-gray-900'}>{uiText("Miniku puzzles")}</Heading>
    {admin && <div className="my-4"><AdminRefreshButton refreshing={puzzles.isFetching} disabled={busy} onRefresh={() => { void puzzles.refetch(); }} /></div>}
    <p className="text-gray-600">{uiText("Each row and column uses every number once. ")}{admin ? uiText("Edit clues or disable puzzles for new games.") : uiText("Create and manage your family’s own puzzles here.")}</p>
    {!editorRoute && <>{!admin && <section className="my-5 rounded-2xl border bg-white p-5">
      <div className="flex items-center gap-3">
        <button type="button" role="switch" aria-checked={settings.data?.hints ?? true} aria-labelledby="miniku-hints-label" disabled={savingHints || !settings.data} onClick={() => void toggleHints(!(settings.data?.hints ?? true))} className="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 disabled:opacity-50" style={{ backgroundColor: settings.data?.hints === false ? '#9ca3af' : '#0f766e' }}>
          <span aria-hidden="true" className="absolute h-6 w-6 rounded-full bg-white shadow transition-transform" style={{ transform: settings.data?.hints === false ? 'translateX(2px)' : 'translateX(26px)' }} />
        </button>
        <span id="miniku-hints-label" className="font-semibold text-gray-800">{uiText("Hint in possible values")}</span>
        <span className="text-sm text-gray-500" aria-live="polite">{savingHints ? uiText("Saving…") : settings.data?.hints === false ? uiText("Off") : uiText('On')}</span>
      </div>
      <p className="mt-2 text-sm text-gray-600">{uiText("On: number choices show green or red hints. Off: all choices stay gray. Conflicting numbers in the grid are still highlighted. Applies to all children in your family.")}</p>
      {settings.error && <p role="alert" className="mt-2 text-red-700">{settings.error.message}</p>}
    </section>}
    {error && <p role="alert" className="my-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="my-4 rounded-lg bg-green-50 p-3 text-green-800">{message}</p>}
    <label className="my-5 block text-gray-800">{uiText("Grid size ")}<select className="ml-3 rounded-lg border p-3" value={filter} onChange={event => setFilter(Number(event.target.value))}><option value={0}>{uiText("All sizes")}</option>{[3,4,5].map(size => <option key={size} value={size}>{size} × {size}</option>)}</select></label>
    <div className="my-4 flex flex-wrap gap-2">{[3,4,5].map(size => <button key={size} type="button" className="min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white" disabled={busy} onClick={() => create(size as 3|4|5)}>{uiText("Create ")}{size} × {size}</button>)}</div>
    {puzzles.isLoading && <p role="status">{uiText("Loading puzzles…")}</p>}
    {puzzles.error && <p role="alert" className="text-red-700">{puzzles.error.message}</p>}
    {!puzzles.isLoading && !puzzles.error && !visible.length && <p>{uiText("No saved puzzles for this size yet. You can create one using the buttons above.")}</p>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(puzzle => <article key={puzzle.id} className="rounded-2xl border bg-white p-4">
      <h2 className="font-bold text-gray-800">{puzzle.size} × {puzzle.size} {uiText(" · Puzzle ")}{puzzle.id.slice(0,8)}</h2>
      <p className="my-2 text-sm text-gray-600">{puzzle.ownerFamilyId ? uiText("Family puzzle") : uiText("Shared puzzle")} · {puzzle.enabled ? uiText("Enabled") : uiText("Disabled")} · {puzzle.givens.filter(Boolean).length} {uiText(" clues")}</p>
      <div className="mx-auto my-4 grid aspect-square w-full max-w-52 overflow-hidden rounded-lg border border-gray-400" style={{ gridTemplateColumns: `repeat(${puzzle.size},1fr)`, gridTemplateRows: `repeat(${puzzle.size},1fr)` }}>{puzzle.givens.map((value,index) => <span key={index} className="grid place-items-center border border-gray-200 text-xl font-bold text-gray-700">{value || ''}</span>)}</div>
      {(admin || puzzle.ownerFamilyId === familyId) && <div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-lg border px-4 font-semibold" disabled={busy} onClick={() => edit(puzzle)}>{uiText("Edit")}</button><button type="button" className="min-h-11 rounded-lg border px-4 font-semibold" disabled={busy} onClick={() => void save({ ...puzzle, enabled: !puzzle.enabled })}>{puzzle.enabled ? uiText("Disable") : uiText("Enable")}</button></div>}
    </article>)}</div>
    </>}
    {editorRoute && <Link className="parent-back" to="/parent/lists/miniku">← {uiText('Back to puzzles')}</Link>}
    {editorRoute && puzzles.isPending && !newPuzzle && <p role="status">{uiText('Loading puzzles…')}</p>}
    {editorRoute && error && <p role="alert" className="parent-alert">{uiText(error)}</p>}
    {draft && <Editor ref={routed?undefined:editor} aria-labelledby="miniku-edit-title" onClose={closeEditor} onCancel={event => { if (busy) event.preventDefault(); }} className={routed ? "parent-panel parent-puzzle-editor" : "fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-auto rounded-2xl border bg-white p-5 backdrop:bg-black/40"}>
      <h2 id="miniku-edit-title" className="text-xl font-bold">{draft.id ? uiText("Edit") : uiText("Create")} {draft.size} × {draft.size} {uiText(" puzzle")}</h2><p className="my-2 text-sm text-gray-600">{uiText("Choose empty to remove a clue. Saving checks logical solvability and duplicate clue layouts.")}</p>
      <div className="my-4 grid gap-1" style={{ gridTemplateColumns: `repeat(${draft.size},minmax(0,1fr))` }}>{draft.givens.map((value,index) => <select key={index} aria-label={`Row ${Math.floor(index / draft.size)+1}, column ${index % draft.size + 1}`} className="min-h-11 min-w-0 rounded border text-center" value={value} disabled={busy} onChange={event => setDraft({ ...draft, givens: draft.givens.map((old,position) => position === index ? Number(event.target.value) : old) })}><option value={0}>·</option>{Array.from({ length:draft.size },(_, digit) => <option key={digit+1} value={digit+1}>{digit+1}</option>)}</select>)}</div>
      <label className="flex gap-2"><input type="checkbox" checked={draft.enabled} disabled={busy} onChange={event => setDraft({ ...draft, enabled:event.target.checked })} />{uiText("Enabled for new games")}</label>
      {error && <p role="alert" className="my-3 text-red-700">{error}</p>}
      <div className="mt-4 flex gap-3"><button type="button" className="min-h-11 rounded-lg bg-blue-700 px-5 text-white" disabled={busy} onClick={() => void save(draft)}>{uiText("Save")}</button><button type="button" className="min-h-11 rounded-lg border px-5" disabled={busy} onClick={closeEditor}>{uiText("Cancel")}</button></div>
    </Editor>}
  </div></Container>;
}
