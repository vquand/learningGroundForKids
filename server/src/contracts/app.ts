import type { Hono, Context } from 'hono';
import type { AppConfig } from '../config.js';
import type { AppDatabase, FamilyRecord } from './db.js';
import type { MediaStorage } from '../media.js';
import type { Logger } from '../logger.js';
import type { CatalogRefreshJobManager } from '../catalog-refresh-job.js';

export type AppVariables = {
  requestId: string;
  family: FamilyRecord;
};

export type App = Hono<{ Variables: AppVariables }>;

export interface AppDependencies {
  /** null disables all weather provider access. */
  weather?: import("../calendar/weather-contracts.js").CalendarWeather | null;
  weatherClock?: () => Date;
  weatherFetch?: typeof fetch;
  geocoder?: typeof import("../geocode.js").geocodeHome;
  googleProvider?: import("../google-auth/provider.js").GoogleProvider;
  config: AppConfig;
  db: AppDatabase;
  media?: MediaStorage;
  logger?: Logger;
  catalogRefreshJobs?: CatalogRefreshJobManager;
  /** Supplied by the HTTP adapter, never from a request header. */
  clientAddress?: (context: Context) => string | undefined;
}
