import { adminDb } from "./firebase-admin";

// In-memory cache with TTL (time-to-live)
const cache = new Map<string, { data: any; expiry: number }>();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const USER_DATA_TTL = 10 * 60 * 1000; // 10 minutes for user data (less frequently changed)
const FOLLOW_COUNT_TTL = 10 * 60 * 1000; // 10 minutes for follow counts
const FOLLOW_STATUS_TTL = 1 * 60 * 1000; // 1 minute for follow status (changes frequently and user-specific)

function getCacheKey(type: string, id: string): string {
  return `${type}:${id}`;
}

function setCache(key: string, data: any, ttl: number = DEFAULT_TTL): void {
  cache.set(key, {
    data,
    expiry: Date.now() + ttl
  });
}

function getCache<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;

  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }

  return item.data as T;
}

function clearCache(keyPattern?: string): void {
  if (!keyPattern) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.startsWith(keyPattern)) {
      cache.delete(key);
    }
  }
}

// Cache user data
export async function getUserDataCached(uid: string): Promise<any> {
  const cacheKey = getCacheKey("user", uid);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const userDoc = await adminDb.collection("users").doc(uid).get();
  const data = userDoc.exists ? userDoc.data() : null;

  if (data) {
    setCache(cacheKey, data, USER_DATA_TTL);
  }

  return data;
}

// Cache follow counts
export async function getFollowersCountCached(uid: string): Promise<number> {
  const cacheKey = getCacheKey("followers_count", uid);
  const cached = getCache<number>(cacheKey);
  if (cached !== null) return cached;

  const snapshot = await adminDb
    .collection("follows")
    .where("toUid", "==", uid)
    .count()
    .get();

  const count = snapshot.data().count;
  setCache(cacheKey, count, FOLLOW_COUNT_TTL);
  return count;
}

export async function getFollowingCountCached(uid: string): Promise<number> {
  const cacheKey = getCacheKey("following_count", uid);
  const cached = getCache<number>(cacheKey);
  if (cached !== null) return cached;

  const snapshot = await adminDb
    .collection("follows")
    .where("fromUid", "==", uid)
    .count()
    .get();

  const count = snapshot.data().count;
  setCache(cacheKey, count, FOLLOW_COUNT_TTL);
  return count;
}

// Cache follow status (shorter TTL since it can change frequently and is user-specific)
export async function isFollowingCached(fromUid: string, toUid: string): Promise<boolean> {
  const cacheKey = getCacheKey("follow_status", `${fromUid}_${toUid}`);
  const cached = getCache<boolean>(cacheKey);
  if (cached !== null) return cached;

  const followDocId = `${fromUid}_${toUid}`;
  const followDoc = await adminDb.collection("follows").doc(followDocId).get();
  const isFollowing = followDoc.exists;

  setCache(cacheKey, isFollowing, FOLLOW_STATUS_TTL);
  return isFollowing;
}

// Cache batch follow statuses to reduce reads
export async function getFollowStatusesCached(
  fromUid: string,
  toUids: string[]
): Promise<{ [key: string]: boolean }> {
  const result: { [key: string]: boolean } = {};
  const toFetch: string[] = [];

  // Check cache first
  for (const toUid of toUids) {
    const cacheKey = getCacheKey("follow_status", `${fromUid}_${toUid}`);
    const cached = getCache<boolean>(cacheKey);
    if (cached !== null) {
      result[toUid] = cached;
    } else {
      toFetch.push(toUid);
    }
  }

  // Fetch uncached follow statuses
  if (toFetch.length > 0) {
    const followDocs = await Promise.all(
      toFetch.map(toUid => {
        const followDocId = `${fromUid}_${toUid}`;
        return adminDb.collection("follows").doc(followDocId).get();
      })
    );

    toFetch.forEach((toUid, index) => {
      const isFollowing = followDocs[index].exists;
      result[toUid] = isFollowing;
      setCache(
        getCacheKey("follow_status", `${fromUid}_${toUid}`),
        isFollowing,
        FOLLOW_STATUS_TTL
      );
    });
  }

  return result;
}

// Invalidate cache when follow status changes
export function invalidateFollowCache(fromUid: string, toUid: string): void {
  cache.delete(getCacheKey("follow_status", `${fromUid}_${toUid}`));
  cache.delete(getCacheKey("follow_status", `${toUid}_${fromUid}`)); // Invalidate reverse too
  clearCache("followers_count:" + toUid);
  clearCache("following_count:" + fromUid);
  
  // Also invalidate user data cache since counts and arrays changed
  cache.delete(getCacheKey("user", fromUid));
  cache.delete(getCacheKey("user", toUid));
}

// Invalidate cache when user data changes
export function invalidateUserCache(uid: string): void {
  cache.delete(getCacheKey("user", uid));
  clearCache("followers_count:" + uid);
  clearCache("following_count:" + uid);
}

export { clearCache };
