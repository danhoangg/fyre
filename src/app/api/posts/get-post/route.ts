import { adminDb } from "@/lib/firebase-admin"
import { getCurrentUser } from "@/lib/session"
import { getPostsLikedStatus, getPostsSavedStatus, getCommentsLikedStatus } from "@/lib/user"

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

        const postDoc = await adminDb.collection("posts").doc(postId).get()
        
        if (!postDoc.exists) {
            return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 })
        }

        // Build post data with comments
        const postData = {
            id: postDoc.id,
            ...postDoc.data()
        }

        // Fetch comments subcollection
        const commentsSnapshot = await postDoc.ref.collection("comments").orderBy("createdAt", "desc").get()
        const comments = commentsSnapshot.docs.map(commentDoc => ({
            id: commentDoc.id,
            ...commentDoc.data()
        }))

        // Get user info for each comment
        const commentsWithUser = await Promise.all(
            comments.map(async comment => {
                const userDoc = await adminDb.collection("users").doc((comment as any).authorId).get()

                return {
                    ...comment,
                    authorId: (comment as any).authorId,
                    username: userDoc.exists ? (userDoc.data() as any).username : "Unknown",
                    avatarUrl: userDoc.exists ? (userDoc.data() as any).avatarUrl : null
                }
            })
        )

        const post: any = {
            ...postData,
            commentCount: comments.length,
            comments: commentsWithUser
        }

        // Add liked/saved status for the post and comments
        const commentIds = commentsWithUser.map((c: any) => c.id)
        const [likedStatus, savedStatus, commentsLikedStatus] = await Promise.all([
            getPostsLikedStatus([postId], user.uid),
            getPostsSavedStatus([postId], user.uid),
            getCommentsLikedStatus(commentIds, user.uid),
        ])

        post.isLiked = likedStatus[postId] || false
        post.isSaved = savedStatus[postId] || false
        post.comments = post.comments.map((comment: any) => ({
            ...comment,
            isLiked: commentsLikedStatus[comment.id] || false
        }))

        // Serialize Firestore data to plain objects
        const serializedPost = JSON.parse(JSON.stringify(post))

        return new Response(JSON.stringify(serializedPost), { status: 200 })
    } catch (error) {
        console.error("Get post error:", error)
        return new Response(JSON.stringify({ error: "Failed to fetch post" }), { status: 500 })
    }
}
