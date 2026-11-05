import { DailyQuizPage } from './components/Quiz/DailyQuizPage';
import { RacingPage } from './features/animal-racing/RacingPage';
import { clearParentQueryCache } from './lib/parentQueryCache';
import { uiText } from './i18n/uiText';
import { LanguageSwitcher } from "./components/LanguageSwitcher/LanguageSwitcher";
import { useUiLanguage } from "./hooks/useUiLanguage";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminGate } from "./components/admin/AdminGate";
import { RootPasswordControl } from "./components/admin/RootPasswordControl";
import { AdminNavigation } from "./components/admin/AdminNavigation";
import { FamilyGate, FamilyInitializingScreen } from "./components/FamilyGate";
import { BackendGate } from "./components/BackendGate";
import { GoogleParentSetup } from "./components/GoogleAuth/GoogleParentSetup";
import { FriendRequestNotifications } from "./components/FriendRequestNotifications";
import { ParentGate } from "./components/ParentGate";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { fetchProfiles } from "./api/profiles";
import { useFamilyStore } from "./stores/familyStore";
import { useProfileStore } from "./stores/profileStore";
import { AdventureLockGuard } from "./components/ScheduleLock/AdventureLockGuard";
import { LanguagePrompt } from "./components/LanguagePrompt/LanguagePrompt";
import { useLanguagePromptPending } from "./hooks/useLanguagePromptPending";
import { FamilyLoginPage } from "./pages/FamilyLoginPage";
import { LandingPage } from "./pages/LandingPage";
import {
  clearGoogleSignupIntent,
  hasGoogleSignupIntent,
  setLanguagePromptPending,
} from "./lib/languagePrompt";
import {
  clearPrivateQueryCache,
  familyScopedQuery,
  profileQueryKey,
} from "./lib/familyQueries";

const AchievementsPage = lazy(() =>
  import("./pages/AchievementsPage").then((m) => ({ default: m.AchievementsPage }))
);
const ItemDetailPage = lazy(() => import("./pages/ItemDetailPage").then((m) => ({ default: m.ItemDetailPage })));
const MapPage = lazy(() => import("./pages/MapPage").then((m) => ({ default: m.MapPage })));
const ActivityHubPage = lazy(() => import("./pages/ActivityHubPage").then((m) => ({ default: m.ActivityHubPage })));
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const UatMapPage = import.meta.env.DEV ? lazy(() => import("./pages/UatMapPage").then((m) => ({ default: m.UatMapPage }))) : null;
const FoodAndDrinkPage = lazy(() => import("./features/food-and-drink/FoodAndDrinkPage").then((m) => ({ default: m.FoodAndDrinkPage })));
const CookingMenuPage = lazy(() => import("./features/cooking/CookingMenuPage").then((m) => ({ default: m.CookingMenuPage })));
const CookingPage = lazy(() => import("./features/cooking/CookingPage").then((m) => ({ default: m.CookingPage })));
const CabbageRollPage = lazy(() => import("./features/cooking/cabbage-rolls/CabbageRollPage").then((m) => ({ default: m.CabbageRollPage })));
const BurgerPage = lazy(() => import("./features/cooking/burger/BurgerPage").then((m) => ({ default: m.BurgerPage })));
const ProfilePickerPage = lazy(() => import("./pages/ProfilePickerPage").then((m) => ({ default: m.ProfilePickerPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const BadgeDisplayPage = lazy(() =>
  import("./pages/BadgeDisplayPage").then((m) => ({ default: m.BadgeDisplayPage }))
);
const ParentRoutes = lazy(() => import('./features/parent/ParentRoutes').then(module => ({ default: module.ParentRoutes })));
const AdminDashboardPage = lazy(() =>
  import("./pages/admin/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminContentPage = lazy(() =>
  import("./pages/admin/AdminContentPage").then((m) => ({ default: m.AdminContentPage }))
);
const AdminFamiliesPage = lazy(() =>
  import("./pages/admin/AdminFamiliesPage").then((m) => ({ default: m.AdminFamiliesPage }))
);
const AdminProfilePage = lazy(() =>
  import("./pages/admin/AdminProfilePage").then((m) => ({ default: m.AdminProfilePage }))
);
const AdminItemEditorPage = lazy(() =>
  import("./pages/admin/AdminItemEditorPage").then((m) => ({ default: m.AdminItemEditorPage }))
);
const AdminTestsPage = lazy(() =>
  import("./pages/admin/AdminTestsPage").then((m) => ({ default: m.AdminTestsPage }))
);

const UfoPage = lazy(() => import('./features/ufo/UfoPage').then(m => ({default:m.UfoPage})));
const MathWallPage = lazy(() => import('./features/math-quiz-wall/MathWallPage').then(m => ({default:m.MathWallPage})));
const TownMapScreen = lazy(() => import('./features/town-building/TownMapScreen').then(m => ({ default: m.TownMapScreen })));
const InfinidrillPage = lazy(() => import('./features/infinidrill/InfinidrillPage').then(m => ({ default: m.InfinidrillPage })));
const MinikuPuzzleListPage = lazy(() => import('./features/miniku/MinikuPuzzleListPage').then(m => ({ default: m.MinikuPuzzleListPage })));
const MinikuPage = lazy(() => import('./features/miniku/MinikuPage').then(m => ({ default: m.MinikuPage })));
const FishingPage = lazy(() => import('./features/fishing/FishingPage').then(m => ({ default: m.FishingPage })));
const AdminUfoPage = lazy(() => import('./pages/admin/AdminUfoPage').then(m => ({default:m.AdminUfoPage})));

const queryClient = new QueryClient();

function ProfileGate({ children }: { children: ReactNode }) {
  useUiLanguage();
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const clearProfile = useProfileStore((s) => s.clearProfile);
  const familyId = useFamilyStore((s) => s.familyId);
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: profileQueryKey(familyId),
    queryFn: familyScopedQuery(familyId, fetchProfiles),
    enabled: Boolean(familyId && activeProfileId),
    retry: false,
  });
  const profileExists = profiles.some((profile) => profile.id === activeProfileId);

  useEffect(() => {
    if (activeProfileId && !isLoading && !profileExists) clearProfile();
  }, [activeProfileId, clearProfile, isLoading, profileExists]);

  // A selected child must still belong to the current server-owned family
  // profile list, including after deletion or an account switch.
  if (!activeProfileId || (!isLoading && !profileExists)) {
    return <ProfilePickerPage preserveRoute />;
  }
  return <AdventureLockGuard>{children}</AdventureLockGuard>;
}

function PrivateQueryLifecycle() {
  const queryClient = useQueryClient();
  const sessionGeneration = useFamilyStore((state) => state.sessionGeneration);
  const previousGenerationRef = useRef(sessionGeneration);

  useEffect(() => {
    if (previousGenerationRef.current === sessionGeneration) return;
    previousGenerationRef.current = sessionGeneration;
    void clearPrivateQueryCache(queryClient);
  }, [queryClient, sessionGeneration]);

  return null;
}

function LanguagePromptGate({ children }: { children: ReactNode }) {
  const session = useFamilyStore((state) => state.session);
  const pending = useLanguagePromptPending();

  useEffect(() => {
    const googleError = new URLSearchParams(window.location.search).has("google_error");
    if (!session) {
      if (googleError) clearGoogleSignupIntent();
      return;
    }
    if (!hasGoogleSignupIntent()) return;
    if (session.onboarding) setLanguagePromptPending();
    clearGoogleSignupIntent();
  }, [session]);

  if (session && pending) return <LanguagePrompt />;
  return <>{children}</>;
}

function RootRoute() {
  const session = useFamilyStore((state) => state.session);
  const isInitializing = useFamilyStore((state) => state.isInitializing);
  if (isInitializing) return <FamilyInitializingScreen />;
  if (!session) return <LandingPage />;
  if (session.parentPasswordRequired) return <GoogleParentSetup />;
  return <BackendGate><ProfilePickerPage /></BackendGate>;
}

function LoginRoute() {
  const session = useFamilyStore((state) => state.session);
  const isInitializing = useFamilyStore((state) => state.isInitializing);
  if (isInitializing) return <FamilyInitializingScreen />;
  return session ? <Navigate replace to="/" /> : <FamilyLoginPage />;
}

const AdminAchievementsPage = lazy(() => import("./pages/admin/AdminAchievementsPage").then(m => ({ default: m.AdminAchievementsPage })));

function AdminRoutes() {
  useUiLanguage();
  return (
    <>
    <AdminNavigation />
    <Suspense fallback={<p role="status" className="p-8 text-gray-600">{uiText("Loading admin page...")}</p>}>
    <Routes>
      <Route index element={<AdminDashboardPage />} />
      <Route path="content" element={<AdminContentPage />} />
      <Route path="families" element={<AdminFamiliesPage />} />
      <Route path="families/:familyId" element={<AdminFamiliesPage />} />
      <Route path="families/:familyId/profiles/:profileId" element={<AdminProfilePage />} />
      <Route path="tests" element={<AdminTestsPage />} />
      <Route path="ufo" element={<AdminUfoPage />} />
      <Route path="miniku" element={<MinikuPuzzleListPage admin />} />
      <Route path="achievements" element={<AdminAchievementsPage />} />
      <Route path="profiles" element={<Navigate replace to="/admin/families" />} />
      <Route path="content/new" element={<AdminItemEditorPage />} />
      <Route path="content/:itemId/edit" element={<AdminItemEditorPage />} />
      <Route path="content/:itemId/enrich" element={<AdminItemEditorPage />} />
    </Routes>
    </Suspense>
    </>
  );
}

export function App() {
  useUiLanguage();
  const initSession = useFamilyStore((s) => s.initSession);
  const isLocalUatRoute = import.meta.env.DEV
    && (window.location.pathname === "/uat" || window.location.pathname.startsWith("/uat/"));

  useEffect(() => {
    if (!isLocalUatRoute) void initSession();
  }, [initSession, isLocalUatRoute]);

  const loadingFallback = (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <span className="text-5xl">🗺️</span>
        <p className="text-lg text-gray-300 font-semibold">{uiText("Loading...")}</p>
      </div>
    </div>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PrivateQueryLifecycle />
      <BrowserRouter>
        <LanguagePromptGate>
          <LanguageSwitcher />
          <RootPasswordControl />
          <FriendRequestNotifications />
          <ErrorBoundary fallback={
          <main className="flex min-h-screen items-center justify-center bg-sky-50 p-6">
            <section role="alert" className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
              <h1 className="text-2xl font-bold text-gray-800">{uiText("We couldn’t load this page")}</h1>
              <p className="mt-3 text-gray-600">{uiText("Check your connection and reload to try again.")}</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-6 min-h-11 rounded-xl bg-sky-700 px-6 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-sky-700 focus:ring-offset-2">{uiText("Reload page")}</button>
            </section>
          </main>
        }>
        <Suspense fallback={loadingFallback}>
          <Routes>
            {/* Public routes — no FamilyGate */}
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route
              path="/uat/food-and-drink"
              element={import.meta.env.DEV ? <FoodAndDrinkPage /> : <Navigate replace to="/" />}
            />
            <Route
              path="/uat/food-and-drink/:recipeId"
              element={import.meta.env.DEV ? <FoodAndDrinkPage /> : <Navigate replace to="/" />}
            />
            <Route
              path="/uat/cooking"
              element={import.meta.env.DEV ? <CookingMenuPage /> : <Navigate replace to="/" />}
            />
            <Route
              path="/uat/kitchen"
              element={import.meta.env.DEV ? <CookingMenuPage /> : <Navigate replace to="/" />}
            />
            <Route
              path="/uat/cooking/cabbage-rolls"
              element={import.meta.env.DEV ? <CabbageRollPage /> : <Navigate replace to="/" />}
            />
            <Route
              path="/uat/cooking/hamburger"
              element={import.meta.env.DEV ? <BurgerPage /> : <Navigate replace to="/" />}
            />
            <Route
              path="/uat/cooking/:mealId"
              element={import.meta.env.DEV ? <CookingPage /> : <Navigate replace to="/" />}
            />

            {/* Local-only UAT route. It never supplies identity to the API. */}
            <Route
              path="/uat"
              element={UatMapPage ? <UatMapPage /> : <Navigate replace to="/" />}
            />
            <Route
              path="/uat/map"
              element={UatMapPage ? <UatMapPage /> : <Navigate replace to="/" />}
            />

            {/* Family-gated routes */}
            <Route path="/" element={<RootRoute />} />
            <Route path="/parent/*" element={<FamilyGate><ParentGate onAccessLost={() => clearParentQueryCache(queryClient)}><ParentRoutes /></ParentGate></FamilyGate>} />
            <Route path="/map" element={<FamilyGate><ProfileGate><MapPage /></ProfileGate></FamilyGate>} />
            <Route path="/food-and-drink" element={<FamilyGate><ProfileGate><FoodAndDrinkPage /></ProfileGate></FamilyGate>} />
            <Route path="/food-and-drink/:recipeId" element={<FamilyGate><ProfileGate><FoodAndDrinkPage /></ProfileGate></FamilyGate>} />
            <Route path="/shoo-shoo-ufo" element={<FamilyGate><ProfileGate><UfoPage /></ProfileGate></FamilyGate>} />
            <Route path="/daily-quiz" element={<FamilyGate><ProfileGate><DailyQuizPage /></ProfileGate></FamilyGate>} />
            <Route path="/calendar" element={<FamilyGate><ProfileGate><CalendarPage /></ProfileGate></FamilyGate>} />
            <Route path="/road-racing" element={<FamilyGate><ProfileGate><RacingPage /></ProfileGate></FamilyGate>} />
            <Route path="/waddle-wall" element={<FamilyGate><ProfileGate><MathWallPage /></ProfileGate></FamilyGate>} />
            <Route path="/town-building/*" element={<FamilyGate><ProfileGate><TownMapScreen /></ProfileGate></FamilyGate>} />
            <Route path="/infinidrill" element={<FamilyGate><ProfileGate><InfinidrillPage /></ProfileGate></FamilyGate>} />
            <Route path="/miniku" element={<FamilyGate><ProfileGate><MinikuPage /></ProfileGate></FamilyGate>} />
            <Route path="/fishing" element={<FamilyGate><ProfileGate><FishingPage /></ProfileGate></FamilyGate>} />
            <Route path="/playground" element={<FamilyGate><ProfileGate><ActivityHubPage /></ProfileGate></FamilyGate>} />
            <Route path="/activities" element={<Navigate replace to="/playground" />} />
            <Route path="/kitchen" element={<FamilyGate><ProfileGate><CookingMenuPage /></ProfileGate></FamilyGate>} />
            <Route path="/cooking" element={<FamilyGate><ProfileGate><CookingMenuPage /></ProfileGate></FamilyGate>} />
            <Route path="/cooking/:mealId" element={<FamilyGate><ProfileGate><CookingPage /></ProfileGate></FamilyGate>} />
            <Route path="/cooking/cabbage-rolls" element={<FamilyGate><ProfileGate><CabbageRollPage /></ProfileGate></FamilyGate>} />
            <Route path="/cooking/hamburger" element={<FamilyGate><ProfileGate><BurgerPage /></ProfileGate></FamilyGate>} />
            <Route path="/items/:id" element={<FamilyGate><ProfileGate><ItemDetailPage /></ProfileGate></FamilyGate>} />
            <Route
              path="/profile/:profileId/badges"
              element={<FamilyGate><ProfileGate><BadgeDisplayPage /></ProfileGate></FamilyGate>}
            />
            <Route
              path="/profile/:profileId/achievements"
              element={<FamilyGate><ProfileGate><AchievementsPage /></ProfileGate></FamilyGate>}
            />

            {/* Admin routes */}
            <Route path="/admin/*" element={<AdminGate><AdminRoutes /></AdminGate>} />
          </Routes>
        </Suspense>
          </ErrorBoundary>
        </LanguagePromptGate>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
