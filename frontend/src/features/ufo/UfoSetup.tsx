import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { ufoText } from './letters';
import { getUiLanguage } from '../../lib/uiLanguage';
import { useState } from 'react';
import type { UfoSettings } from '../../api/ufo';
import { AnimalSprite, ANIMALS } from './UfoArt';
export function UfoSetup({ busy, onStart, onCancel, initialLanguage = 'en', onLanguageChange }: { busy: boolean; onStart: (s: UfoSettings) => void; onCancel?: () => void; initialLanguage?: 'en' | 'vi'; onLanguageChange?: (language: 'en' | 'vi') => void }) {
  useUiLanguage();

  const [settings, setSettings] = useState<UfoSettings>({ language: initialLanguage, difficulty: 'easy', animal: 'cow', background: 'farm' });

  const t = (en: string, vi: string) => ufoText(getUiLanguage(), en, vi);
  return <section className="ufo-setup">
    <p className="ufo-eyebrow">{t('A little word adventure', 'Chuyến phiêu lưu cùng chữ cái')}</p>
    <h1>Shoo Shoo UFO</h1>
    <p>{t('Guess letters and shoo the UFO away.', 'Đoán chữ và xua chiếc UFO đi!')}</p>
    <fieldset disabled={busy}><legend>{t('Learning language', 'Ngôn ngữ học')}</legend><div className="ufo-choice-row ufo-language">{(['en', 'vi'] as const).map(language => <button key={language} type="button" aria-label={language === 'en' ? uiText("English") : 'Tiếng Việt'} aria-pressed={settings.language === language} onClick={() => { setSettings({ ...settings, language }); onLanguageChange?.(language); }}><span className={`ufo-country-ball ${language}`} aria-hidden="true" /></button>)}</div></fieldset>

    <fieldset disabled={busy}>
      <legend>{t('Challenge', 'Độ khó')}</legend>
      <div className="ufo-choice-row">{([{ id: 'easy', icon: '🥚', name: 'Easy', detail: 'Everyday words · 2 hints' }, { id: 'medium', icon: '🐣', name: 'Medium', detail: 'Curious words · 1 hint' }, { id: 'hard', icon: '🐔', name: 'Hard', detail: 'Uncommon words · 1 hint' }] as const).map(d => <button key={d.id} aria-pressed={settings.difficulty === d.id} onClick={() => setSettings({ ...settings, difficulty: d.id })}>
        <span className="ufo-difficulty-icon" aria-hidden="true">{d.icon}</span>
        <strong>{t(d.name, d.id === 'easy' ? 'Dễ' : d.id === 'medium' ? 'Vừa' : 'Khó')}</strong>
        <small>{t(d.detail, d.id === 'easy' ? 'Từ quen thuộc · 2 gợi ý' : d.id === 'medium' ? 'Từ thú vị · 1 gợi ý' : 'Từ mới lạ · 1 gợi ý')}</small>
      </button>)}</div>
    </fieldset>

    <fieldset disabled={busy}>
      <legend>{t('Animal friend', 'Bạn động vật')}</legend>
      <div className="ufo-choice-row ufo-friends">{ANIMALS.map(a => <button key={a.id} aria-pressed={settings.animal === a.id} onClick={() => setSettings({ ...settings, animal: a.id })}>
        <AnimalSprite animal={a.id} />
        <strong>{t(a.name, ({ cow: 'Bò sữa', highland: 'Bò lông dài', sheep: 'Cừu', capybara: 'Chuột lang nước' })[a.id])}</strong>
      </button>)}</div>
    </fieldset>

    <fieldset disabled={busy}>
      <legend>{t('Cozy place', 'Nơi vui chơi')}</legend>
      <div className="ufo-choice-row">{(['farm', 'forest', 'lake'] as const).map((bg, i) => <button key={bg} aria-pressed={settings.background === bg} onClick={() => setSettings({ ...settings, background: bg })}>
        <span className="ufo-background-preview" style={{ backgroundPosition: `center ${i * 50}%` }} />
        <strong>{bg === 'farm' ? t('Farmhouse', 'Nông trại') : bg === 'forest' ? t('Forest', 'Rừng') : t('Lake', 'Hồ')}</strong>
      </button>)}</div>
    </fieldset>

    <p className="ufo-rules">{t('No timer. Take your time!', 'Không tính giờ. Cứ từ từ nhé!')}</p>
    <div className="ufo-setup-actions"><button className="ufo-primary" disabled={busy} onClick={() => onStart(settings)}>{busy ? t('Getting ready…', 'Đang chuẩn bị…') : t('Let’s play!', 'Chơi nào!')}</button>
    {onCancel && <button className="ufo-secondary" disabled={busy} onClick={onCancel}>{t('Keep my saved game', 'Giữ trò chơi đã lưu')}</button>}</div>

  </section>;

}
