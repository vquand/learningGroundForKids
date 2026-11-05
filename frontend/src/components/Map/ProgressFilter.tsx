import { useFamilyStore } from '../../stores/familyStore';
import { useProfileStore } from '../../stores/profileStore';
import { profileProgress, useFilterStore } from '../../stores/filterStore';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import type { ExploreProgress } from '../../types/explore';

export function useMapProgress() {
  const family = useFamilyStore(s => s.familyId);
  const generation = useFamilyStore(s => s.sessionGeneration);
  const profile = useProfileStore(s => s.activeProfileId) ?? 'practice';
  const session = `${family}:${generation}`;
  const progress = useFilterStore(s => profileProgress(s, session, profile));
  return { progress, session, profile };
}

export function ProgressFilter() {
  useUiLanguage();
  const { progress, session, profile } = useMapProgress();
  const setProgress = useFilterStore(s => s.setProgress);
  const options: [ExploreProgress, string][] = [['todo', 'Not done'], ['done', 'Done'], ['all', 'All']];
  return <div className="explore-progress-filter" role="group" aria-label={uiText('Completion filter')}>
    {options.map(([value, label]) => <button key={value} type="button" aria-pressed={progress === value}
      onClick={() => setProgress(session, profile, value)}>{uiText(label)}</button>)}
  </div>;
}
