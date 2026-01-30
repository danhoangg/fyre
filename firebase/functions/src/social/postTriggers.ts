import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

/**
 * Updates the post's like count and score when a new like is created.
 * Also syncs to user's postLikes subcollection.
 * Listens to: posts/{postId}/likes/{uid}
 */
export const onPostLikeCreated = onDocumentCreated("posts/{postId}/likes/{uid}", async (event) => {
    const { postId, uid } = event.params;
    const db = getFirestore();

    logger.info(`Updating counts for post ${postId} (Like Created) by user ${uid}`);

    const postRef = db.collection("posts").doc(postId);
    const userPostLikeRef = db.collection("users").doc(uid).collection("postLikes").doc(postId);

    try {
        await db.runTransaction(async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists) return;

            const postData = postDoc.data();
            const newLikeCount = (postData?.likeCount || 0) + 1;

            // Calculate new score: likeCount / (hoursSincePost + 2)^1.5
            const createdAt = postData?.createdAt;
            let score = 0;
            if (createdAt) {
                const createdDate = createdAt.toDate();
                const diffInMs = Date.now() - createdDate.getTime();
                const diffInHours = Math.floor(diffInMs / 3600000);
                score = newLikeCount / Math.pow((diffInHours + 2), 1.5);
            }

            transaction.update(postRef, {
                likeCount: newLikeCount,
                score: score
            });

            // Sync to user's postLikes subcollection
            transaction.set(userPostLikeRef, {
                postId: postId,
                createdAt: FieldValue.serverTimestamp()
            });
        });
    } catch (error) {
        logger.error(`Failed to update like count for post ${postId}:`, error);
    }
});

/**
 * Updates the post's like count and score when a like is deleted.
 * Also removes from user's postLikes subcollection.
 * Listens to: posts/{postId}/likes/{uid}
 */
export const onPostLikeDeleted = onDocumentDeleted("posts/{postId}/likes/{uid}", async (event) => {
    const { postId, uid } = event.params;
    const db = getFirestore();

    logger.info(`Updating counts for post ${postId} (Like Deleted) by user ${uid}`);

    const postRef = db.collection("posts").doc(postId);
    const userPostLikeRef = db.collection("users").doc(uid).collection("postLikes").doc(postId);

    try {
        await db.runTransaction(async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists) return;

            const postData = postDoc.data();
            const newLikeCount = Math.max((postData?.likeCount || 1) - 1, 0);

            const createdAt = postData?.createdAt;
            let score = 0;
            if (createdAt) {
                const createdDate = createdAt.toDate();
                const diffInMs = Date.now() - createdDate.getTime();
                const diffInHours = Math.floor(diffInMs / 3600000);
                score = newLikeCount / Math.pow((diffInHours + 2), 1.5);
            }

            transaction.update(postRef, {
                likeCount: newLikeCount,
                score: score
            });

            // Remove from user's postLikes subcollection
            transaction.delete(userPostLikeRef);
        });
    } catch (error) {
        logger.error(`Failed to update like count for post ${postId}:`, error);
    }
});
