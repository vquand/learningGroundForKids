import { TownRewardBar } from '../town-building/TownRewardBar';
import { MinigameBadgesButton } from '../achievements/MinigameBadgesButton';
import { KidBackButton } from "../../components/KidBackButton";
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { actMathWall, fetchMathLeaders, fetchMathWall, startMathWall, type MathAction, type MathAnimal, type MathLanguage, type MathState, type WallStyle } from '../../api/mathWall';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { useProfileStore } from '../../stores/profileStore';
import { MathWallScene } from './MathWallScene';
import { QuestionView } from '../../components/questions/QuestionView';
import { promptText } from '../../../../server/src/questions/text.ts';
import { MathWallSetup } from './MathWallSetup';
import { MathBadgeList } from './MathWallBadges';
import { getUiLanguage } from '../../lib/uiLanguage';
import './mathWall.css';
import './mathWallTheme.css';

export function MathWallPage() {
  useUiLanguage();
  const navigate = useNavigate(), cache = useQueryClient();
  const familyId = useFamilyStore(s => s.familyId), profileId = useProfileStore(s => s.activeProfileId);
  const sessionGeneration = useFamilyStore(s => s.sessionGeneration);
  const key = familyQueryKey('math-wall', familyId, profileId);
  const query = useQuery({ queryKey: key, queryFn: familyScopedQuery(familyId, () => fetchMathWall(profileId!)), enabled: Boolean(familyId && profileId), refetchOnWindowFocus: false, retry: false });
  const state = query.data, current = useRef<MathState | undefined>(state); current.current = state;
  const identity = useRef({ familyId, profileId, sessionGeneration }); identity.current = { familyId, profileId, sessionGeneration };
  const clockOffset = useRef(0), serverRevision = useRef(-1);
  if (state && state.revision !== serverRevision.current) {
    clockOffset.current = state.serverNow - Date.now(); serverRevision.current = state.revision;
  }
  const [now, setNow] = useState(Date.now()), [pending, setPending] = useState(false), [error, setError] = useState('');
  const [animal, setAnimal] = useState<MathAnimal>('capybara'), [wall, setWall] = useState<WallStyle>('brick'), [language, setLanguage] = useState<MathLanguage | null>(null);
  const [localLane, setLocalLane] = useState<number | null>(null), [setup, setSetup] = useState(false);
  const queue = useRef(Promise.resolve()), outstanding = useRef(0), initialized = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const command = useCallback((action: MathAction | { type: 'start' }) => {
    const owner = { familyId, profileId, sessionGeneration };
    outstanding.current++; setPending(true);
    const run = async () => {
      if (identity.current.familyId !== owner.familyId || identity.current.profileId !== owner.profileId || identity.current.sessionGeneration !== owner.sessionGeneration) return;
      const latest = current.current;
      if (!latest || !profileId) return;
      try {
        const next = action.type === 'start'
          ? await startMathWall(profileId, latest.revision, { animal, wall, language: language! })
          : await actMathWall(profileId, latest.revision, action);
        if (identity.current.familyId !== owner.familyId || identity.current.profileId !== owner.profileId || identity.current.sessionGeneration !== owner.sessionGeneration) return;
        current.current = next; clockOffset.current = next.serverNow - Date.now(); serverRevision.current = next.revision;
        cache.setQueryData(familyQueryKey('math-wall', familyId, profileId), next);
        if (alive.current) { setNow(Date.now() + clockOffset.current); setError(''); if (action.type === 'start') setSetup(false); }
      } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Please try again.'); }
    };
    queue.current = queue.current.then(run).finally(() => { outstanding.current--; if (alive.current && !outstanding.current) { setPending(false); setLocalLane(null); } });
    return queue.current;
  }, [animal, wall, language, familyId, profileId, sessionGeneration, cache]);
  const session = state?.session ?? null;
  const sessionBadges = session?.earnedBadges ?? [];
  const showSetup = !session || setup;
  const uiLanguage = getUiLanguage(), vi = uiLanguage === 'vi';
  const contentVi = session?.language === 'vi';
  const countingQuestion = session?.question.card.kind === 'counting';
  useEffect(() => {
    if (!state || initialized.current) return;
    initialized.current = true;
    if (state.session) {
      setAnimal(state.session.animal); setWall(state.session.wall); setLanguage(state.session.language);
      if (state.session.phase === 'playing' || state.session.phase === 'resolved') void command({ type: 'pause' });
    }
  }, [state, command]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const s = current.current?.session;
      if (s && (s.phase === 'playing' || s.phase === 'resolved')) setNow(Date.now() + clockOffset.current);
    }, 50);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!session || pending || error || showSetup || now < session.deadline) return;
    if (session.phase === 'playing') void command({ type: 'settle' });
    else if (session.phase === 'resolved') void command({ type: 'next' });
  }, [session, now, pending, error, showSetup, command]);
  const chooseLane = useCallback((lane: number) => {
    const s = current.current?.session;
    if (!s || s.phase !== 'playing' || Date.now() + clockOffset.current >= s.deadline || error || showSetup) return;
    setLocalLane(lane); void command({ type: 'lane', lane });
  }, [command, error, showSetup]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))) return;
      if (/^[123]$/.test(event.key)) { event.preventDefault(); chooseLane(Number(event.key) - 1); }
    };
    const visibility = () => {
      const s = current.current?.session;
      if (document.hidden && s && (s.phase === 'playing' || s.phase === 'resolved')) void command({ type: 'pause' });
    };
    window.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', visibility); };
  }, [chooseLane, command]);
  const results = Boolean(session && !showSetup && (session.phase === 'paused' || session.phase === 'finished'));
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!results) return;
    const previous = document.activeElement as HTMLElement | null;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || (event.target instanceof Element && event.target.closest('.minigame-badges-dialog'))) return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [results]);
  const leaders = useQuery({ queryKey: familyQueryKey('math-wall-leaders', familyId, profileId, state?.revision), queryFn: familyScopedQuery(familyId, () => fetchMathLeaders(profileId!)), enabled: Boolean(familyId && profileId && results), retry: false });
  const hasFriends = Boolean(leaders.data?.some(leader => !leader.self));
  const highestScore = leaders.data?.[0]?.score;
  async function leave() {
    if (session?.phase === 'playing' || session?.phase === 'resolved') await command({ type: 'pause' });
    navigate('/playground');
  }
  if (query.isLoading) return <main className="math-loading" role="status">{uiText("Getting the pool ready…")}</main>;
  if (query.error || !state) return <main className="math-loading"><p role="alert">{query.error?.message ?? uiText("Choose a profile to play.")}</p><button onClick={() => void query.refetch()}>{uiText("Try again")}</button><KidBackButton className="kid-back--floating"/></main>;
  const live = session && localLane !== null ? { ...session, lane: localLane } : session;
  const remainingRatio = session ? Math.max(0, Math.min(1, (session.phase === 'paused' ? session.remaining : session.phase === 'playing' ? session.deadline - now : 0) / ({ easy: 10000, medium: 15000, hard: 20000 }[session.difficulty]))) : 1;
  const timerUrgency = remainingRatio > .5 ? 'green' : remainingRatio > .25 ? 'yellow' : 'red';
  return <main className={`math-page ${showSetup ? 'is-setup' : 'is-playing'}`} lang={uiLanguage}>
    <header className="math-topbar kid-nav" inert={results}>
      <KidBackButton onClick={() => void leave()} disabled={pending}/>
      <span className="math-brand">{vi ? 'Lắc Lư Vượt Tường' : uiText("Waddle Wall")}</span>
      <div className="math-nav-actions"><TownRewardBar reward={state.townReward} event={state.revision} source=".math-stage" onOpenStorage={() => { if (session?.phase === 'playing' || session?.phase === 'resolved') void command({ type: 'pause' }); }}/><MinigameBadgesButton groupIds={['waddle-wall']} disabled={pending} onOpen={() => { if (session?.phase === 'playing' || session?.phase === 'resolved') void command({ type: 'pause' }); }} />{!showSetup && !results ? <button type="button" className="kid-nav-action" disabled={pending} onClick={() => void command({ type: 'pause' })}>{vi ? 'Ⅱ Tạm dừng' : uiText("Ⅱ Pause")}</button> : <span />}</div>
    </header>
    {error && <div className="math-error" role="alert">{error}<button onClick={() => { void query.refetch().then(() => setError('')); }}>{vi ? 'Thử lại' : uiText("Reload game")}</button></div>}
    {showSetup ? <div className="math-setup-layout">
      <MathWallSetup animal={animal} setAnimal={setAnimal} wall={wall} setWall={setWall} language={language} setLanguage={setLanguage} pending={pending} onStart={() => void command({ type: 'start' })} />
      <div className="math-preview"><MathWallScene animal={animal} wall={wall} session={null} now={now} onLane={() => {}} /><p>{vi ? 'Một chút lắc lư. Một chút toán. Thật nhiều niềm vui.' : uiText("A little waddle. A little maths. A lot of heart.")}</p></div>
    </div> : session && <div className="math-play-layout">
      <section className={`math-question ${session.difficulty}`} inert={results} aria-label={`${vi ? 'Câu hỏi' : uiText("Question")} · ${{ easy: vi ? 'Dễ' : uiText("Easy"), medium: vi ? 'Vừa' : uiText("Medium"), hard: vi ? 'Khó' : uiText("Hard") }[session.difficulty]}`}>
        {!countingQuestion && <p lang={session.language}>{contentVi ? 'Đáp án là bao nhiêu?' : uiText("What’s the answer?")}</p>}
        <h1 lang={session.language} className={countingQuestion ? 'math-counting-title' : undefined}>{countingQuestion ? promptText(session.question.card, session.language) : <QuestionView question={session.question} language={session.language} variant="inline" />}</h1>
        {countingQuestion && <QuestionView question={session.question} language={session.language} />}
        <div className="math-wall-clock" data-urgency={timerUrgency} aria-hidden="true"><span style={{ transform: `scaleX(${remainingRatio})` }} /></div>
      </section>
      <div className="math-stage" inert={results}><MathWallScene animal={session.animal} wall={session.wall} session={live} now={now} onLane={chooseLane} disabled={Boolean(error)} />
        <div className="math-feedback" role="status" aria-live="polite">{session.result === 'pass' ? vi ? 'Đúng rồi! ♥' : uiText("You got it! ♥") : session.result === 'splash' && session.correctLane !== null && session.question.response.mode === 'choice' ? vi ? `Ùm! Đáp án là ${session.question.response.choices[session.correctLane]}.` : `Splash! The answer is ${session.question.response.choices[session.correctLane]}.` : ''}</div>
      </div>
      {results && <div className="math-results-backdrop"><section ref={dialog} className="math-results" role="dialog" aria-modal="true" aria-labelledby="math-results-title">
        <p className="math-eyebrow">{vi ? 'NGHỈ MỘT CHÚT NHÉ' : uiText("A LITTLE BREATHER")}</p>
        <h2 id="math-results-title">{session.phase === 'finished' ? session.result === 'splash' ? vi ? 'Bạn đã cố gắng!' : uiText("Nice try!") : vi ? 'Chơi hay lắm!' : uiText("Lovely waddling!") : vi ? 'Đã tạm dừng' : uiText("Poolside pause")}</h2>
        {session.phase === 'finished' && <p className="math-finished-summary">{vi ? `Bạn dừng ở bức tường số ${session.wave} và được ${session.score} điểm.` : `You stopped at wall ${session.wave} and scored ${session.score} ${session.score === 1 ? uiText("point") : uiText("points")}.`}</p>}
        <div className="math-score-cards"><div><span>{vi ? 'Điểm lần này' : uiText("This game")}</span><strong>{session.score}</strong></div><div><span>{vi ? 'Kỷ lục của bạn' : uiText("Your best")}</span><strong>{state.best}</strong></div></div>
        {leaders.error && <p role="alert">{leaders.error.message} <button onClick={() => void leaders.refetch()}>{vi ? 'Thử lại' : uiText("Try again")}</button></p>}
        {leaders.data && !hasFriends && <p className="math-personal-high-score">{vi ? 'Điểm cao nhất của bạn đến giờ' : uiText("Your high score so far")}: <strong>{state.best}</strong></p>}
        {hasFriends && leaders.data && <>
          <h3>{vi ? 'Kỷ lục toàn cầu · Bạn & bạn bè' : uiText("Global high scores · You & friends")}</h3>
          <p className="math-friends-note">{vi ? 'Bạn và bạn bè' : uiText("You and your friends")}</p>
          <ol className="math-leaders">{leaders.data.map((leader, i) => <li key={i} className={`${leader.self ? 'self ' : ''}${leader.score === highestScore ? 'highest' : ''}`}><span>{i + 1}. {leader.score === highestScore && <span className="math-gold-medal" role="img" aria-label={vi ? 'Huy chương vàng cho điểm cao nhất' : uiText("Gold medal for the highest score")}>🥇</span>} {leader.name}{leader.self ? vi ? ' (Bạn)' : uiText(" (You)") : ''}</span><strong>{leader.score}</strong></li>)}</ol>
        </>}
        <div className="math-result-actions">{session.phase === 'paused' ? <><button className="math-primary" disabled={pending} autoFocus onClick={() => void command({ type: 'resume' })}>{vi ? 'Chơi tiếp →' : uiText("Keep waddling →")}</button><button disabled={pending} onClick={() => void command({ type: 'finish' })}>{vi ? 'Kết thúc' : uiText("Finish")}</button></> : <button className="math-primary" autoFocus onClick={() => setSetup(true)}>{vi ? 'Chơi lại →' : uiText("Play again →")}</button>}<KidBackButton className="kid-back--floating" onClick={() => void leave()} disabled={pending}/></div>
        {sessionBadges.length > 0 && <section aria-label={vi ? 'Huy hiệu trong lần chơi này' : uiText("Badges earned this game")}>
          <h3>{vi ? 'Huy hiệu bạn nhận trong lần chơi này' : uiText("Badges you earned this game")}</h3><MathBadgeList achievements={sessionBadges} language={uiLanguage} />
        </section>}
      </section></div>}
    </div>}
  </main>;
}
