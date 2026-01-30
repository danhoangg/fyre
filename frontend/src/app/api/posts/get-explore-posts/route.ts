import { getCurrentUser } from "@/lib/session"
import { getExplorePostsByScore } from "@/lib/posts"

export async function GET(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const lastPostId = searchParams.get("lastPostId") || undefined;
        const limit = parseInt(searchParams.get("limit") || "10");

        // Fetch explore posts based on score
        const { posts, hasMore } = await getExplorePostsByScore(limit, lastPostId, user.uid);

        return new Response(JSON.stringify({ posts, hasMore }), { status: 200 });
    } catch (error) {
        console.error("Get explore posts error:", error)
        return new Response(JSON.stringify({ error: "Failed to fetch home posts" }), { status: 500 })
    }
}