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

    return { uid, ...plainData } as Record<string, any>
  } catch {
    return null
  }
}