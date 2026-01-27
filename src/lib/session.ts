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

    // Get list of users that current user is following and followers, and liked/saved posts
    const [followingSnapshot, followersSnapshot, likedSnapshot, savedSnapshot] = await Promise.all([
      adminDb.collection("follows").where("fromUid", "==", uid).get(),
      adminDb.collection("follows").where("toUid", "==", uid).get(),
      adminDb.collection("likes").where("uid", "==", uid).get(),
      adminDb.collection("saves").where("uid", "==", uid).get()
    ])
    
    const following = followingSnapshot.docs.map(doc => doc.data().toUid)
    const followers = followersSnapshot.docs.map(doc => doc.data().fromUid)
    const liked = likedSnapshot.docs.map(doc => doc.data().postId)
    const saved = savedSnapshot.docs.map(doc => doc.data().postId)

    // Get followers and following counts
    const followersCount = followersSnapshot.size
    const followingCount = followingSnapshot.size

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
      liked,
      saved,
      followersCount: followersCount,
      followingCount: followingCount
    } as Record<string, any>
  } catch {
    return null
  }
}