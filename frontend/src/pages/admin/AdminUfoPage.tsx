import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useState } from 'react';
import { listUfoWords, saveUfoWord, deleteUfoWord, loadUfoMaster, type UfoWord, type Difficulty } from '../../api/ufo';
import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';
const empty: Omit<UfoWord, 'id'> = { word: '', clue: '', definition: '', difficulty: 'easy', language: 'en' };
export function AdminUfoPage() {
  useUiLanguage();
  const [reload, setReload] = useState(0);

  const [words, setWords] = useState<UfoWord[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [editing, setEditing] = useState<string | null>(null), [form, setForm] = useState(empty), [query, setQuery] = useState(''), [filter, setFilter] = useState(''), [languageFilter, setLanguageFilter] = useState(''), [page, setPage] = useState(1), [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    void listUfoWords().then(w => {
      if (alive)
        setWords(w);
    }).catch(e => {
      if (alive)
        setError(e.message);
    }).finally(() => {
      if (alive)
        setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [reload]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const filtered = words.filter(w => (!filter || w.difficulty === filter) && (!languageFilter || (w.language ?? 'en') === languageFilter) && `${w.word} ${w.clue} ${w.definition}`.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages);

  return <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Shoo Shoo UFO</h1>
          <p className="mt-1 text-sm text-slate-600">{uiText("English & Vietnamese dictionaries · Ages 5–8 · ")}{words.length} {uiText(" words")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <AdminRefreshButton refreshing={loading} disabled={busy} onRefresh={() => setReload(value => value + 1)} />
          <button disabled={busy || loading} className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-50" onClick={() => void run(async () => {
            const r = await loadUfoMaster();
            setWords(await listUfoWords());
            setMessage(`Added ${r.added} missing master words. Existing words and edits were preserved.`);
          })}>{busy ? uiText("Working…") : uiText("Load master dictionary")}</button>
          <button disabled={busy} className="rounded-lg bg-sky-800 px-4 py-3 text-sm font-bold text-white" onClick={() => {
            setForm({ ...empty });
            setEditing(null);
            setShowForm(true);
          }}>{uiText("+ Add word")}</button>
        </div>
      </header>
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}
        <button className="underline" onClick={() => void run(async () => {
          setWords(await listUfoWords());
        })}>{uiText("Reload list")}</button>
      </p>}{message && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-4 text-emerald-800">{message}</p>}
      {showForm && <form className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2" onSubmit={e => {
        e.preventDefault();
        void run(async () => {
          await saveUfoWord(form, editing ?? undefined);
          setWords(await listUfoWords());
          setShowForm(false);
          setMessage('Word saved. Changes apply to future rounds.');
        });
      }}>
        <h2 className="font-bold sm:col-span-2">{editing ? uiText("Edit word") : uiText("New word")}</h2>
        <label className="grid gap-1 text-sm font-semibold">{form.language === 'vi' ? 'Word (2–30 Vietnamese letters/spaces)' : uiText("Word (2–18 letters A–Z)")}
          <input required pattern={form.language === 'vi' ? undefined : '[A-Za-z]{2,18}'} maxLength={form.language === 'vi' ? 30 : 18} className="rounded border border-slate-300 p-3 uppercase" value={form.word} onChange={e => setForm({ ...form, word: e.target.value.toUpperCase() })} />
        </label>

        <label className="grid gap-1 text-sm font-semibold">{uiText("Language")}<select className="rounded border border-slate-300 p-3" value={form.language ?? 'en'} onChange={e => setForm({ ...form, language: e.target.value as 'en' | 'vi' })}><option value="en">{uiText("English")}</option><option value="vi">Tiếng Việt</option></select></label>
        <label className="grid gap-1 text-sm font-semibold">{uiText("Difficulty")}<select className="rounded border border-slate-300 p-3" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value as Difficulty })}>{['easy', 'medium', 'hard'].map(d => <option key={d}>{d}</option>)}</select>
        </label>

        <label className="grid gap-1 text-sm font-semibold">{uiText("Short clue")}<textarea required minLength={3} maxLength={180} rows={2} className="rounded border border-slate-300 p-3" value={form.clue} onChange={e => setForm({ ...form, clue: e.target.value })} />
        </label>

        <label className="grid gap-1 text-sm font-semibold">{uiText("Meaning")}<textarea required minLength={3} maxLength={220} rows={2} className="rounded border border-slate-300 p-3" value={form.definition} onChange={e => setForm({ ...form, definition: e.target.value })} />
        </label>
        <div className="flex gap-3 sm:col-span-2">
          <button disabled={busy} className="rounded bg-sky-800 px-5 py-3 font-bold text-white">{uiText("Save word")}</button>
          <button type="button" disabled={busy} className="rounded border border-slate-300 px-5 py-3" onClick={() => setShowForm(false)}>{uiText("Cancel")}</button>
        </div>
      </form>}
      <div className="mb-4 flex flex-wrap gap-3"><label className="flex flex-col gap-1 text-sm font-semibold">{uiText("Language")}<select className="rounded-lg border border-slate-300 bg-white p-3" value={languageFilter} onChange={e => { setLanguageFilter(e.target.value); setPage(1); }}><option value="">{uiText("All languages")}</option><option value="en">{uiText("English")}</option><option value="vi">Tiếng Việt</option></select></label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">{uiText("Search words")}<input className="min-w-0 rounded-lg border border-slate-300 bg-white p-3" value={query} onChange={e => {
            setQuery(e.target.value);
            setPage(1);
          }} placeholder={uiText("Word, clue, or meaning")} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{uiText("Difficulty")}<select className="rounded-lg border border-slate-300 bg-white p-3" value={filter} onChange={e => {
            setFilter(e.target.value);
            setPage(1);
          }}>
            <option value="">{uiText("All difficulties")}</option>
            {['easy', 'medium', 'hard'].map(d => <option key={d}>{d}</option>)}</select>
        </label>
      </div>
      {loading ? <p role="status">{uiText("Loading dictionary…")}</p> : <>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>{['Word', 'Language', 'Difficulty', 'Clue', 'Meaning', 'Actions'].map(h => <th key={h} scope="col" className="p-4">{h}</th>)}</tr>
            </thead>
            <tbody>{filtered.slice((current - 1) * 20, current * 20).map(w => <tr key={w.id} className="border-t border-slate-100">
              <th scope="row" className="p-4">{w.word}</th>
              <td className="p-4">{w.language === 'vi' ? 'Tiếng Việt' : uiText("English")}</td><td className="p-4">{w.difficulty}</td>
              <td className="min-w-48 p-4">{w.clue}</td>
              <td className="min-w-48 p-4">{w.definition}</td>
              <td className="p-4">
                <div className="flex gap-3">
                  <button disabled={busy} className="font-bold text-sky-800" onClick={() => {
                    setEditing(w.id);
                    setForm({ language: w.language ?? 'en', word: w.word, clue: w.clue, definition: w.definition, difficulty: w.difficulty });
                    setShowForm(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}>{uiText("Edit")}<span className="sr-only"> {w.word}</span>
                  </button>
                  <button disabled={busy} className="font-bold text-red-700" onClick={() => {
                    if (window.confirm(`Delete ${w.word}? Saved rounds will be preserved.`))
                      void run(async () => {
                        await deleteUfoWord(w.id);
                        setWords(prev => prev.filter(x => x.id !== w.id));
                        setMessage('Word deleted from future selection.');
                      });
                  }}>{uiText("Delete")}<span className="sr-only"> {w.word}</span>
                  </button>
                </div>
              </td>
            </tr>)}</tbody>
          </table>
          {!filtered.length && <p className="p-8 text-center text-slate-600">{words.length ? uiText("No words match your search.") : uiText("No words yet. Load the master dictionary or add a word.")}</p>}</div>
        <div className="mt-4 flex items-center justify-center gap-5">
          <button disabled={current <= 1} onClick={() => setPage(current - 1)} className="rounded border px-4 py-2 disabled:opacity-40">{uiText("Previous")}</button>
          <span>{current} / {pages} · {filtered.length} {uiText(" words")}</span>
          <button disabled={current >= pages} onClick={() => setPage(current + 1)} className="rounded border px-4 py-2 disabled:opacity-40">{uiText("Next")}</button>
        </div>
      </>}
    </div>
  </main>;

}
