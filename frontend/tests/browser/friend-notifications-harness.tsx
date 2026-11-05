import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {MemoryRouter} from 'react-router-dom';
import {FriendNotificationList} from '../../src/components/ProfilePicker/FriendNotificationList';
import {LanguageSwitcher} from '../../src/components/LanguageSwitcher/LanguageSwitcher';
import type {FriendRequest} from '../../src/types/social';
import '../../src/app.css';
const make=(id:string,overrides:Partial<FriendRequest>):FriendRequest=>({id,requesting_family_id:'other',target_family_id:'home',requesting_scope:'profile',target_scope:'profile',requesting_profile_id:'other-child',target_profile_id:'child',requesting_label:'Mina only',target_label:'Theo only',target_code:'PRIVATE-CODE',requester_message:'PRIVATE LONG LEGACY REQUEST',created_at:'2026-10-24T00:00:00Z',responded_at:null,responded_by_family_id:null,status:'pending',requesting_party:{name:'Mina Nguyễn With a Very Long Name',emoji:'🐱',avatar_type:'default',avatar_url:'capybara-calm'},target_party:{name:'Theo Long Family Name',emoji:'🐰',avatar_type:'default',avatar_url:'capybara-brave'},...overrides});
function Fixture(){
 const [requests,setRequests]=useState([
  make('pending',{created_at:'2026-10-25T00:00:00Z'}),
  make('accepted',{status:'accepted',responded_at:'2026-10-24T20:00:00Z'}),
  make('family',{requesting_scope:'family',requesting_profile_id:null,requesting_party:{name:'The Willow family'},created_at:'2026-10-23T00:00:00Z'}),
  make('old',{status:'cancelled',created_at:'2026-10-22T00:00:00Z'}),
 ]);
 const respond=(request:FriendRequest,accept:boolean)=>setRequests(values=>values.map(r=>r.id===request.id?{...r,status:accept?'accepted':'rejected',responded_at:'2026-10-26T00:00:00Z'}:r));
 return <main style={{minHeight:'100dvh',background:'#fff6e1',padding:'100px 16px 16px',display:'flex',justifyContent:'center',alignItems:'flex-start'}}><LanguageSwitcher/><FriendNotificationList requests={requests} profiles={[]} familyId="home" responding={false} onAccept={r=>respond(r,true)} onReject={r=>respond(r,false)}/></main>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><Fixture/></MemoryRouter>);
