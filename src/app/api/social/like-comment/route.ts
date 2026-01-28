import { getCurrentUser } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
    try {
        let isLiked = false;

        const user = await getCurrentUser();
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { postId, commentId } = await req.json();
        
        if (!commentId) {
            return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
        }

        const likeDocId = `${user.uid}_${commentId}`;

        await adminDb.runTransaction(async (transaction) => {
            const commentRef = adminDb.collection("posts").doc(postId).collection("comments").doc(commentId);
            const likeRef = adminDb.collection("commentLikes").doc(likeDocId);

            const [commentDoc, existingLike] = await Promise.all([
                transaction.get(commentRef),
                transaction.get(likeRef)
            ]);

            // Check if comment exists
            if (!commentDoc.exists) {
                throw new Error("Comment not found");
            }

            // Check if already liked
            if (existingLike.exists) {
                // Unlike the comment
                transaction.delete(likeRef);

                // Decrement like count on comment
                const newLikeCount = Math.max((commentDoc.data()?.likeCount || 1) - 1, 0);
                transaction.update(commentRef, {
                    likeCount: newLikeCount
                });
                isLiked = false;
            } else {
                // Like the comment
                transaction.set(likeRef, {
                    uid: user.uid,
                    postId: postId,
                    commentId: commentId,
                    createdAt: FieldValue.serverTimestamp()
                });

                // Increment like count on comment
                const newLikeCount = (commentDoc.data()?.likeCount || 0) + 1;
                transaction.update(commentRef, {
                    likeCount: newLikeCount
                }); 
                isLiked = true;
            }
        });

        return new Response(JSON.stringify({ success: true, isLiked: isLiked }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message || "Internal Server Error" }), { status: 500 });
    }
}