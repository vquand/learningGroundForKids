import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/core';
import { fetchDailyQuiz, fetchDailyQuizStatus, fetchDailySettings, saveDailySettings, submitDailyQuiz, type VocabularyMode } from '../../api/quiz';
import { createQuizSession, mapShuffledAnswerIndices, type QuizAnswerIn, type QuizSession, type QuizSubmitResponse } from '../../types/quiz';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { useProfileStore } from '../../stores/profileStore';
import { useSessionRequests } from '../../hooks/useSessionRequests';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { KidBackButton } from '../KidBackButton';
import { MinigameBadgesButton } from '../../features/achievements/MinigameBadgesButton';
import { TownRewardBar } from '../../features/town-building/TownRewardBar';
import { MaterialArt } from '../../features/town-building/TownArt';
import { useTTS } from '../../hooks/useTTS';
import './dailyQuiz.css';

const MODES: Array<[VocabularyMode, string]> = [['en-vi', 'English → Vietnamese'], ['vi-en', 'Vietnamese → English'], ['en-en', 'English → English'], ['vi-vi', 'Vietnamese → Vietnamese']];
const SUBJECT_LABELS: Record<string, string> = { math: 'Math', 'vocabulary-en': 'English words', 'vocabulary-vi': 'Vietnamese words', patterns: 'Shape patterns', reasoning: 'Think it through', animal: 'Animals', food: 'Food', monument: 'Monuments', landmark: 'Landmarks', music: 'Music', movie: 'Movies', phenomenon: 'Natural wonders', drink: 'Drinks' };
const CELEBRATIONS = ['A bright beginning!', 'Your streak is growing!', 'Three days of discovery!', 'You are shining all week!'];

export function DailyQuizPage() {
  const familyId = useFamilyStore(state => state.familyId), profileId = useProfileStore(state => state.activeProfileId);
  const generation = useFamilyStore(state => state.sessionGeneration);
  return <DailyQuiz key={`${familyId}:${generation}:${profileId}`} profileId={profileId!} familyId={familyId!}/>;
}
function DailyQuiz({ profileId, familyId }: { profileId: string; familyId: string }) {
  useUiLanguage();
  const navigate = useNavigate(), cache = useQueryClient();
  const requests = useSessionRequests(profileId), { speak, stop } = useTTS();
  const [contentLanguage, setContentLanguage] = useState('en');
  const [session, setSession] = useState<QuizSession | null>(null), [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<number | null>(null), answers = useRef<QuizAnswerIn[]>([]);
  const [result, setResult] = useState<QuizSubmitResponse | null>(null), [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [modes, setModes] = useState<VocabularyMode[] | null>(null);
  const [receipt, setReceipt] = useState<QuizSubmitResponse | null>(null);
  const [utcDay, setUtcDay] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => { const timer = setInterval(() => setUtcDay(new Date().toISOString().slice(0, 10)), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => { stop(); }, [index, stop]);
  const status = useQuery({ queryKey: familyQueryKey('daily-quiz-status', familyId, profileId, utcDay), queryFn: familyScopedQuery(familyId, () => fetchDailyQuizStatus(profileId)), staleTime: 0, retry: false });
  const settings = useQuery({ queryKey: familyQueryKey('daily-quiz-settings', familyId, profileId), queryFn: familyScopedQuery(familyId, () => fetchDailySettings(profileId)), retry: false });
  const bonus = status.data?.bonus ?? 0, tier = Math.min(3, Math.floor((result?.bonus ?? bonus) / 2));
  const question = session?.questions[index];
  const loading = status.isPending || settings.isPending;
  function run<T>(request: () => Promise<T>, success: (value: T) => void) {
    void requests.run(request, { start: () => { setBusy(true); setError(null); }, success, error: err => {
      setError(err instanceof Error ? err.message : uiText('Please try again.'));
      if (err instanceof ApiError && ['DAILY_QUIZ_EXPIRED', 'DAILY_QUIZ_REFRESHED'].includes(err.code)) {
        setSession(null); answers.current = []; setResult(null);
        void status.refetch();
      }
    }, finish: () => setBusy(false) });
  }
  function start() {
    run(() => fetchDailyQuiz(profileId, contentLanguage), quiz => { stop(); setSession(createQuizSession(quiz.questions)); setIndex(0); setSelection(null); setResult(null); answers.current = []; });
  }
  function submit(collected = answers.current) {
    run(() => submitDailyQuiz(profileId, { answers: collected }), value => {
      setResult(value);
      if (value.receiptId) setReceipt(value);
      void cache.invalidateQueries({ queryKey: familyQueryKey('daily-quiz-status', familyId, profileId) });
      void cache.invalidateQueries({ queryKey: familyQueryKey('achievements', familyId, profileId) });
    });
  }
  function next() {
    if (!question || selection === null || busy || requests.busy || answers.current.some(answer => answer.question_id === question.id)) return;
    stop();
    const collected = [...answers.current, { question_id: question.id, chosen_answers: mapShuffledAnswerIndices([selection], question.shuffledToOriginal) }];
    answers.current = collected;
    if (collected.length === session!.questions.length) submit(collected);
    else { setIndex(value => value + 1); setSelection(null); }
  }
  function retry() { answers.current = []; setIndex(0); setSelection(null); setResult(null); setError(null); }
  function saveSettings() {
    const nextModes = modes ?? settings.data?.modes ?? [];
    if (!nextModes.length) return;
    run(() => saveDailySettings(profileId, nextModes), value => { cache.setQueryData(familyQueryKey('daily-quiz-settings', familyId, profileId), value); setSettingsOpen(false); });
  }
  const selectedModes = modes ?? settings.data?.modes ?? [];
  return <main className={`daily-quiz-page daily-tier-${tier}`}>
    <header className="kid-nav daily-nav">
      <KidBackButton onClick={() => { stop(); navigate('/playground'); }}/>
      <h1>{uiText('Daily Quiz')}</h1>
      <TownRewardBar reward={receipt?.townReward ?? {}} event={receipt?.receiptId ?? 0} source=".daily-play"/>
      <button type="button" className="kid-nav-action daily-settings-trigger" aria-label={uiText('Daily Quiz settings')} disabled={busy || !!session && !result} onClick={() => { setModes(null); setSettingsOpen(true); }}>⚙</button>
    </header>
    <MinigameBadgesButton groupIds={['daily-quiz']}/>
    <section className="daily-play" aria-label={uiText('Daily Quiz')}>
      {(error || status.isError || settings.isError) && <div className="daily-error" role="alert">
        <span>{error ?? uiText('Could not load Daily Quiz. Please try again.')}</span>
        <button type="button" disabled={busy} onClick={() => { if (answers.current.length === session?.questions.length) submit(); else { setError(null); void status.refetch(); void settings.refetch(); } }}>{uiText('Try Again')}</button>
      </div>}
      {settingsOpen ? <section className="daily-settings daily-panel" aria-labelledby="daily-settings-title">
        <span className="daily-eyebrow">{uiText('Make it yours')}</span><h2 id="daily-settings-title">{uiText('Vocabulary settings')}</h2>
        <p>{uiText('Choose your word directions. Keep at least one enabled. Changes apply to your next new daily quiz.')}</p>
        <div className="daily-mode-grid">{MODES.map(([mode, label]) => <label key={mode}><input type="checkbox" checked={selectedModes.includes(mode)} disabled={busy} onChange={e => setModes(e.target.checked ? [...selectedModes, mode] : selectedModes.filter(value => value !== mode))}/><span>{uiText(label)}</span></label>)}</div>
        <div className="daily-actions"><button type="button" className="daily-secondary" disabled={busy} onClick={() => setSettingsOpen(false)}>{uiText('Cancel')}</button><button type="button" className="daily-primary" disabled={busy || !selectedModes.length} onClick={saveSettings}>{uiText(busy ? 'Saving...' : 'Save settings')}</button></div>
      </section> : result ? <section className={`daily-panel daily-result ${result.passed ? 'daily-success' : ''}`} aria-live="polite">
        <div className="daily-result-art" aria-hidden="true">{result.passed ? ['🌱', '🌷', '🌳', '🌟'][tier] : '📖'}</div>
        <span className="daily-eyebrow">{uiText(result.passed ? 'Daily discovery complete' : 'A little more practice')}</span>
        <h2>{uiText(result.passed ? CELEBRATIONS[tier]! : 'You can try again!')}</h2>
        <p className="daily-score">{result.score}<small> / {result.total}</small></p>
        {result.receiptId ? <><div className="daily-resources">{(['wood', 'stamina', 'metal'] as const).map(material => <div key={material}><MaterialArt material={material}/><strong>10 <span>+ {result.bonus ?? 0}</span></strong><small>{uiText(material)}</small></div>)}</div><p>{uiText('Your learning rewards are in Town storage!')}</p></> : <p>{uiText(result.alreadyRewarded ? 'Today’s reward is already in your town. Come back tomorrow!' : 'Get at least 6 of 8 correct to earn today’s reward.')}</p>}
        <div className="daily-actions">{!result.passed && !result.alreadyRewarded && <button type="button" className="daily-primary" onClick={retry}>{uiText('Try Again')}</button>}<button type="button" className="daily-secondary" onClick={() => { setSession(null); setResult(null); }}>{uiText('Done')}</button></div>
      </section> : session && question ? <section className="daily-panel daily-question">
        <div className="daily-question-top"><span className="daily-eyebrow">{uiText(SUBJECT_LABELS[question.subject ?? ''] ?? 'Daily Quiz')}</span><strong>{index + 1} / {session.questions.length}</strong></div>
        <progress max={session.questions.length} value={index} aria-label={uiText('Quiz progress')}/>
        <div className="daily-prompt"><h2 lang={question.lang} className={question.subject?.startsWith('vocabulary-') ? 'daily-vocabulary-clue' : undefined}>{question.question}</h2><button type="button" className="daily-speaker" aria-label={uiText('Read question aloud')} onClick={() => speak(question.question, question.lang ?? contentLanguage)}>🔊</button></div>
        <div className="daily-options" role="group" aria-label={uiText('Choose one answer')}>{question.options.map((option, choice) => <button type="button" key={choice} aria-pressed={selection === choice} disabled={busy || answers.current.length === session.questions.length} onClick={() => setSelection(choice)} lang={question.lang}><span>{String.fromCharCode(65 + choice)}</span>{option}</button>)}</div>
        <footer className="daily-question-footer"><p>{uiText('Choose one answer')}</p><button type="button" className="daily-primary" disabled={selection === null || busy || answers.current.length === session.questions.length} onClick={next}>{uiText(busy ? 'Checking...' : index === session.questions.length - 1 ? 'Finish quiz' : 'Next question')}</button></footer>
      </section> : <section className="daily-panel daily-welcome">
        <div><span className="daily-eyebrow">{uiText('A little curiosity, every day')}</span><h2>{uiText('Your daily discovery')}</h2><p className="daily-warmup-copy">{uiText('Let’s start today with a little warm-up for your curious mind!')}</p>
          <p className="daily-rules">{uiText('Answer 6 of 8 correctly. You can try again as often as you like.')}</p>
          <div className="daily-actions"><fieldset className="daily-content-language" disabled={busy || status.data?.passed}><legend>{uiText('Question language')}</legend><div className="daily-country-balls">{(['en', 'vi'] as const).map(lang => <button type="button" key={lang} aria-label={lang === 'en' ? uiText('English') : 'Tiếng Việt'} aria-pressed={contentLanguage === lang} onClick={() => setContentLanguage(lang)}><span className={`daily-country-ball ${lang}`} aria-hidden="true"/></button>)}</div></fieldset><button type="button" className="daily-primary" disabled={busy || loading || status.isError || settings.isError || status.data?.passed} onClick={start}>{uiText(busy ? 'Loading...' : status.data?.passed ? 'Daily Done!' : status.data?.attempted_today ? 'Try Again' : 'Start daily quiz')}</button></div>
          {status.data?.passed && <p>{uiText('Come back tomorrow for another discovery!')}</p>}
        </div>
      </section>}
    </section>
  </main>;
}
