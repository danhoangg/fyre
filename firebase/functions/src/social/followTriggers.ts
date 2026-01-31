import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

/**
 * Handles all logic for when a user follows another user:
 * 1. Updates followingCount for the follower.
 * 2. Updates followersCount for the followee.
 * 3. Syncs the followers subcollection on the followee.
 * 4. Checks for mutual follow to establish 'friends' status.
 * 
 * Listens to: users/{fromUid}/following/{toUid}
 */
export const onFollowCreated = onDocumentCreated("users/{fromUid}/following/{toUid}", async (event) => {
    const { fromUid, toUid } = event.params;
    const db = getFirestore();

    logger.info(`Processing follow: ${fromUid} -> ${toUid}`);

    const followerRef = db.collection("users").doc(fromUid);
    const followeeRef = db.collection("users").doc(toUid);

    try {
        const [followerDoc, followeeDoc, reverseFollow] = await Promise.all([
            followerRef.get(),
            followeeRef.get(),
            followeeRef.collection("following").doc(fromUid).get()
        ]);

        const followerData = followerDoc.data();
        const followeeData = followeeDoc.data();

        const batch = db.batch();

        // 1 & 2: Update counts
        batch.update(followerRef, { followingCount: FieldValue.increment(1) });
        batch.update(followeeRef, { followersCount: FieldValue.increment(1) });

        // 3: Update the following doc with user data for easy UI display
        batch.update(followerRef.collection("following").doc(toUid), {
            uid: toUid,
            username: followeeData?.username || "",
            avatarUrl: followeeData?.avatarUrl || "",
            description: followeeData?.description || ""
        });

        // Also update followers subcollection on followee with follower data
        batch.update(followeeRef.collection("followers").doc(fromUid), {
            uid: fromUid,
            username: followerData?.username || "",
            avatarUrl: followerData?.avatarUrl || "",
            description: followerData?.description || ""
        });

        // 4: Handle Friend Status (if they follow each other)
        if (reverseFollow.exists) {
            // Create new conversation document for the new friends
            const conversationId = `${[fromUid, toUid].sort().join("_")}`;
            const conversationRef = db.collection("conversations").doc(conversationId);
            if (!(await conversationRef.get()).exists) {
                batch.set(conversationRef, {
                    users: [fromUid, toUid],
                    createdAt: FieldValue.serverTimestamp()
                });
            }

            batch.set(followerRef.collection("friends").doc(toUid), {
                avatarUrl: followeeData?.avatarUrl || "",
                description: followeeData?.description || "",
                username: followeeData?.username || "",
                createdAt: FieldValue.serverTimestamp(),
                conversationId: conversationId
            });
            batch.set(followeeRef.collection("friends").doc(fromUid), {
                avatarUrl: followerData?.avatarUrl || "",
                description: followerData?.description || "",
                username: followerData?.username || "",
                createdAt: FieldValue.serverTimestamp(),
                conversationId: conversationId
            });
        }

        await batch.commit();
    } catch (error) {
        logger.error(`Error processing follow ${fromUid} -> ${toUid}:`, error);
    }
});

/**
 * Handles unfollow logic:
 * 1. Decrement counts.
 * 2. Remove from friends list.
 * 
 * Listens to: users/{fromUid}/following/{toUid}
 */
export const onFollowDeleted = onDocumentDeleted("users/{fromUid}/following/{toUid}", async (event) => {
    const { fromUid, toUid } = event.params;
    const db = getFirestore();

    const followerRef = db.collection("users").doc(fromUid);
    const followeeRef = db.collection("users").doc(toUid);

    try {
        const batch = db.batch();

        batch.update(followerRef, { followingCount: FieldValue.increment(-1) });
        batch.update(followeeRef, { followersCount: FieldValue.increment(-1) });

        // Always attempt to delete friend link to ensure consistency
        batch.delete(followerRef.collection("friends").doc(toUid));
        batch.delete(followeeRef.collection("friends").doc(fromUid));

        await batch.commit();
    } catch (error) {
        logger.error(`Error processing unfollow ${fromUid} -> ${toUid}:`, error);
    }
});
