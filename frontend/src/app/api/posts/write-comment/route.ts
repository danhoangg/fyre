import { adminDb } from "@/lib/firebase-admin"
import { getCurrentUser } from "@/lib/session"
import * as admin from "firebase-admin"

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        }

        const { postId, content } = await req.json()

        if (!postId || !content) {
            return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 })
        }

        const postExists = await adminDb.collection("posts").doc(postId).get()
        if (!postExists.exists) {
            return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 })
        }

        // Add comment to postid comments subcollection
        const commentData = {
            authorId: user.uid,
            text: content,
            likeCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }

        const commentRef = await adminDb.collection("posts").doc(postId).collection("comments").add(commentData)

        return new Response(JSON.stringify({ success: true, commentId: commentRef.id }), { status: 200 })
    } catch (error) {
        console.error("Write comment error:", error)
        return new Response(JSON.stringify({ error: "Failed to write comment" }), { status: 500 })
    }
}