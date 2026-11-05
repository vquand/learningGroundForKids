import { coreRequest } from './core';
export interface FamilyOnboardingStatus {
  dismissed: boolean;
  child_created: boolean;
  parent_visited: boolean;
  friend_request_created: boolean;
  passkey_created: boolean;
  passkeys_enabled: boolean;
}
export const fetchOnboarding = () => coreRequest<FamilyOnboardingStatus>('/api/v1/family/onboarding', { cache: 'no-store' });
export const dismissOnboarding = () => coreRequest('/api/v1/family/onboarding/dismiss', { method: 'POST', body: '{}' });
export const visitParentSpace = () => coreRequest('/api/v1/parent/onboarding/visit', { method: 'POST', body: '{}' });
