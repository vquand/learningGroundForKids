// Isolated UI preview: synthetic session plus fixture API, never real accounts.
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {BrowserRouter} from 'react-router-dom';
import {TownMapScreen} from '../../src/features/town-building/TownMapScreen';
import {LanguageSwitcher} from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import {useFamilyStore} from '../../src/stores/familyStore';
import {useProfileStore} from '../../src/stores/profileStore';
import '../../src/app.css';
useFamilyStore.setState({familyId:'fixture-family',sessionGeneration:1,isInitializing:false});
useProfileStore.setState({activeProfileId:'fixture-viewer'});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BrowserRouter><LanguageSwitcher/><TownMapScreen/></BrowserRouter></QueryClientProvider>);
