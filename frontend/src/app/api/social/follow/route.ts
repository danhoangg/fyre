import { getCurrentUser } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { invalidateFollowCache } from "@/lib/cache";

export async function POST(req: Request) {
    let isNowFollowing = false;

    try {
        const user = await getCurrentUser();
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { followUid } = await req.json();

        if (!followUid) {
            return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
        }

        if (user.uid === followUid) {
            return new Response(JSON.stringify({ error: "Cannot follow yourself" }), { status: 400 });
        }

        const followDocId = `${user.uid}_${followUid}`;
        const reverseFollowDocId = `${followUid}_${user.uid}`;

        await adminDb.runTransaction(async (transaction) => {
            // ALL READS FIRST
            const userRef = adminDb.collection("users").doc(user.uid);
            const targetUserRef = adminDb.collection("users").doc(followUid);
            const followRef = adminDb.collection("follows").doc(followDocId);
            const reverseFollowRef = adminDb.collection("follows").doc(reverseFollowDocId);

            const [userDoc, targetUserDoc, existingFollow, reverseFollow] = await Promise.all([
                transaction.get(userRef),
                transaction.get(targetUserRef),
                transaction.get(followRef),
                transaction.get(reverseFollowRef),
            ]);

            // Check if target user exists
            if (!targetUserDoc.exists) {
                throw new Error("User not found");
            }

            // ALL WRITES AFTER READS
            if (existingFollow.exists) {
                // Currently following - UNFOLLOW
                transaction.delete(followRef);
                isNowFollowing = false;

                transaction.update(userRef, {
                    followingCount: FieldValue.increment(-1),
                });
                transaction.update(targetUserRef, {
                    followersCount: FieldValue.increment(-1),
                });

                // Remove from subcollections
                transaction.delete(adminDb.collection("users").doc(user.uid).collection("following").doc(followUid));
                transaction.delete(adminDb.collection("users").doc(followUid).collection("followers").doc(user.uid));

                // Remove from friends if they were friends
                transaction.delete(adminDb.collection("users").doc(user.uid).collection("friends").doc(followUid));
                transaction.delete(adminDb.collection("users").doc(followUid).collection("friends").doc(user.uid));
            } else {
                // Not following - FOLLOW
                transaction.set(followRef, {
                    fromUid: user.uid,
                    toUid: followUid,
                    createdAt: FieldValue.serverTimestamp()
                });
                isNowFollowing = true;

                transaction.update(userRef, {
                    followingCount: FieldValue.increment(1),
                });
                transaction.update(targetUserRef, {
                    followersCount: FieldValue.increment(1),
                });

                const targetUserData = targetUserDoc.data();
                const currentUserData = userDoc.data();

                // Add to subcollections
                transaction.set(adminDb.collection("users").doc(user.uid).collection("following").doc(followUid), {
                    uid: followUid,
                    username: targetUserData?.username || "",
                    avatarUrl: targetUserData?.avatarUrl || "",
                    description: targetUserData?.description || "",
                    createdAt: FieldValue.serverTimestamp()
                });

                transaction.set(adminDb.collection("users").doc(followUid).collection("followers").doc(user.uid), {
                    uid: user.uid,
                    username: currentUserData?.username || "",
                    avatarUrl: currentUserData?.avatarUrl || "",
                    description: currentUserData?.description || "",
                    createdAt: FieldValue.serverTimestamp()
                });

                // If they follow each other, create friend documents in subcollections
                if (reverseFollow.exists) {
                    transaction.set(adminDb.collection("users").doc(user.uid).collection("friends").doc(followUid), {
                        uid: followUid,
                        username: targetUserData?.username || "",
                        avatarUrl: targetUserData?.avatarUrl || "",
                        description: targetUserData?.description || "",
                        createdAt: FieldValue.serverTimestamp()
                    });

                    transaction.set(adminDb.collection("users").doc(followUid).collection("friends").doc(user.uid), {
                        uid: user.uid,
                        username: currentUserData?.username || "",
                        avatarUrl: currentUserData?.avatarUrl || "",
                        description: currentUserData?.description || "",
                        createdAt: FieldValue.serverTimestamp()
                    });
                }
            }
        });

        // Invalidate cache after successful update
        invalidateFollowCache(user.uid, followUid);

        return new Response(JSON.stringify({ success: true, isFollowing: isNowFollowing }), { status: 200 });
    } catch (error) {
        console.error("Follow toggle error:", error);
        return new Response(JSON.stringify({ error: `Failed to ${isNowFollowing ? "follow" : "unfollow"}` }), { status: 500 });
    }
}