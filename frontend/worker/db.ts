export interface D1Result<T> {
  results?: T[];
  success?: boolean;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
}

export interface R2Object {
  body: ReadableStream;
  httpEtag?: string;
  httpMetadata?: Record<string, string | undefined>;
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: unknown): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export interface WorkerEnv {
  API_ORIGIN?: string;
  DB?: D1Database;
  MEDIA?: R2Bucket;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS families (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'family',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    color TEXT NOT NULL,
    public_id TEXT NOT NULL UNIQUE,
    native_country_code TEXT,
    native_city TEXT,
    avatar_type TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_profiles_family_created
    ON profiles (family_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    country_code TEXT,
    icon_slug TEXT,
    is_published INTEGER NOT NULL DEFAULT 0,
    source_type TEXT NOT NULL DEFAULT 'system',
    owner_family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
    recipe TEXT,
    location_desc TEXT,
    fun_facts TEXT,
    audio_urls TEXT,
    youtube_url TEXT,
    trailer_url TEXT,
    characters TEXT,
    start_year INTEGER,
    end_year INTEGER,
    time_precision TEXT,
    released_date TEXT,
    rich_fields TEXT,
    franchise_id TEXT,
    quiz_required INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_items_published_category
    ON items (is_published, category, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_items_owner_created
    ON items (owner_family_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS item_translations (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    lang TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    history TEXT,
    UNIQUE (item_id, lang)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_item_translations_item_lang
    ON item_translations (item_id, lang)`,
  `CREATE TABLE IF NOT EXISTS item_media (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL,
    label TEXT,
    lang TEXT,
    filename TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_item_media_item_order
    ON item_media (item_id, sort_order)`,
  `CREATE TABLE IF NOT EXISTS quiz_questions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    lang TEXT NOT NULL,
    question TEXT NOT NULL,
    question_type TEXT NOT NULL,
    options TEXT NOT NULL,
    correct_answers TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quiz_questions_item_active
    ON quiz_questions (item_id, is_active, lang, sort_order)`,
  `CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    attempt_date TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    answers TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quiz_attempts_profile_item
    ON quiz_attempts (profile_id, item_id, completed_at)`,
  `CREATE TABLE IF NOT EXISTS profile_progress (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    done_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (profile_id, item_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_profile_progress_profile_recent
    ON profile_progress (profile_id, done_at)`,
] as const;

const initializedDatabases = new WeakMap<object, Promise<void>>();

export function requireDatabase(env: WorkerEnv): D1Database {
  if (!env.DB) {
    throw new Error("D1 database binding is not configured.");
  }
  return env.DB;
}

export function ensureSchema(db: D1Database): Promise<void> {
  const existing = initializedDatabases.get(db);
  if (existing) return existing;

  const initialization = db
    .batch(SCHEMA_STATEMENTS.map((statement) => db.prepare(statement)))
    .then(() => undefined)
    .catch((error: unknown) => {
      // Allow a later request to retry after a transient D1 failure instead of
      // permanently caching a rejected initialization promise.
      initializedDatabases.delete(db);
      throw error;
    });
  initializedDatabases.set(db, initialization);
  return initialization;
}
