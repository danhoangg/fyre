import { getCurrentUser } from "@/lib/session"
import { adminDb } from "@/lib/firebase-admin"

export async function GET(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const uid = searchParams.get("uid") || user.uid

        const friendsSnapshot = await adminDb.collection("users").doc(uid).collection("friends").get()
        const friends = friendsSnapshot.docs.map(doc => ({
            ...doc.data(),
            isFollowing: true // By definition, if they are friends, they follow them
        }))

        return new Response(JSON.stringify(friends), { status: 200 })
    } catch (error) {
        console.error("Get friends error:", error)
        return new Response(JSON.stringify({ error: "Failed to fetch friends" }), { status: 500 })
    }
}
