import {useMemo} from 'react';
import {useLocation} from 'react-router-dom';
import {useFamilyStore} from '../../stores/familyStore';
import {useProfileStore} from '../../stores/profileStore';
import {TownMapHost} from './TownMapLayout';
import {TownBuildingPage} from './TownBuildingPage';
import {LakePage} from './maps/lake/LakePage';
import {TownVisitView} from './TownVisitView';
import {LakeVisitPage} from './maps/lake/LakeVisitPage';
import {TownRelaxingView} from './TownRelaxingView';

export function TownMapScreen(){
    const id=useProfileStore(s=>s.activeProfileId)!,family=useFamilyStore(s=>s.familyId),generation=useFamilyStore(s=>s.sessionGeneration);
    return <TownMapSession key={`${generation}:${family}:${id}`} profileId={id}/>;
}
function TownMapSession({profileId}:{profileId:string}){
    const location=useLocation(),family=useFamilyStore(s=>s.familyId),friendId=new URLSearchParams(location.search).get('visit'),lake=location.pathname.endsWith('/lake'),ownerId=/\/lake\/visit\/([^/]+)$/.exec(location.pathname)?.[1];
    // Stable controller element: publishing a new snapshot never remounts the screen.
    const controller=useMemo(()=>ownerId?<LakeVisitPage key={ownerId} ownerId={decodeURIComponent(ownerId)}/>:lake?<LakePage/>:<TownBuildingPage/>,[lake,ownerId]);
    return <TownRelaxingView>{friendId?<TownVisitView key={friendId} viewerId={profileId} family={family} friendId={friendId}/>:<TownMapHost profileId={profileId}>{controller}</TownMapHost>}</TownRelaxingView>;
}
