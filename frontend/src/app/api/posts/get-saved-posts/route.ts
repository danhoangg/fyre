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
        const limit = parseInt(searchParams.get("limit") || "5");

        if (!uid) {
            return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 })
        }

        let savedPostsQuery = adminDb.collection("users").doc(uid).collection("savedPosts").orderBy("createdAt", "desc").limit(limit + 1)
        if (lastPostId) {
            const lastDoc = await adminDb.collection("users").doc(uid).collection("savedPosts").doc(lastPostId).get()
            if (lastDoc.exists) {
                savedPostsQuery = savedPostsQuery.startAfter(lastDoc)
            }
        }

        const savedPostsSnapshot = await savedPostsQuery.get()
        const savedPostIds: string[] = savedPostsSnapshot.docs.map(doc => doc.id)
        
        const hasMore = savedPostIds.length > limit
        const pagePostIds = hasMore ? savedPostIds.slice(0, limit) : savedPostIds

        if (pagePostIds.length === 0) {
            return new Response(JSON.stringify({ posts: [], hasMore: false }), { status: 200 })
        }

        const results = await getPostsByPostIds(pagePostIds, limit, undefined, user.uid, true)

        return new Response(JSON.stringify({ posts: results.posts, hasMore }), { status: 200 })
    } catch (error) {
        console.error("Get saved posts error:", error)
        return new Response(JSON.stringify({ error: "Failed to fetch saved posts" }), { status: 500 })
    }
}