interface RateLimitEntry {
  timestamps: number[];
  lastSeen: number;
}

export class AuthRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly maxKeys: number,
  ) {}

  get entryCount(): number {
    return this.entries.size;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    for (const [key, entry] of this.entries) {
      if (entry.lastSeen <= cutoff) this.entries.delete(key);
    }
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestSeen = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this.entries) {
      if (entry.lastSeen < oldestSeen) {
        oldestKey = key;
        oldestSeen = entry.lastSeen;
      }
    }
    if (oldestKey !== undefined) this.entries.delete(oldestKey);
  }

  check(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    this.prune(now);
    const cutoff = now - this.windowMs;
    const existing = this.entries.get(key);
    if (!existing && this.entries.size >= this.maxKeys) this.evictOldest();
    const recent = (existing?.timestamps ?? []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= this.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil(((recent[0] ?? now) + this.windowMs - now) / 1000));
      this.entries.set(key, { timestamps: recent, lastSeen: now });
      return { allowed: false, retryAfterSeconds };
    }
    recent.push(now);
    this.entries.set(key, { timestamps: recent, lastSeen: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
