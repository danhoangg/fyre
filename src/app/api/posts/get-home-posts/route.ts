import { getCurrentUser } from "@/lib/session"
import { getPostsByPostIds, getPostsByUserIds } from "@/lib/posts"
import { adminDb } from "@/lib/firebase-admin"

export async function GET(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const uid = searchParams.get("uid")
        const lastPostId = searchParams.get("lastPostId") || undefined;
        const limit = parseInt(searchParams.get("limit") || "10");

        if (!uid) {
            return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 })
        }

        const friendsDoc = await adminDb.collection("friends").doc(uid).get()
        const friends = friendsDoc.exists ? friendsDoc.data()?.friends || [] : []

        if (friends.length === 0) {
            return new Response(JSON.stringify({ posts: [], hasMore: false }), { status: 200 })
        }

        const results = await getPostsByUserIds([uid, ...friends], limit, lastPostId, user.uid)

        return new Response(JSON.stringify(results), { status: 200 })
    } catch (error) {
        console.error("Get home posts error:", error)
        return new Response(JSON.stringify({ error: "Failed to fetch home posts" }), { status: 500 })
    }
}