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
            const userFriendsRef = adminDb.collection("friends").doc(user.uid);
            const targetFriendsRef = adminDb.collection("friends").doc(followUid);

            const [userDoc, targetUserDoc, existingFollow, reverseFollow, userFriendsDoc, targetFriendsDoc] = await Promise.all([
                transaction.get(userRef),
                transaction.get(targetUserRef),
                transaction.get(followRef),
                transaction.get(reverseFollowRef),
                transaction.get(userFriendsRef),
                transaction.get(targetFriendsRef)
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
                    following: FieldValue.arrayRemove(followUid)
                });
                transaction.update(targetUserRef, {
                    followersCount: FieldValue.increment(-1),
                    followers: FieldValue.arrayRemove(user.uid)
                });

                // Remove from friends if they were friends
                if (userFriendsDoc.exists) {
                    const friendsList = userFriendsDoc.data()?.friends || [];
                    if (friendsList.includes(followUid)) {
                        transaction.update(userFriendsRef, {
                            friends: FieldValue.arrayRemove(followUid)
                        });
                    }
                }

                if (targetFriendsDoc.exists) {
                    const friendsList = targetFriendsDoc.data()?.friends || [];
                    if (friendsList.includes(user.uid)) {
                        transaction.update(targetFriendsRef, {
                            friends: FieldValue.arrayRemove(user.uid)
                        });
                    }
                }
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
                    following: FieldValue.arrayUnion(followUid)
                });
                transaction.update(targetUserRef, {
                    followersCount: FieldValue.increment(1),
                    followers: FieldValue.arrayUnion(user.uid)
                });

                // If they follow each other, create friend documents
                if (reverseFollow.exists) {
                    transaction.set(userFriendsRef, {
                        friends: FieldValue.arrayUnion(followUid)
                    }, { merge: true });

                    transaction.set(targetFriendsRef, {
                        friends: FieldValue.arrayUnion(user.uid)
                    }, { merge: true });
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