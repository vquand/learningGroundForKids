import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {TownAchievements} from '../../src/features/town-building/TownAchievements';
import {AdminAchievementsPage} from '../../src/pages/admin/AdminAchievementsPage';
import {ParentAchievements} from '../../src/features/parent/ParentReportViews';
import {AdminChildLearning} from '../../src/components/admin/AdminFamilyLearning';
import {adminFetchFamilyReports} from '../../src/api/admin';
import {useFamilyStore} from '../../src/stores/familyStore';
import {bootstrapUiLanguage} from './ui-language-bootstrap';
import '../../src/app.css';
import '../../src/features/parent/parentSpace.css';
await bootstrapUiLanguage();
useFamilyStore.setState({familyId:'family-a',sessionGeneration:1,isInitializing:false});
function AdminReport(){const query=useQuery({queryKey:['admin-halloween-test'],queryFn:()=>adminFetchFamilyReports('family-a')});return query.data?<AdminChildLearning child={query.data.children[0]!}/>:<p>Loading report</p>;}
const mode=location.hash;
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><main className="p-4">
{mode==='#catalog'?<AdminAchievementsPage/>:mode==='#parent'?<ParentAchievements/>:mode==='#admin-report'?<AdminReport/>:<TownAchievements profileId="profile-a"/>}
</main></MemoryRouter></QueryClientProvider>);
