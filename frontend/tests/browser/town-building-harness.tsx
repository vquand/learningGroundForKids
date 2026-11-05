import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { TownMapScreen } from '../../src/features/town-building/TownMapScreen';
import { FoodAndDrinkPage } from '../../src/features/food-and-drink/FoodAndDrinkPage';
import { useFamilyStore } from '../../src/stores/familyStore';
import {familyQueryKey} from '../../src/lib/familyQueries';
import { useProfileStore } from '../../src/stores/profileStore';
import { bootstrapUiLanguage } from './ui-language-bootstrap';
import '../../src/app.css';
await bootstrapUiLanguage();
useFamilyStore.setState({familyId:'family-a',sessionGeneration:1,isInitializing:false});
useProfileStore.setState({activeProfileId:'profile-a'});
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
(window as Window&{setTownTestClock:(environment:unknown)=>void}).setTownTestClock=environment=>client.setQueryData(familyQueryKey('town-environment','family-a','profile-a'),environment);
// Simulates a Town update saved from another tab.
(window as Window&{setTownTestState:(state:unknown)=>void}).setTownTestState=state=>client.setQueryData(familyQueryKey('town','family-a','profile-a'),state);
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/town-building']}><Routes><Route path="/town-building/*" element={<TownMapScreen/>}/><Route path="/food-and-drink" element={<FoodAndDrinkPage/>}/><Route path="*" element={<Link to="/town-building">Return to town</Link>}/></Routes></MemoryRouter></QueryClientProvider>);
