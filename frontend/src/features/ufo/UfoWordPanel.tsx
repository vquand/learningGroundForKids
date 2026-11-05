import { useUiLanguage } from '../../hooks/useUiLanguage';
import { TTSButton } from "../../components/ItemDetail/TTSButton";
import { ufoText, guessKey, ENGLISH_LETTERS, VIETNAMESE_LETTERS } from './letters';
import { getUiLanguage } from '../../lib/uiLanguage';
import type { UfoAction, UfoState } from '../../api/ufo';
export function UfoWordPanel({ session, busy, error, onAction, onRestart }: {
  session: NonNullable<UfoState['session']>;
  busy: boolean;
  error: string;
  onAction: (action: UfoAction) => void;
  onRestart: () => void;
}) {
  useUiLanguage();

  const t = (en: string, vi: string) => ufoText(getUiLanguage(), en, vi);
  return (
    <div className="ufo-word-panel">
      {session.status === 'playing' ? <>
        <div className="ufo-clue">
          <span className="ufo-clue__label">{t('Clue', 'Gợi ý')}</span>
          <div className="ufo-clue__row"><TTSButton text={session.clue} lang={session.language ?? 'en'} />
          <span className="ufo-clue__content" lang={session.language ?? 'en'}>{session.clue}</span></div></div>

        <div className="ufo-letters" aria-label={session.letters.map(l => l === '_' ? 'blank' : l).join(' ')}>{session.letters.map((l, i) => <span key={i} className={l === ' ' ? 'word-space' : l === '_' ? 'blank' : ''}>{l === '_' ? '' : l}</span>)}</div>

        <div className="ufo-controls">
          <button className="ufo-hint" disabled={busy || !session.hints} onClick={() => onAction({ type: 'hint' })}>💡 {t('Reveal a letter', 'Mở một chữ')}
            <span>{session.hints} {t('left', 'lượt')}</span>
          </button>

          <button className="ufo-shoo" disabled={busy || !session.charges || !session.danger || Date.now() < session.shooReadyAt} onKeyDown={e => {

            if (e.repeat)
              e.preventDefault();

          }} onClick={() => onAction({ type: 'shoo' })}>{t('Shoo shoo UFO!', 'UFO ơi, đi đi!')}
            <span>{'★'.repeat(session.charges)}{'☆'.repeat(3 - session.charges)}</span>
          </button>
        </div>

        <div className="ufo-keyboard" aria-label={t('Letter keyboard', 'Bàn phím chữ cái')}>{[...(session.language === 'vi' ? VIETNAMESE_LETTERS : ENGLISH_LETTERS)].map(letter => <button key={letter} disabled={busy || session.guessed.includes(letter)} aria-label={`${letter}${session.guessed.includes(letter) ? session.letters.some(value => guessKey(value) === letter) ? t(', correct guess', ', đoán đúng') : t(', incorrect guess', ', đoán sai') : ''}`} className={session.guessed.includes(letter) ? session.letters.some(value => guessKey(value) === letter) ? 'correct' : 'incorrect' : ''} onClick={() => onAction({ type: 'guess', letter })}>{letter}</button>)}</div>

        <p className="ufo-small">{t('Each letter reveals every matching spot.', 'Mỗi chữ mở tất cả ô tương ứng, kèm dấu thanh.')}</p>
      </> : <div className="ufo-result" role="status">
        <p className="ufo-eyebrow">{session.status === 'solved' ? t('You found it! +1 shoo charge', 'Đúng rồi! Thêm 1 lượt xua UFO') : t('A little space trip', 'Chuyến đi vào vũ trụ')}</p>

        <h2 lang={session.language ?? 'en'}>{session.answer}</h2>

        <p lang={session.language ?? 'en'}>{session.definition}</p>
        {session.status === 'solved' ? <>
          <p>{t('Next word in', 'Từ tiếp theo sau')} {Math.max(0, Math.ceil(((session.celebrationEndsAt ?? 0) - Date.now()) / 1000))}…</p>
          {error && <button onClick={() => onAction({ type: 'next' })} disabled={busy}>{t('Next word', 'Từ tiếp theo')}</button>}</> : <>
          <p>{t('Let’s bring our friend back!', 'Đưa bạn của mình về nào!')}</p>

          <button className="ufo-primary" disabled={busy} onClick={() => onRestart()}>{t('Play again', 'Chơi lại')}</button>
        </>}</div>}
    </div>
  );

}
