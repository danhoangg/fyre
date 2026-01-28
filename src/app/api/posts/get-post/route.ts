import { getCurrentUser } from "@/lib/session"
import { getPostsByPostIds } from "@/lib/posts"

export async function GET(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const postId = searchParams.get("postId")

        if (!postId) {
            return new Response(JSON.stringify({ error: "Post ID is required" }), { status: 400 })
        }

        const {posts, hasMore} = await getPostsByPostIds([postId], 10, undefined, user.uid)
        
        if (!posts || posts.length === 0) {
            return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 })
        }

        return new Response(JSON.stringify(posts[0]), { status: 200 })
    } catch (error) {
        console.error("Get post error:", error)
        return new Response(JSON.stringify({ error: "Failed to fetch post" }), { status: 500 })
    }
}
