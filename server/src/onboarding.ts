import { z } from 'zod';
import type { App } from './contracts/app.js';
import type { AppDatabase } from './contracts/db.js';
import type { AppConfig } from './config.js';
import { parseJson } from './input.js';

const emptyAction = z.object({}).strict();
/** Tutorial state is family-owned; it never grants access or awards progress. */
export function registerOnboardingRoutes(app: App, db: AppDatabase, config: AppConfig) {
  app.get('/api/v1/family/onboarding', async c => {
    const family = c.get('family');
    const [children, passkeys, requests] = await Promise.all([
      db.profiles.count(family.id), db.auth.listPasskeys(family.id), db.friendRequests.list(family.id, 500),
    ]);
    return c.json({ dismissed: family.onboardingDismissed !== false, child_created: children > 0,
      parent_visited: family.onboardingParentVisited === true,
      friend_request_created: requests.some(request => request.requesting_family_id === family.id && (request.status === 'pending' || request.status === 'accepted')),
      passkey_created: passkeys.length > 0,
      passkeys_enabled: !!config.webauthn });
  });
  app.post('/api/v1/family/onboarding/dismiss', async c => {
    await parseJson(c.req.raw, emptyAction, config.maxBodyBytes);
    await db.auth.updateOnboarding(c.get('family').id, 'dismiss');
    return c.json({ dismissed: true });
  });
  // The normal /parent middleware requires a current server-verified capability.
  app.post('/api/v1/parent/onboarding/visit', async c => {
    await parseJson(c.req.raw, emptyAction, config.maxBodyBytes);
    await db.auth.updateOnboarding(c.get('family').id, 'visit');
    return c.json({ parent_visited: true });
  });
}
