import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { UfoWordPanel } from '../../src/features/ufo/UfoWordPanel';
import { UfoScene } from '../../src/features/ufo/UfoScene';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import { useUiLanguage } from '../../src/hooks/useUiLanguage';
import { uiText } from '../../src/i18n/uiText';
import type { UfoState } from '../../src/api/ufo';
import { bootstrapUiLanguage } from './ui-language-bootstrap';
import '../../src/app.css';
import '../../src/features/ufo/ufo.css';
await bootstrapUiLanguage();
function Harness() {
  useUiLanguage();
  const [session, setSession] = useState<NonNullable<UfoState['session']>>({language:'en',difficulty:'easy',animal:'cow',background:'farm',guessed:['R','Z'],hints:2,danger:1,charges:3,solved:1,status:'playing',clue:'A place for people and cars.',letters:['R','_','_','_'],answer:null,definition:null,celebrationEndsAt:null,shooReadyAt:0});
  return <MemoryRouter><LanguageSwitcher/><main className="ufo-page"><nav className="ufo-nav"><a href="#">{uiText('Playground')}</a><span>{uiText('Achievements')}</span></nav><section className="ufo-play"><header className="ufo-game-header"><h1>Shoo Shoo UFO</h1></header><UfoScene session={session} asleep={false} tick={0}/><div className="ufo-danger">1 / 10</div><UfoWordPanel session={session} busy={false} error="" onAction={action=>{if(action.type==='guess')setSession(previous=>({...previous,guessed:[...previous.guessed,action.letter]}));}} onRestart={()=>{}}/><button className="ufo-new-session" onClick={()=>setSession(previous=>({...previous,language:'vi',clue:'Lối để người và xe đi lại.',letters:['Đ','_','_','_','_','_']}))}>Vietnamese puzzle fixture</button></section></main></MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
