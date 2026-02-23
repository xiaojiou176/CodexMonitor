type CacheEntry<V> = {
  value: V;
  expiresAt: number | null;
};

export class BoundedCache<K, V> {
  private readonly entries = new Map<K, CacheEntry<V>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number | null;

  constructor(maxEntries: number, ttlMs?: number) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
    this.ttlMs = typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : null;
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    const expiresAt = this.ttlMs === null ? null : Date.now() + this.ttlMs;
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    this.entries.set(key, { value, expiresAt });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as K | undefined;
      if (oldest === undefined) {
        break;
      }
      this.entries.delete(oldest);
    }
  }

  delete(key: K): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
