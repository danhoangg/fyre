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

        const { postId } = await req.json();

        if (!postId) {
            return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
        }

        const likeDocId = `${user.uid}_${postId}`;

        await adminDb.runTransaction(async (transaction) => {
            const postRef = adminDb.collection("posts").doc(postId);
            const likeRef = adminDb.collection("postLikes").doc(likeDocId);

            const [postDoc, existingLike] = await Promise.all([
                transaction.get(postRef),
                transaction.get(likeRef)
            ]);

            // Check if post exists
            if (!postDoc.exists) {
                throw new Error("Post not found");
            }

            let newLikeCount: number;
            // Check if already liked
            if (existingLike.exists) {
                // Unlike the post
                transaction.delete(likeRef);

                // Decrement like count on post
                newLikeCount = Math.max((postDoc.data()?.likeCount || 1) - 1, 0);
                isLiked = false;
            } else {
                // Like the post
                transaction.set(likeRef, {
                    uid: user.uid,
                    postId: postId,
                    createdAt: FieldValue.serverTimestamp()
                });

                // Increment like count on post
                newLikeCount = (postDoc.data()?.likeCount || 0) + 1;
                isLiked = true;
            }

            const createdAt = postDoc.data()?.createdAt;
            const now = Date.now();
            const createdDate = new Date(createdAt._seconds * 1000);
            const diffInMs = now - createdDate.getTime();
            const diffInHours = Math.floor(diffInMs / 3600000);
            const score = newLikeCount / Math.pow((diffInHours + 2), 1.5);

            transaction.update(postRef, {
                likeCount: newLikeCount,
                score: score
            });
        });

        return new Response(JSON.stringify({ success: true, isLiked: isLiked }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message || "Internal Server Error" }), { status: 500 });
    }
}