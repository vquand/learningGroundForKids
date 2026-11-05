import "leaflet/dist/leaflet.css";
import { lazy, Suspense } from 'react';
import { useFamilyStore } from '../../stores/familyStore';
import { useProfileStore } from '../../stores/profileStore';
import { PreparedWorldMap } from './PreparedWorldMap';
import type { WorldMapProps } from './LocalWorldMap';

const LocalWorldMap = import.meta.env.DEV
  ? lazy(() => import('./LocalWorldMap').then(module => ({ default: module.LocalWorldMap })))
  : null;

export function WorldMap(props: WorldMapProps = {}) {
  const family = useFamilyStore(s => s.familyId);
  const generation = useFamilyStore(s => s.sessionGeneration);
  const profile = useProfileStore(s => s.activeProfileId);
  if (props.itemsOverride && LocalWorldMap) return <Suspense fallback={null}><LocalWorldMap {...props}/></Suspense>;
  return <PreparedWorldMap key={`${family}:${generation}:${profile}`} progressOverride={props.progressOverride} onOpenDetail={props.onOpenDetail} onTimeline={props.onTimeline}/>;
}
