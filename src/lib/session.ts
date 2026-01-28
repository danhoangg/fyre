import { cookies } from "next/headers"
import { adminAuth, adminDb } from "@/lib/firebase-admin"

export async function getCurrentUser(): Promise<Record<string, any> | null> {
  const session = (await cookies()).get("session")?.value
  if (!session) return null

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true)
    const uid = (decoded as { uid?: string }).uid
    if (!uid) return null

    const userDoc = await adminDb.collection("users").doc(uid).get()
    if (!userDoc.exists) return null

    const data = userDoc.data() || {}

    // Get list of users that current user is following and followers
    const [followingCountSnapshot, followersCountSnapshot] = await Promise.all([
      adminDb.collection("follows").where("fromUid", "==", uid).count().get(),
      adminDb.collection("follows").where("toUid", "==", uid).count().get()
    ])

    const followersCount = followersCountSnapshot.data().count
    const followingCount = followingCountSnapshot.data().count
    
    // Initialize empty arrays for following/followers - can be populated later if needed
    const following: string[] = []
    const followers: string[] = []
    
    const friendsDoc = await adminDb.collection("friends").doc(uid).get()
    const friends = friendsDoc.exists ? friendsDoc.data()?.friends || [] : []

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

      followersCount: followersCount,
      followingCount: followingCount
    } as Record<string, any>
  } catch {
    return null
  }
}