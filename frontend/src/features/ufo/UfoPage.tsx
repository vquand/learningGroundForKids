import { MinigameBadgesButton } from '../achievements/MinigameBadgesButton';
import { KidBackButton } from "../../components/KidBackButton";
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { TownRewardBar } from '../town-building/TownRewardBar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { actUfo, fetchUfo, startUfo, type UfoAction, type UfoSettings, type UfoState } from '../../api/ufo';
import { useFamilyStore } from '../../stores/familyStore';
import { useProfileStore } from '../../stores/profileStore';
import { familyQueryKey } from '../../lib/familyQueries';
import { UfoSetup } from './UfoSetup';
import { UfoScene } from './UfoScene';
import { UfoWordPanel } from './UfoWordPanel';
import { BadgeLogo } from './UfoArt';
import { ufoText, guessKey, VIETNAMESE_LETTERS, ENGLISH_LETTERS } from './letters';
import { playUfoSound } from './sound';
import { getUiLanguage } from '../../lib/uiLanguage';
import './ufo.css';
export function UfoPage() {
  useUiLanguage();
  const profileId = useProfileStore(s => s.activeProfileId);
  const family = useFamilyStore(s => s.familyId);
  return profileId ? <Game key={`${family}:${profileId}`} profileId={profileId} /> : null;
}
function Game({ profileId }: { profileId: string }) {
  useUiLanguage();

  const [state, setState] = useState<UfoState | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [mode, setMode] = useState<'resume' | 'setup' | 'play'>('resume');

  const [tick, setTick] = useState(0), [lastInput, setLastInput] = useState(Date.now()), [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('ufo-muted') === 'true';
    } catch {
      return false;
    }
  }), [newBadges, setNewBadges] = useState<UfoState['achievements']>([]);

  const [language, setLanguage] = useState<'en' | 'vi'>('en');
  const t = (en: string, vi: string) => ufoText(getUiLanguage(), en, vi);
  const inFlight = useRef(false), alive = useRef(true), shooAt = useRef(0);

  const queryClient = useQueryClient(), familyId = useFamilyStore(s => s.familyId);

  useEffect(() => {
    alive.current = true;
    let current = true;
    void fetchUfo(profileId).then(s => {
      if (current) {
        setState(s); setLanguage(s.session?.language ?? 'en');
        setMode(s.session ? 'resume' : 'setup');
      }
    }).catch(e => {
      if (current)
        setError(e.message);
    }).finally(() => {
      if (current)
        setLoading(false);
    });
    return () => {
      current = false;
      alive.current = false;
    };
  }, [profileId]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  const wake = () => setLastInput(Date.now());

  const send = useCallback(async (action: UfoAction | { settings: UfoSettings }) => {

    if (!state || inFlight.current)
      return;

    if ('type' in action && action.type === 'shoo') {
      if (Date.now() - shooAt.current < 500)
        return;
      shooAt.current = Date.now();
    }

    inFlight.current = true;
    setBusy(true);
    setError('');
    setLastInput(Date.now());

    try {

      const next = 'settings' in action ? await startUfo(profileId, state.revision, action.settings) : await actUfo(profileId, state.revision, action);

      if (!alive.current)
        return;

      setNewBadges(next.achievements.filter(a => a.earned && !state.achievements.some(old => old.id === a.id && old.earned)));

      setState(next); setLanguage(next.session?.language ?? 'en');
      setMode('play');
      queryClient.setQueryData(familyQueryKey('ufo', familyId, profileId), next);

      if (!muted && 'type' in action) {
        const kind = next.session?.status === 'captured' ? 'capture' : next.session?.status === 'solved' ? 'win' : action.type === 'shoo' ? 'shoo' : next.session!.danger > (state.session?.danger ?? 0) ? 'wrong' : 'good';
        if (action.type !== 'next')
          playUfoSound(kind);
      }

    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : 'Could not save your game. Try again.');
    }
    finally {
      inFlight.current = false;
      if (alive.current)
        setBusy(false);
    }

  }, [state, profileId, queryClient, familyId, muted]);

  const session = state?.session;

  useEffect(() => {
    if (mode !== 'play' || session?.status !== 'solved')
      return;
    const timer = setTimeout(() => void send({ type: 'next' }), Math.max(0, (session.celebrationEndsAt ?? 0) - Date.now()) + 150);
    return () => clearTimeout(timer);
  }, [session?.status, session?.celebrationEndsAt, state?.revision, mode, send]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || e.repeat || e.altKey || e.ctrlKey || e.metaKey || mode !== 'play' || session?.status !== 'playing')
        return;
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable=true]'))
        return;
      const letter = guessKey(e.key.toUpperCase());
      if (letter.length === 1 && (session.language === 'vi' ? VIETNAMESE_LETTERS : ENGLISH_LETTERS).includes(letter) && !session.guessed.includes(letter)) {
        e.preventDefault();
        void send({ type: 'guess', letter });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [session, mode, send]);

  const asleep = Date.now() - lastInput > 15000 && session?.status === 'playing';

  async function reload() {
    setError('');
    setLoading(true);
    try {
      const next = await fetchUfo(profileId);
      setState(next); setLanguage(next.session?.language ?? 'en');
      setMode(next.session ? 'resume' : 'setup');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggleMute() {
    setMuted(v => {
      try {
        localStorage.setItem('ufo-muted', String(!v));
      } catch {
      }
      return !v;
    });
  }

  return <main className="ufo-page" onPointerDown={wake} onKeyDown={wake}>
    <nav className="ufo-nav kid-nav" aria-label={uiText("Game navigation")}>
      <KidBackButton/>
      <div>
        <TownRewardBar reward={state?.townReward} event={state?.revision}/>
        <MinigameBadgesButton groupIds={['shoo-shoo-ufo']} disabled={busy} />
        <button className="kid-nav-action" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? t('Turn sound on', 'Bật âm thanh') : t('Mute sound', 'Tắt âm thanh')}>{muted ? t('🔇 Sound off', '🔇 Âm thanh tắt') : t('🔈 Sound on', '🔈 Âm thanh bật')}</button>
      </div>
    </nav>
    {error && <div className="ufo-error" role="alert">{error}
      <button onClick={() => void reload()} disabled={busy}>{t('Reload saved game', 'Tải lại trò chơi')}</button>
    </div>}
    {loading ? <p role="status" className="ufo-loading">{t('Getting your animal friends ready…', 'Đang chuẩn bị bạn động vật…')}</p> : !state ? <button onClick={() => void reload()}>{t('Try again', 'Thử lại')}</button> : mode === 'resume' && session ? <section className="ufo-resume">
      <p className="ufo-eyebrow">{t('Your friend is waiting', 'Bạn của em đang chờ')}</p>
      <h1>{t('Welcome back!', 'Chào mừng trở lại!')}</h1>
      <UfoScene session={session} asleep={false} tick={tick} />
      <p>{session.difficulty} · {session.solved} {t('words solved', 'từ đã đoán')} · {10 - session.danger} {t('steps left', 'bước còn lại')}</p>
      <button className="ufo-primary" onClick={() => {
        setMode('play');
        wake();
      }}>{t('Resume', 'Chơi tiếp')}</button>
      <button className="ufo-secondary" onClick={() => setMode('setup')}>{t('Start fresh', 'Chơi mới')}</button>
    </section> : mode === 'setup' ? <UfoSetup initialLanguage={language} onLanguageChange={setLanguage} busy={busy} onStart={settings => void send({ settings })} {...(session ? { onCancel: () => { setLanguage(session.language ?? 'en'); setMode('resume'); } } : {})} /> : session ? <section className="ufo-play">
      <header className="ufo-game-header">
        <div>
          <p className="ufo-eyebrow">{t(session.difficulty, session.difficulty === 'easy' ? 'Dễ' : session.difficulty === 'medium' ? 'Vừa' : 'Khó')} · {t(session.background, session.background === 'farm' ? 'Nông trại' : session.background === 'forest' ? 'Rừng' : 'Hồ')}</p>
          <h1>Shoo Shoo UFO</h1>
        </div>
        <div className="ufo-session-score">
          <strong>{session.solved}</strong>
          <span>{t('words solved', 'từ đã đoán')}</span>
        </div>
      </header>

      <UfoScene session={session} asleep={asleep} tick={tick} interactive onPet={wake} />

      <div className="ufo-danger" aria-label={`${10 - session.danger} ${t('steps before a space trip', 'bước trước chuyến đi vũ trụ')}`}>
        <span>{t('UFO steps', 'Bước UFO')}</span>
        <div>{Array.from({ length: 10 }, (_, i) => <span key={i} className={i < session.danger ? 'filled' : ''} />)}</div>
        <strong>{session.danger}/10</strong>
      </div>

      <UfoWordPanel session={session} busy={busy} error={error} onAction={action => void send(action)} onRestart={() => void send({settings:{language:session.language ?? 'en',difficulty:session.difficulty,animal:session.animal,background:session.background}})} />
      {newBadges.length > 0 && <div className="ufo-new-badges" role="status">{newBadges.map(a => <div key={a.id}>
        <BadgeLogo index={a.logo} size={60} />
        <span>{t('Achievement unlocked!', 'Nhận được huy hiệu!')}
          <strong>{uiText(a.name)}</strong>
        </span>
      </div>)}</div>}
      <button className="ufo-new-session" disabled={busy} onClick={() => setMode('setup')}>{t('Start a new session', 'Bắt đầu trò chơi mới')}</button>
    </section> : null}
  </main>;

}
