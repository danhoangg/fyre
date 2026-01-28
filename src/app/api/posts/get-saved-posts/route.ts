import { getCurrentUser } from "@/lib/session"
import { getPostsByPostIds } from "@/lib/posts"
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

        const userDoc = await adminDb.collection("users").doc(uid).get()
        const savedPosts: string[] = userDoc.exists ? userDoc.data()?.savedPosts || [] : []

        if (savedPosts.length === 0) {
            return new Response(JSON.stringify({ posts: [], hasMore: false }), { status: 200 })
        }

        const results = await getPostsByPostIds(savedPosts, limit, lastPostId, user.uid)

        return new Response(JSON.stringify(results), { status: 200 })
    } catch (error) {
        console.error("Get saved posts error:", error)
        return new Response(JSON.stringify({ error: "Failed to fetch saved posts" }), { status: 500 })
    }
}