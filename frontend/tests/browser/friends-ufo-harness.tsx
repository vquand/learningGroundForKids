import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FriendRequestDecisionModal } from '../../src/components/ProfilePicker/FriendRequestDecisionModal';
import { FriendRequestModal } from '../../src/components/ProfilePicker/FriendRequestModal';
import { UfoPage } from '../../src/features/ufo/UfoPage';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { useState } from 'react';
import '../../src/app.css';
const params = new URLSearchParams(location.search);
const profiles = params.has('empty') ? [] : [{ id: 'kid-a', name: 'Mun', emoji: '🐮', color: '#aabbcc', created_at: '', total_done: 0, badge_count: 0 }];
function Friends() {
  const [sent, setSent] = useState('');
  if (params.has('accept')) return <><FriendRequestDecisionModal request={{ id: 'request-a', requesting_family_id: 'other', requesting_scope: 'profile', requesting_profile_id: 'other-kid', requesting_label: 'An', target_family_id: 'family-a', target_scope: 'profile', target_profile_id: 'kid-a', target_label: 'Mun', target_code: 'ABC-1234', requester_message: 'An wants to be your friend.', status: 'pending', created_at: '', responded_at: null, responded_by_family_id: null }} onClose={() => {}} onAccept={() => setSent('accepted')} onReject={() => setSent('declined')} isSubmitting={false} errorMessage={null} /><output data-testid="sent">{sent}</output></>;
  return <><FriendRequestModal profiles={profiles} requireQuiz={!params.has('parent')} isSubmitting={false} errorMessage={null} onClose={() => {}} onSubmit={input => setSent(JSON.stringify(input))} /><output data-testid="sent">{sent}</output></>;
}
useFamilyStore.setState({ familyId: 'family-a', sessionGeneration: 1, isInitializing: false });
useProfileStore.setState({ activeProfileId: 'kid-a' });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{params.has('ufo') ? <UfoPage /> : <Friends />}</MemoryRouter></QueryClientProvider>);
