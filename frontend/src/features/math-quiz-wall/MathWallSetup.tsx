import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { MathAnimal, MathLanguage, WallStyle } from '../../api/mathWall';
import { AnimalSprite2D } from './AnimalSprite2D';
import { getUiLanguage } from '../../lib/uiLanguage';

export const wallNames = {
  brick: ['Brick wall', 'Tường gạch'], blocks: ['Block wall', 'Tường khối'],
  stone: ['European stone', 'Đá châu Âu'], garden: ['Vietnamese garden fence', 'Hàng rào vườn Việt'],
};
export function MathWallSetup({ animal, setAnimal, wall, setWall, language, setLanguage, onStart, pending }: {
  animal: MathAnimal; setAnimal: (animal: MathAnimal) => void; wall: WallStyle; setWall: (wall: WallStyle) => void;
  language: MathLanguage | null; setLanguage: (language: MathLanguage) => void; onStart: () => void; pending: boolean;
}) {
  useUiLanguage();
  const vi = getUiLanguage() === 'vi';
  return <section className="math-setup" aria-labelledby="math-setup-title">
    <p className="math-eyebrow">{vi ? 'TOÁN NHỎ · TRÁI TIM TO' : uiText("LITTLE SUMS · BIG HEARTS")}</p>
    <h1 id="math-setup-title">{vi ? 'Lắc Lư Vượt Tường' : uiText("Waddle Wall")}</h1>
    <p className="math-intro">{vi ? 'Chọn đáp án, lắc lư sang làn đúng. Vượt tường hoặc ùm xuống nước!' : uiText("Pick an answer. Waddle into place. Through the wall… or into the pool!")}</p>
    <fieldset className="math-languages"><legend>{vi ? 'Chọn ngôn ngữ học' : uiText("Choose your learning language")}</legend>
      {(['en', 'vi'] as const).map(lang => <button key={lang} type="button" aria-label={lang === 'en' ? uiText("English") : 'Tiếng Việt'} aria-pressed={language === lang} onClick={() => setLanguage(lang)}>
        <span className={`math-country-ball ${lang}`} aria-hidden="true" />
      </button>)}
    </fieldset>
    <fieldset><legend>{vi ? 'Chọn bạn nhỏ' : uiText("Choose your buddy")}</legend><div className="math-buddy-options">
      {(['capybara', 'cow', 'highland'] as const).map((id, i) => <button key={id} type="button" aria-pressed={animal === id} onClick={() => setAnimal(id)}>
        <span aria-hidden="true"><AnimalSprite2D animal={id} /></span><span>{(vi ? [uiText("Capybara"), 'Bò sữa', 'Bò cao nguyên'] : [uiText("Capybara"), uiText("Dairy cow"), uiText("Highland cow")])[i]}</span>
      </button>)}
    </div></fieldset>
    <fieldset><legend>{vi ? 'Chọn bức tường' : uiText("Choose your wall")}</legend><div className="math-wall-options">
      {(Object.keys(wallNames) as WallStyle[]).map(id => <button key={id} type="button" aria-pressed={wall === id} onClick={() => setWall(id)}>
        <span className={`math-wall-swatch ${id}`} aria-hidden="true" /><span>{wallNames[id][vi ? 1 : 0]}</span>
      </button>)}
    </div></fieldset>
    <p className="math-instructions">{vi ? 'Chạm vào làn hoặc nhấn 1 · 2 · 3 trên bàn phím.' : uiText("Tap a lane or press 1 · 2 · 3 on your keyboard.")}</p>
    <button className="math-primary" type="button" disabled={!language || pending} onClick={onStart}>{pending ? vi ? 'Đang chuẩn bị…' : uiText("Getting ready…") : vi ? 'Chơi thôi! →' : uiText("Let’s waddle! →")}</button>
    {!language && <p className="math-language-reminder">{vi ? 'Chọn cờ để bắt đầu' : uiText("Choose a flag to start")}</p>}
  </section>;
}
