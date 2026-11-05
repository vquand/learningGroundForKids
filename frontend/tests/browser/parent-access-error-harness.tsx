import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ParentGate, useParentAccess } from "../../src/components/ParentGate";
import { useFamilyStore } from "../../src/stores/familyStore";

const regression = new URLSearchParams(location.search).has('unlock-refresh-regression');
const fixture = { reads: 0, unlocks: 0, lost: 0, failure: '', elevated: false };
if (regression) {
  Object.assign(window, { __parentGateFixture: fixture });
  window.fetch = async (input, init) => {
    const path = String(input);
    const elevation = { elevated: fixture.elevated, method: fixture.elevated ? 'password' : null, expires_at: fixture.elevated ? new Date(Date.now() + 300_000).toISOString() : null, password_confirmed: fixture.elevated };
    if (path.endsWith('/parent/access/password') && init?.method === 'POST') {
      fixture.unlocks++; fixture.elevated = true;
      return Response.json({ ...elevation, elevated: true, method: 'password', expires_at: new Date(Date.now() + 300_000).toISOString(), password_confirmed: true });
    }
    if (path.endsWith('/parent/access')) {
      fixture.reads++;
      if (fixture.failure) return Response.json({ error: { code: 'FIXTURE_ERROR', message: 'Please try again.' } }, { status: fixture.failure === 'revoked' ? 403 : 503 });
      return Response.json({ ...elevation, passkeys_enabled: true, passkeys_enrolled: false, password_available: true });
    }
    return Response.json({ enabled: false });
  };
}

function RefreshProbe() {
  const { refresh } = useParentAccess();
  return <><div data-testid="parent-children">Parent children loaded</div><button onClick={() => void refresh()}>Refresh parent access</button></>;
}

function Harness() {
  return (
    <ParentGate onAccessLost={() => { if (regression) fixture.lost++; }}>
      <RefreshProbe />
    </ParentGate>
  );
}

useFamilyStore.setState({
  session: { user: { id: "local-dev-admin", email: "admin@example.com", name: "LocalDevAdmin" } },
  familyId: "local-dev-admin",
  familyName: "LocalDevAdmin",
  sessionGeneration: 1,
  isInitializing: false,
});

createRoot(document.getElementById("root")!).render(<MemoryRouter><Harness /></MemoryRouter>);
