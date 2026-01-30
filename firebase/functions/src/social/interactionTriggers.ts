import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

/**
 * Updates the comment's like count when a new like is created.
 * Also syncs to user's commentLikes subcollection.
 * Listens to: posts/{postId}/comments/{commentId}/likes/{uid}
 */
export const onCommentLikeCreated = onDocumentCreated("posts/{postId}/comments/{commentId}/likes/{uid}", async (event) => {
    const { postId, commentId, uid } = event.params;
    const db = getFirestore();

    logger.info(`Updating likeCount for comment ${commentId} on post ${postId} (Like Created) by user ${uid}`);

    const commentRef = db.collection("posts").doc(postId).collection("comments").doc(commentId);
    const userCommentLikeRef = db.collection("users").doc(uid).collection("commentLikes").doc(commentId);

    try {
        await Promise.all([
            commentRef.update({
                likeCount: FieldValue.increment(1)
            }),
            userCommentLikeRef.set({
                postId: postId,
                commentId: commentId,
                createdAt: FieldValue.serverTimestamp()
            })
        ]);
    } catch (error) {
        logger.error(`Failed to update like count for comment ${commentId}:`, error);
    }
});

/**
 * Updates the comment's like count when a like is deleted.
 * Also removes from user's commentLikes subcollection.
 * Listens to: posts/{postId}/comments/{commentId}/likes/{uid}
 */
export const onCommentLikeDeleted = onDocumentDeleted("posts/{postId}/comments/{commentId}/likes/{uid}", async (event) => {
    const { postId, commentId, uid } = event.params;
    const db = getFirestore();

    logger.info(`Updating likeCount for comment ${commentId} on post ${postId} (Like Deleted) by user ${uid}`);

    const commentRef = db.collection("posts").doc(postId).collection("comments").doc(commentId);
    const userCommentLikeRef = db.collection("users").doc(uid).collection("commentLikes").doc(commentId);

    try {
        await Promise.all([
            commentRef.update({
                likeCount: FieldValue.increment(-1)
            }),
            userCommentLikeRef.delete()
        ]);
    } catch (error) {
        logger.error(`Failed to update like count for comment ${commentId}:`, error);
    }
});

/**
 * Updates the post's save count and user's savedPosts when a post is saved.
 * Listens to: posts/{postId}/saves/{uid}
 */
export const onPostSaveCreated = onDocumentCreated("posts/{postId}/saves/{uid}", async (event) => {
    const { postId, uid } = event.params;
    const db = getFirestore();

    logger.info(`Updating saveCount for post ${postId} and sync user ${uid} (Save Created)`);

    const postRef = db.collection("posts").doc(postId);
    const userSaveRef = db.collection("users").doc(uid).collection("savedPosts").doc(postId);

    try {
        await Promise.all([
            postRef.update({ saveCount: FieldValue.increment(1) }),
            userSaveRef.set({
                postId: postId,
                createdAt: FieldValue.serverTimestamp()
            })
        ]);
    } catch (error) {
        logger.error(`Failed to update save data for post ${postId} / user ${uid}:`, error);
    }
});

/**
 * Updates the post's save count and user's savedPosts when a post is unsaved.
 * Listens to: posts/{postId}/saves/{uid}
 */
export const onPostSaveDeleted = onDocumentDeleted("posts/{postId}/saves/{uid}", async (event) => {
    const { postId, uid } = event.params;
    const db = getFirestore();

    logger.info(`Updating saveCount for post ${postId} and sync user ${uid} (Save Deleted)`);

    const postRef = db.collection("posts").doc(postId);
    const userSaveRef = db.collection("users").doc(uid).collection("savedPosts").doc(postId);

    try {
        await Promise.all([
            postRef.update({ saveCount: FieldValue.increment(-1) }),
            userSaveRef.delete()
        ]);
    } catch (error) {
        logger.error(`Failed to update save data for post ${postId} / user ${uid}:`, error);
    }
});

/**
 * Syncs comment to user's comments subcollection when a comment is created.
 * Listens to: posts/{postId}/comments/{commentId}
 */
export const onCommentCreated = onDocumentCreated("posts/{postId}/comments/{commentId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const { postId, commentId } = event.params;
    const data = snapshot.data();
    const authorId = data.authorId;

    if (!authorId) return;

    const db = getFirestore();

    logger.info(`Syncing comment ${commentId} to user ${authorId}'s comments subcollection`);

    const userCommentRef = db.collection("users").doc(authorId).collection("comments").doc(commentId);

    try {
        await userCommentRef.set({
            postId: postId,
            commentId: commentId,
            text: data.text || "",
            createdAt: data.createdAt || FieldValue.serverTimestamp()
        });
    } catch (error) {
        logger.error(`Failed to sync comment ${commentId} to user ${authorId}:`, error);
    }
});

/**
 * Removes comment from user's comments subcollection when a comment is deleted.
 * Listens to: posts/{postId}/comments/{commentId}
 */
export const onCommentDeleted = onDocumentDeleted("posts/{postId}/comments/{commentId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const { commentId } = event.params;
    const data = snapshot.data();
    const authorId = data.authorId;

    if (!authorId) return;

    const db = getFirestore();

    logger.info(`Removing comment ${commentId} from user ${authorId}'s comments subcollection`);

    const userCommentRef = db.collection("users").doc(authorId).collection("comments").doc(commentId);

    try {
        await userCommentRef.delete();
    } catch (error) {
        logger.error(`Failed to remove comment ${commentId} from user ${authorId}:`, error);
    }
});
