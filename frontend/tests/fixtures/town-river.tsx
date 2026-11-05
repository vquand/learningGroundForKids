// Isolated synthetic-session fixture, never used by production routes or accounts.
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {BrowserRouter} from 'react-router-dom';
import {TownMapScreen} from '../../src/features/town-building/TownMapScreen';
import {LanguageSwitcher} from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import {useFamilyStore} from '../../src/stores/familyStore';
import {useProfileStore} from '../../src/stores/profileStore';
import {bootstrapUiLanguage} from '../browser/ui-language-bootstrap';
import '../../src/app.css';
let generation=0;
function select(role:'owner'|'visitor',navigate=true){
 sessionStorage.setItem('river-fixture-role',role);
 if(navigate){history.replaceState({},'',role==='owner'?'/tests/fixtures/town-river.html':'/tests/fixtures/town-river.html?visit=owner-kid');window.dispatchEvent(new PopStateEvent('popstate'));}
 useFamilyStore.setState({familyId:'fixture-'+role,sessionGeneration:++generation,isInitializing:false});
 useProfileStore.setState({activeProfileId:role+'-kid'});
}
select(sessionStorage.getItem('river-fixture-role')==='owner'?'owner':'visitor',false);
Object.assign(window,{riverFixtureSwitch:select});await bootstrapUiLanguage();
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BrowserRouter><LanguageSwitcher/><TownMapScreen/></BrowserRouter></QueryClientProvider>);
