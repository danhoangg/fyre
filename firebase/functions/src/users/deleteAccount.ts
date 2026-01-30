import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";

export const deleteAccount = onCall({ region: "europe-west1", timeoutSeconds: 540 }, async (request) => {
    // Ensure the user is authenticated
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated to delete their account.");
    }

    const uid = request.auth.uid;
    const db = getFirestore();
    const auth = getAuth();
    const bucket = getStorage().bucket();

    try {
        logger.info(`Starting account deletion for user: ${uid}`);

        // 1. Fetch all user data to clean up
        const [
            postsSnapshot,
            followersSnapshot,
            followingSnapshot,
            friendsSnapshot,
            savedPostsSnapshot,
            userPostLikesSnapshot,
            userCommentLikesSnapshot,
            userCommentsSnapshot,
            myLikesSnapshot,
            mySavesSnapshot,
            myCommentLikesSnapshot,
            myCommentsSnapshot,
        ] = await Promise.all([
            db.collection("posts").where("authorId", "==", uid).get(),
            db.collection("users").doc(uid).collection("followers").get(),
            db.collection("users").doc(uid).collection("following").get(),
            db.collection("users").doc(uid).collection("friends").get(),
            db.collection("users").doc(uid).collection("savedPosts").get(),
            db.collection("users").doc(uid).collection("postLikes").get(),
            db.collection("users").doc(uid).collection("commentLikes").get(),
            db.collection("users").doc(uid).collection("comments").get(),
            db.collection("postLikes").where("uid", "==", uid).get(),
            db.collection("postSaves").where("uid", "==", uid).get(),
            db.collection("commentLikes").where("uid", "==", uid).get(),
            db.collectionGroup("comments").where("authorId", "==", uid).get(),
        ]);

        let batch = db.batch();
        let batchSize = 0;

        const commitBatchIfFull = async () => {
            if (batchSize >= 450) {
                await batch.commit();
                batch = db.batch();
                batchSize = 0;
            }
        };

        // A. Cleanup user's activity subcollections (postLikes, commentLikes, comments)
        for (const doc of [...userPostLikesSnapshot.docs, ...userCommentLikesSnapshot.docs, ...userCommentsSnapshot.docs]) {
            batch.delete(doc.ref);
            batchSize++;
            await commitBatchIfFull();
        }

        // B. Cleanup my posts (and their interactions)
        for (const postDoc of postsSnapshot.docs) {
            const postId = postDoc.id;
            
            // Deleting these will trigger count updates on other users if they saved them,
            // or just clean up the interaction records.
            const postLikes = await db.collection("postLikes").where("postId", "==", postId).get();
            const postSaves = await db.collection("postSaves").where("postId", "==", postId).get();
            
            for (const like of postLikes.docs) {
                batch.delete(like.ref);
                batchSize++;
                await commitBatchIfFull();
            }
            
            for (const save of postSaves.docs) {
                // Trigger onPostSaveDeleted will handle removing from the saver's subcollection
                batch.delete(save.ref);
                batchSize++;
                await commitBatchIfFull();
            }

            // Delete comments subcollection items
            const comments = await postDoc.ref.collection("comments").get();
            for (const comment of comments.docs) {
                const commentLikes = await db.collection("commentLikes").where("commentId", "==", comment.id).get();
                for (const cl of commentLikes.docs) {
                    batch.delete(cl.ref);
                    batchSize++;
                    await commitBatchIfFull();
                }
                batch.delete(comment.ref);
                batchSize++;
                await commitBatchIfFull();
            }

            batch.delete(postDoc.ref);
            batchSize++;
            await commitBatchIfFull();
        }

        // B. Cleanup following/followers - delete from other users' subcollections
        // For each user I'm following, remove me from their followers subcollection
        for (const followingDoc of followingSnapshot.docs) {
            const followedUserId = followingDoc.id;
            batch.delete(db.collection("users").doc(followedUserId).collection("followers").doc(uid));
            batchSize++;
            await commitBatchIfFull();
        }

        // For each user following me, remove me from their following subcollection
        for (const followerDoc of followersSnapshot.docs) {
            const followerUserId = followerDoc.id;
            batch.delete(db.collection("users").doc(followerUserId).collection("following").doc(uid));
            batchSize++;
            await commitBatchIfFull();
        }

        // C. Cleanup my interaction subcollections
        for (const doc of [...followersSnapshot.docs, ...followingSnapshot.docs, ...friendsSnapshot.docs, ...savedPostsSnapshot.docs]) {
            batch.delete(doc.ref);
            batchSize++;
            await commitBatchIfFull();
        }

        // D. Cleanup my own likes/saves/commentLikes
        // Each deletion fires a trigger to decrement counts on the target post/comment
        for (const doc of [...myLikesSnapshot.docs, ...mySavesSnapshot.docs, ...myCommentLikesSnapshot.docs]) {
            batch.delete(doc.ref);
            batchSize++;
            await commitBatchIfFull();
        }

        // E. Cleanup my comments (collectionGroup results)
        for (const commentDoc of myCommentsSnapshot.docs) {
            const clSnapshot = await db.collection("commentLikes").where("commentId", "==", commentDoc.id).get();
            for (const clDoc of clSnapshot.docs) {
                batch.delete(clDoc.ref);
                batchSize++;
                await commitBatchIfFull();
            }
            batch.delete(commentDoc.ref);
            batchSize++;
            await commitBatchIfFull();
        }

        // F. Delete the user document itself
        batch.delete(db.collection("users").doc(uid));
        batchSize++;
        
        // Final commit for Firestore
        await batch.commit();

        // G. Cleanup Storage (Post images)
        for (const postDoc of postsSnapshot.docs) {
            try {
                await bucket.deleteFiles({ prefix: `posts/${postDoc.id}/` });
            } catch (err) {
                logger.error(`Failed to delete storage for post ${postDoc.id}:`, err);
            }
        }

        // H. Cleanup Storage (Avatar)
        try {
            await bucket.deleteFiles({ prefix: `avatars/${uid}/` });
        } catch (err) {
            logger.error(`Failed to delete avatar storage for user ${uid}:`, err);
        }

        // I. Final Auth Deletion
        await auth.deleteUser(uid);

        logger.info(`Successfully deleted account for user: ${uid}`);
        return { success: true };

    } catch (error) {
        logger.error("Error during account deletion:", error);
        throw new HttpsError("internal", "Failed to delete account. Please try again later.");
    }
});
