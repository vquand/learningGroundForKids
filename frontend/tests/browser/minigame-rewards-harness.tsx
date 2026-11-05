import {AdventureJournal} from '../../src/components/Adventures/AdventureJournal';
import {useUiLanguage} from '../../src/hooks/useUiLanguage';
import {uiText} from '../../src/i18n/uiText';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MathWallPage } from '../../src/features/math-quiz-wall/MathWallPage';
import { CabbageRollPage } from '../../src/features/cooking/cabbage-rolls/CabbageRollPage';
import { RacingPage } from '../../src/features/animal-racing/RacingPage';
import { TownRewardBar } from '../../src/features/town-building/TownRewardBar';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import type { Cost } from '../../../server/src/town-building/game';
import '../../src/app.css';

function JournalPreview() {
  useUiLanguage();
  const [open,setOpen]=useState(false);
  return <main><button onClick={()=>setOpen(true)}>{uiText('Latest Adventures')}</button>{open&&<AdventureJournal profileId="profile-a" onClose={()=>setOpen(false)}/>}</main>;
}
function Receipts() {
  const [receipt, setReceipt] = useState<{event: number; reward: Cost}>({event: 5, reward: {wood: 3, wool: 3}});
  const [mounted, setMounted] = useState(true);
  return <main style={{height: '100dvh', display: 'flex', flexDirection: 'column'}}>
    <header className="kid-nav" style={{display: 'flex'}}>{mounted && <TownRewardBar {...receipt} source=".receipt-scene"/>}</header>
    <section className="receipt-scene" style={{flex: 1, background: '#e1ecd5', display: 'grid', placeItems: 'center'}}>
      <h1>Resource receipt fixture</h1>
      <button onClick={() => setReceipt(r => ({event: r.event + 1, reward: {wood: 3, wool: 5}}))}>Award resources</button>
      <button onClick={() => setReceipt(r => ({...r, reward: {...r.reward}}))}>Repeat same receipt</button>
      <button onClick={() => setReceipt(r => ({event: r.event + 1, reward: {wood: 0, wool: 0}}))}>Zero reward</button>
      <button onClick={() => setMounted(false)}>Unmount storage</button>
    </section>
  </main>;
}
useFamilyStore.setState({familyId: 'family-a', sessionGeneration: 1, isInitializing: false});
useProfileStore.setState({activeProfileId: 'profile-a'});
const mode = new URLSearchParams(location.search).get('game') ?? 'receipts';
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
  <MemoryRouter initialEntries={[`/${mode}`]}><LanguageSwitcher/><Routes>
    <Route path="/journal" element={<JournalPreview/>}/><Route path="/cabbage" element={<CabbageRollPage/>}/><Route path="/receipts" element={<Receipts/>}/><Route path="/waddle" element={<MathWallPage/>}/><Route path="/racing" element={<RacingPage/>}/>
    <Route path="/town-building" element={<h1>Town storage</h1>}/>
  </Routes></MemoryRouter>
</QueryClientProvider>);
