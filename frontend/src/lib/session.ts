import { cookies } from "next/headers"
import { adminAuth, adminDb } from "@/lib/firebase-admin"

// Sessions created before this timestamp are considered invalid and will be cleared.
// Update this date whenever you need to force all users to re-authenticate.
const SESSION_MINIMUM_ISSUED_AT = new Date("2026-01-30T00:00:00Z").getTime() / 1000

async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete("session")
}

export async function getCurrentUser(): Promise<Record<string, any> | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value
  if (!session) return null

  try {
    // We set checkRevoked to false to avoid "Session revoked" errors 
    // that can occur due to sync delays between the client and admin SDKs.
    const decoded = await adminAuth.verifySessionCookie(session, false).catch(err => {
      console.error("Session verification failed:", err.message)
      return null
    })
    
    if (!decoded) {
      await clearSessionCookie()
      return null
    }

    // Check if the session was issued before the minimum required date
    // This forces users with old session cookies to re-authenticate
    const iat = (decoded as { iat?: number }).iat
    if (iat && iat < SESSION_MINIMUM_ISSUED_AT) {
      console.log("Session cookie is too old, forcing re-authentication")
      await clearSessionCookie()
      return null
    }
    
    const uid = (decoded as { uid?: string }).uid
    if (!uid) return null

    const userDoc = await adminDb.collection("users").doc(uid).get()
    if (!userDoc.exists) {
      console.warn(`User document not found for UID: ${uid}. Possible sync delay.`);
      // Return a partial user so the login doesn't fail completely during sync delay
      return { uid, email: (decoded as any).email, isSyncing: true }
    }

    const data = userDoc.data() || {}

    // Get followers and following counts from subcollections
    const [followingCountSnapshot, followersCountSnapshot] = await Promise.all([
      adminDb.collection("users").doc(uid).collection("following").count().get(),
      adminDb.collection("users").doc(uid).collection("followers").count().get()
    ])

    const followersCount = followersCountSnapshot.data().count
    const followingCount = followingCountSnapshot.data().count
    
    // Initialize empty arrays for following/followers - can be populated later if needed
    const following: string[] = []
    const followers: string[] = []
    
    // Get list of friends UIDs from the new subcollection
    const friendsSnapshot = await adminDb.collection("users").doc(uid).collection("friends").get()
    const friends = friendsSnapshot.docs.map(doc => doc.id)

    // Get list of saved posts UIDs from the new subcollection
    const savedPostsSnapshot = await adminDb.collection("users").doc(uid).collection("savedPosts").get()
    const savedPosts = savedPostsSnapshot.docs.map(doc => doc.id)

    function serializeFirestoreValue(value: any): any {
      if (value && typeof value.toDate === "function") return value.toDate().toISOString()
      if (Array.isArray(value)) return value.map(serializeFirestoreValue)
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, serializeFirestoreValue(v)])
        )
      }
      return value
    }

    const plainData = serializeFirestoreValue(data)

    return {
      uid,
      ...plainData,
      following,
      followers,
      friends,
      savedPosts,

      followersCount: followersCount,
      followingCount: followingCount
    } as Record<string, any>
  } catch {
    return null
  }
}