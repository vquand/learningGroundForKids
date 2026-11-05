import { AdventureJournal,ADVENTURE_ICON } from '../components/Adventures/AdventureJournal';
import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText, uiMessage } from '../i18n/uiText';
import { KidBackButton } from '../components/KidBackButton';
import { ACTIVITY_AGES } from './activityAgeGuidance';
import { fetchTownName } from '../api/town';
import { townDisplayName } from '../../../server/src/town-building/game';
import { familyQueryKey } from '../lib/familyQueries';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeProfileTour, fetchProfileTour, fetchProfiles } from "../api/profiles";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { ProfilePersonalizationDialog } from "../components/ProfilePicker/ProfilePersonalizationDialog";
import { KidProfileBackground } from "../components/KidProfileBackground";
import { familyScopedQuery, profileQueryKey } from "../lib/familyQueries";
import { useFamilyStore } from "../stores/familyStore";
import { useProfileStore } from "../stores/profileStore";
import { ActivityIcon } from "../components/ActivityIcon";
import { ChildFriendCode } from "../components/ChildFriendCode";
import { LearntItemsCount } from '../components/LearntItemsCount';
import { CALENDAR_COPY } from '../components/Calendar/calendarCopy';
import { KidPlaygroundTour } from "../components/KidPlaygroundTour";
import { useScheduleStatus } from '../hooks/useScheduleStatus';
import { LockedMessage } from '../components/ScheduleLock/AdventureLockGuard';
import { KID_TOUR_STEPS } from "../lib/kidTour";

const ACTIVITIES = [
  {
    id: "avatar",
    title: "Your avatar",
    description: "Choose your avatar, photo, frame, and favorite color.",
    className: "border-violet-200 bg-violet-50 hover:border-violet-300 hover:bg-violet-100",
    iconClassName: "bg-violet-100",
    path: "/playground",
  },
  {
    id: "badges",
    title: "Badges",
    description: "See achievements earned on every adventure.",
    className: "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100",
    iconClassName: "bg-amber-100",
    path: "/",
  },
  { id: 'town', title: 'Your little town', description: 'Turn your learning rewards into a cozy town beside the river.',
    className: 'border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100', iconClassName: 'bg-emerald-100', path: '/town-building' },
  {
    id: 'calendar', title: CALENDAR_COPY.hubTitle, description: CALENDAR_COPY.hubDescription,
    className: 'border-sky-200 bg-sky-50 hover:border-sky-300 hover:bg-sky-100',
    iconClassName: 'bg-sky-100', path: '/calendar',
  },
  {
    id: 'daily-quiz', title: 'Daily Quiz',
    description: 'Eight little questions, a daily streak, and rewards for your town.',
    className: 'border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100',
    iconClassName: 'bg-amber-100', path: '/daily-quiz',
  },
  {
    id: "explore",
    title: "Explore",
    description: "Travel the map, discover places, and collect new stories.",
    className: "border-sky-200 bg-sky-50 hover:border-sky-300 hover:bg-sky-100",
    iconClassName: "bg-sky-100",
    path: "/map",
  },
  {
    id: "kitchen",
    title: "Kitchen",
    description: "Cook meals and mix drinks from the recipe board.",
    className: "border-rose-200 bg-rose-50 hover:border-rose-300 hover:bg-rose-100",
    iconClassName: "bg-rose-100",
    path: "/kitchen",
  },
  {
    id: "ufo",
    title: "Shoo Shoo UFO",
    description: "Guess words, make animal friends, and shoo a curious UFO away.",
    className: "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100",
    iconClassName: "bg-emerald-100",
    path: "/shoo-shoo-ufo",
  },
  {
    id: "math-wall",
    title: "Waddle Wall",
    description: "Solve little sums, waddle through walls, and make a splash!",
    className: "border-lime-200 bg-lime-50 hover:border-lime-300 hover:bg-lime-100",
    iconClassName: "bg-lime-100",
    path: "/waddle-wall",
  },
  {
    id: "infinidrill",
    title: "Infinidrill",
    description: "Solve sums, drill through Earth, and discover your glowing core.",
    className: "border-orange-200 bg-orange-50 hover:border-orange-300 hover:bg-orange-100",
    iconClassName: "bg-orange-100",
    path: "/infinidrill",
  },
  {
    id: "miniku",
    title: "Miniku",
    description: "Fill little sudoku grids with a thoughtful animal friend.",
    className: "border-teal-200 bg-teal-50 hover:border-teal-300 hover:bg-teal-100",
    iconClassName: "bg-teal-100",
    path: "/miniku",
  },
  {
    id: "fishing",
    title: "Fishing Friends",
    description: "Solve math for bait, fish with a cozy friend, and fill your fishbook.",
    className: "border-cyan-200 bg-cyan-50 hover:border-cyan-300 hover:bg-cyan-100",
    iconClassName: "bg-cyan-100",
    path: "/fishing",
  },
  {
    id: 'road-racing',
    title: 'Road Racing',
    description: 'Quick answers, speedy friends, and a race across land and water.',
    className: 'border-orange-200 bg-orange-50 hover:border-orange-300 hover:bg-orange-100',
    iconClassName: 'bg-orange-100',
    path: '/road-racing',
  },
] as const;

export function ActivityHubPage() {
  useUiLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const familyId = useFamilyStore((state) => state.familyId);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const clearProfile = useProfileStore((state) => state.clearProfile);
  const generation = useFamilyStore((state) => state.sessionGeneration);
  const { locked, status: scheduleStatus } = useScheduleStatus();
  const [journalProfileId,setJournalProfileId] = useState<string|null>(null);
  const [personalizingProfileId, setPersonalizingProfileId] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const tourStarted = useRef(false);
  const tourCompletionAttempted = useRef(false);
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: profileQueryKey(familyId),
    queryFn: familyScopedQuery(familyId, fetchProfiles),
    enabled: Boolean(familyId),
    retry: false,
  });
  const townName = useQuery({ queryKey: familyQueryKey('town-name', familyId, activeProfileId), queryFn: familyScopedQuery(familyId, () => fetchTownName(activeProfileId!)), enabled: Boolean(familyId && activeProfileId && !locked), refetchOnMount:'always' });
  const tourQueryKey = familyQueryKey('profile-tour', familyId, activeProfileId);
  const tour = useQuery({
    queryKey: tourQueryKey,
    queryFn: familyScopedQuery(familyId, () => fetchProfileTour(activeProfileId!)),
    enabled: Boolean(familyId && activeProfileId && !locked),
    retry: false,
    staleTime: Infinity,
  });
  const completeTour = useMutation({
    mutationFn: () => familyScopedQuery(familyId, () => completeProfileTour(activeProfileId!))(),
    onSuccess: () => queryClient.setQueryData(tourQueryKey, { completed: true }),
  });
  const profile = profiles.find((item) => item.id === activeProfileId);

  useEffect(() => {
    tourStarted.current = false;
    tourCompletionAttempted.current = false;
    setTourStep(null);
  }, [activeProfileId, familyId]);

  useEffect(() => {
    if (!profile || tourStarted.current || tour.isPending || tour.isError || tour.data?.completed !== false) return;
    tourStarted.current = true;
    setTourStep(0);
  }, [profile, tour.data?.completed, tour.isError, tour.isPending]);

  const startTour = useCallback(() => {
    if (!profile || completeTour.isPending) return;
    tourCompletionAttempted.current = false;
    setTourStep(0);
  }, [completeTour.isPending, profile]);

  const finishTour = useCallback(() => {
    if (tourStep === null || tourCompletionAttempted.current) return;
    tourCompletionAttempted.current = true;
    setTourStep(null);
    if (familyId && activeProfileId) completeTour.mutate();
  }, [activeProfileId, completeTour, familyId, tourStep]);

  function handleSwitchProfile() {
    clearProfile();
    navigate("/");
  }

  return (
    <div className="kid-profile-page activity-hub-page min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <KidProfileBackground profile={profile} />
      <header className="kid-nav relative flex"><KidBackButton onClick={handleSwitchProfile} label="Back to profiles"/><button type="button" className="kid-nav-action kid-tour-replay" aria-label={uiText("Replay playground guide")} title={uiText("Replay playground guide")} disabled={!profile || completeTour.isPending} onClick={startTour}>?</button></header>
      <main className="relative mx-auto flex w-full max-w-3xl flex-col items-center">
        <header className="w-full rounded-[2rem] border border-white/80 bg-white/85 px-5 py-6 text-center shadow-sm backdrop-blur sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5">
            {profile ? (
              <ProfileAvatar profile={profile} size="xl" />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 text-5xl" aria-hidden="true">🌟</span>
            )}
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600">{uiText("Your adventure playground")}</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-800 sm:text-4xl">
                {isLoading ? uiText("Ready when you are") : `${uiText("Hi")}${profile ? `, ${profile.name}` : ""}!`}
              </h1>
              <p className="mt-2 max-w-md text-sm font-semibold leading-relaxed text-slate-500 sm:text-base">
                {uiText("Choose where to go next: explore, cook, play with animal friends, or check your badges.")}</p>
              {profile && <ChildFriendCode key={profile.id} name={profile.name} code={profile.public_id} />}
            </div>
          </div>
        </header>

        <button type="button" className="adventures-button" disabled={!profile||locked} onClick={()=>profile&&!locked&&setJournalProfileId(profile.id)}>
          <img src={ADVENTURE_ICON} alt=""/><span><strong>{uiText('Latest Adventures')}</strong><small>{uiText('See what you and your friends have been doing.')}</small></span><span aria-hidden="true">→</span>
        </button>
        {journalProfileId===activeProfileId&&profile&&<AdventureJournal key={`${familyId}:${generation}:${profile.id}`} profileId={profile.id} onClose={()=>setJournalProfileId(null)}/>}

        {locked && <LockedMessage nextOpenAt={scheduleStatus?.next_open_at ?? null} />}

        <section className="mt-6 w-full" aria-labelledby="activity-hub-title">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{uiText("Playground activities")}</p>
              <h2 id="activity-hub-title" className="mt-1 text-xl font-black text-slate-800 sm:text-2xl">{uiText("What do you feel like doing?")}</h2>
            </div>
            <span className="text-2xl" aria-hidden="true">✨</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {ACTIVITIES.map((activity) => {
              const path = activity.id === "badges"
                ? activeProfileId ? `/profile/${activeProfileId}/badges` : "/"
                : activity.path;
              const blocked = locked && activity.id !== 'calendar';
              return (
                <button
                  key={activity.id}
                  type="button"
                  data-locked={blocked ? 'true' : undefined}
                  aria-disabled={blocked || undefined}
                  onClick={() => blocked ? undefined : activity.id === "avatar" && profile ? setPersonalizingProfileId(profile.id) : navigate(path)}
                  disabled={(activity.id === "avatar" && !profile) || blocked}
                  data-tour={activity.id === 'ufo' ? 'minigame' : activity.id === 'badges' || activity.id === 'town' ? activity.id : undefined}
                  className={`activity-hub-card group min-h-48 rounded-[1.75rem] border-2 p-5 text-left shadow-sm transition duration-150 hover:-translate-y-1 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-sky-200 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${tourStep !== null && ((activity.id === 'ufo' && KID_TOUR_STEPS[tourStep]?.target === 'minigame') || activity.id === KID_TOUR_STEPS[tourStep]?.target) ? 'kid-tour-target' : ''} ${activity.className}`}
                >
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-sm transition group-hover:rotate-3 ${activity.iconClassName}`} aria-hidden="true">
                    {activity.id === "avatar" && profile ? <ProfileAvatar profile={profile} size="md" /> : <ActivityIcon activity={activity.id}/> }
                  </span>
                  <span className="mt-5 flex items-center justify-between gap-3 text-xl font-black text-slate-800">
                    <span>{activity.id === 'town' ? townDisplayName(townName.data) : uiText(activity.title)}</span>
                    {ACTIVITY_AGES[activity.id] && <span className="kid-age-badge" data-min-age={ACTIVITY_AGES[activity.id]} title={uiMessage('Suggested age: {age} and up', { age: ACTIVITY_AGES[activity.id]! })} aria-label={uiMessage('Suggested age: {age} and up', { age: ACTIVITY_AGES[activity.id]! })}>{ACTIVITY_AGES[activity.id]}+</span>}
                  </span>
                  <span className="mt-2 block text-sm font-semibold leading-relaxed text-slate-600">{uiText(activity.description)}</span>
                  {activity.id === 'explore' && profile && <span className="mt-3 block"><LearntItemsCount count={profile.total_done} /></span>}
                  <span className="mt-4 block text-sm font-black text-slate-500">{uiText("Open ")}<span aria-hidden="true">→</span></span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 px-1 text-sm font-semibold text-slate-600">{uiText('Suggested starting ages. Younger explorers can play with a grown-up.')}</p>
        </section>

        {tourStep !== null && <KidPlaygroundTour stepIndex={tourStep} onBack={() => setTourStep((current) => Math.max(0, (current ?? 0) - 1))} onNext={() => setTourStep((current) => Math.min(KID_TOUR_STEPS.length - 1, (current ?? 0) + 1))} onFinish={finishTour} />}

        {profile && personalizingProfileId === profile.id && (
          <ProfilePersonalizationDialog
            key={`${familyId}:${generation}:${profile.id}`}
            profile={profile}
            onClose={() => setPersonalizingProfileId(null)}
          />
        )}

      </main>
    </div>
  );
}
