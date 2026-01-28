import { adminDb } from "@/lib/firebase-admin"
import { getCurrentUser } from "@/lib/session"

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        }

        const { postId } = await req.json()

        if (!postId) {
            return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 })
        }

        const postRef = adminDb.collection("posts").doc(postId)
        const postDoc = await postRef.get()

        if (!postDoc.exists) {
            return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 })
        }

        if (postDoc.data()?.authorId !== user.uid) {
            return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
        }

        await adminDb.runTransaction(async (transaction) => {
            // Delete related likes
            const likesSnapshot = await adminDb.collection("likes").where("postId", "==", postId).get()
            likesSnapshot.forEach((doc) => {
                transaction.delete(doc.ref)
            })

            // Delete related saves
            const savesSnapshot = await adminDb.collection("saves").where("postId", "==", postId).get()
            savesSnapshot.forEach((doc) => {
                transaction.delete(doc.ref)
            })

            // Delete the post
            transaction.delete(postRef)
        })

        return new Response(JSON.stringify({ success: true }), { status: 200 })
    } catch (error) {
        console.error("Delete post error:", error)
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Delete post failed" }), { status: 500 })
    }
}