import { adminDb } from "@/lib/firebase-admin"
import { getCurrentUser } from "@/lib/session"

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        }

        const { postId, commentId } = await req.json()

        if (!postId || !commentId) {
            return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 })
        }

        const postRef = adminDb.collection("posts").doc(postId)
        const postDoc = await postRef.get()

        if (!postDoc.exists) {
            return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 })
        }

        const commentRef = postRef.collection("comments").doc(commentId)
        const commentDoc = await commentRef.get()

        if (!commentDoc.exists) {
            return new Response(JSON.stringify({ error: "Comment not found" }), { status: 404 })
        }

        if (commentDoc.data()?.authorId !== user.uid) {
            return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
        }

        await adminDb.runTransaction(async (transaction) => {
            // Delete related likes
            const likesSnapshot = await adminDb.collection("commentLikes").where("commentId", "==", commentId).get()
            likesSnapshot.forEach((doc) => {
                transaction.delete(doc.ref)
            })
            
            // Delete the comment
            transaction.delete(commentRef)
        })

        return new Response(JSON.stringify({ success: true }), { status: 200 })
    } catch (error) {
        console.error("Delete comment error:", error)
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Delete comment failed" }), { status: 500 })
    }
}