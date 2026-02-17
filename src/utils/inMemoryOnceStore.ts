// src/utils/inMemoryOnceStore.ts
type RecordValue = { createdAt: number; data: any };
const store = new Map<string, RecordValue>();

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function saveOnce<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  store.set(key, { createdAt: Date.now(), data });
  setTimeout(() => {
    store.delete(key);
  }, ttlMs).unref?.();
}

export async function getIfExists<T>(key: string): Promise<T | undefined> {
  const v = store.get(key);
  return v?.data as T | undefined;
}
