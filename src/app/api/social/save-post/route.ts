import { getCurrentUser } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
    try {
        let isSaved = false;

        const user = await getCurrentUser();
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { postId } = await req.json();

        if (!postId) {
            return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
        }

        const saveDocId = `${user.uid}_${postId}`;

        await adminDb.runTransaction(async (transaction) => {
            const postRef = adminDb.collection("posts").doc(postId);
            const saveRef = adminDb.collection("postSaves").doc(saveDocId);
            const userSaveRef = adminDb.collection("users").doc(user.uid);
            const [postDoc, existingSave] = await Promise.all([
                transaction.get(postRef),
                transaction.get(saveRef)
            ]);

            // Check if post exists
            if (!postDoc.exists) {
                throw new Error("Post not found");
            }

            // Check if already saved
            if (existingSave.exists) {
                // Unsave the post
                transaction.delete(saveRef);

                // Decrement save count on post
                const newSaveCount = Math.max((postDoc.data()?.saveCount || 1) - 1, 0);
                transaction.update(postRef, {
                    saveCount: newSaveCount
                });
                isSaved = false;

                // Remove saved post from users savedPosts
                transaction.update(userSaveRef, {
                    savedPosts: FieldValue.arrayRemove(postId)
                });
                
            } else {
                // Save the post
                transaction.set(saveRef, {
                    uid: user.uid,
                    postId: postId,
                    createdAt: FieldValue.serverTimestamp()
                });

                // Increment save count on post
                const newSaveCount = (postDoc.data()?.saveCount || 0) + 1;
                transaction.update(postRef, {
                    saveCount: newSaveCount
                }); 
                isSaved = true;

                // Add saved post to users savedPosts
                transaction.update(userSaveRef, {
                    savedPosts: FieldValue.arrayUnion(postId)
                });
            }
        });

        return new Response(JSON.stringify({ success: true, isSaved: isSaved }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message || "Internal Server Error" }), { status: 500 });
    }
}