import { lazy, type ComponentType } from 'react';
import type { Category, ItemDetail } from '../../types/item';

const FoodDetail = lazy(() => import('./FoodDetail').then(m => ({ default: m.FoodDetail })));
const MonumentDetail = lazy(() => import('./MonumentDetail').then(m => ({ default: m.MonumentDetail })));
const MusicDetail = lazy(() => import('./MusicDetail').then(m => ({ default: m.MusicDetail })));
const MovieDetail = lazy(() => import('./MovieDetail').then(m => ({ default: m.MovieDetail })));
const AnimalDetail = lazy(() => import('./AnimalDetail').then(m => ({ default: m.AnimalDetail })));
const LandmarkDetail = lazy(() => import('./LandmarkDetail').then(m => ({ default: m.LandmarkDetail })));
const PhenomenonDetail = lazy(() => import('./PhenomenonDetail').then(m => ({ default: m.PhenomenonDetail })));

export interface CategoryConfig {
  component: ComponentType<{ item: ItemDetail; onMediaInteract?: () => void }>;
  label: string;
  requiredFields: string[];
  hasMedia: boolean;
  mediaType?: 'audio' | 'video' | 'both';
}

export const CATEGORY_REGISTRY: Record<Category, CategoryConfig> = {
  food: {
    component: FoodDetail,
    label: 'Food',
    requiredFields: ['recipe'],
    hasMedia: true,
    mediaType: 'video',
  },
  monument: {
    component: MonumentDetail,
    label: 'Monument',
    requiredFields: ['location_desc', 'fun_facts'],
    hasMedia: false,
  },
  landmark: {
    component: LandmarkDetail,
    label: 'Landmark',
    requiredFields: ['location_desc', 'fun_facts'],
    hasMedia: false,
  },
  music: {
    component: MusicDetail,
    label: 'Music / Composer',
    requiredFields: [],
    hasMedia: true,
    mediaType: 'audio',
  },
  movie: {
    component: MovieDetail,
    label: 'Movie',
    requiredFields: ['characters'],
    hasMedia: true,
    mediaType: 'video',
  },
  phenomenon: {
    component: PhenomenonDetail,
    label: 'Natural Phenomenon',
    requiredFields: ['fun_facts'],
    hasMedia: false,
  },
  animal: {
    component: AnimalDetail,
    label: 'Animal',
    requiredFields: ['fun_facts'],
    hasMedia: true,
    mediaType: 'video',
  },
};
