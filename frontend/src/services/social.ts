import { uploadFile, deleteFileByUrl } from "@/lib/storage";
import { db, auth, functions } from "@/lib/firebase";
import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    limit,
    documentId,
    updateDoc,
    orderBy,
    startAfter,
    Timestamp
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { signOut } from "firebase/auth";
import { normalizeUsername } from "@/lib/utils";

// Callable function references
const checkUsernameCallable = httpsCallable(functions, "checkUsername");
const deleteAccountCallable = httpsCallable(functions, "deleteAccount");

/**
 * Get comments for a post with pagination, using client SDK.
 */
export const getComments = async (
    postId: string,
    lastCommentId?: string,
    pageLimit: number = 10
): Promise<{
    comments: any[];
    hasMore: boolean;
    lastCommentId: string | null;
}> => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    try {
        const commentsRef = collection(db, "posts", postId, "comments");
        let q = query(commentsRef, orderBy("createdAt", "desc"), limit(pageLimit + 1));

        if (lastCommentId) {
            const lastDoc = await getDoc(doc(db, "posts", postId, "comments", lastCommentId));
            if (lastDoc.exists()) {
                q = query(commentsRef, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(pageLimit + 1));
            }
        }

        const querySnapshot = await getDocs(q);
        const hasMore = querySnapshot.docs.length > pageLimit;
        const commentDocs = querySnapshot.docs.slice(0, pageLimit);

        const comments = commentDocs.map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt
            };
        });

        // Get user info for each comment
        const userIds = [...new Set(comments.map((c: any) => c.authorId).filter(Boolean))];
        const usersMap: Record<string, any> = {};

        if (userIds.length > 0) {
            // Batch fetch users (Firestore "in" query limited to 30)
            const chunks: string[][] = [];
            for (let i = 0; i < userIds.length; i += 30) {
                chunks.push(userIds.slice(i, i + 30));
            }

            for (const chunk of chunks) {
                const usersSnapshot = await getDocs(
                    query(collection(db, "users"), where(documentId(), "in", chunk))
                );
                usersSnapshot.docs.forEach((userDoc) => {
                    usersMap[userDoc.id] = userDoc.data();
                });
            }
        }

        // Get liked status for comments
        const commentsWithUserAndLikes = await Promise.all(
            comments.map(async (comment: any) => {
                const userData = usersMap[comment.authorId];
                const likeRef = doc(db, "posts", postId, "comments", comment.id, "likes", user.uid);
                const likeDoc = await getDoc(likeRef);

                return {
                    ...comment,
                    username: userData?.username || "Unknown",
                    avatarUrl: userData?.avatarUrl || null,
                    isLiked: likeDoc.exists()
                };
            })
        );

        return {
            comments: commentsWithUserAndLikes,
            hasMore,
            lastCommentId: comments.length > 0 ? comments[comments.length - 1].id : null
        };
    } catch (error) {
        console.error("Error fetching comments:", error);
        throw new Error("Failed to fetch comments");
    }
};

export const toggleLikePost = async (postId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    const likeRef = doc(db, "posts", postId, "likes", user.uid);

    try {
        const likeDoc = await getDoc(likeRef);

        if (likeDoc.exists()) {
            await deleteDoc(likeRef);
            return false; // isLiked = false
        } else {
            await setDoc(likeRef, {
                createdAt: serverTimestamp()
            });
            return true; // isLiked = true
        }
    } catch (error) {
        console.error("Error toggling like:", error);
        throw new Error("Failed to toggle like");
    }
}

export const toggleLikeComment = async (postId: string, commentId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    const likeRef = doc(db, "posts", postId, "comments", commentId, "likes", user.uid);

    try {
        const likeDoc = await getDoc(likeRef);

        if (likeDoc.exists()) {
            await deleteDoc(likeRef);
            return false;
        } else {
            await setDoc(likeRef, {
                createdAt: serverTimestamp()
            });
            return true;
        }
    } catch (error) {
        console.error("Error toggling like on comment:", error);
        throw new Error("Failed to toggle like on comment");
    }
}

export const toggleSavePost = async (postId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    const saveRef = doc(db, "posts", postId, "saves", user.uid);

    try {
        const saveDoc = await getDoc(saveRef);

        if (saveDoc.exists()) {
            await deleteDoc(saveRef);
            return false;
        } else {
            await setDoc(saveRef, {
                createdAt: serverTimestamp()
            });
            return true;
        }
    } catch (error) {
        console.error("Error toggling save:", error);
        throw new Error("Failed to toggle save");
    }
}

export const toggleFollow = async (followUid: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");
    if (user.uid === followUid) throw new Error("Cannot follow yourself");

    // Check if already following by looking at the following subcollection
    const followingRef = doc(db, "users", user.uid, "following", followUid);

    try {
        const followingDoc = await getDoc(followingRef);

        if (followingDoc.exists()) {
            // Unfollow - delete from both subcollections
            const followerRef = doc(db, "users", followUid, "followers", user.uid);
            await Promise.all([
                deleteDoc(followingRef),
                deleteDoc(followerRef)
            ]);
            return false;
        } else {
            // Follow - add to both subcollections
            const followerRef = doc(db, "users", followUid, "followers", user.uid);
            await Promise.all([
                setDoc(followingRef, {
                    createdAt: serverTimestamp()
                }),
                setDoc(followerRef, {
                    createdAt: serverTimestamp()
                })
            ]);
            return true;
        }
    } catch (error) {
        console.error("Error toggling follow:", error);
        throw new Error("Failed to toggle follow");
    }
}

export const getUserByUsername = async (username: string) => {
    try {
        const normalizedUsername = normalizeUsername(username);
        const q = query(collection(db, "users"), where("normalizedUsername", "==", normalizedUsername), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("User not found");
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();

        // Check if current user is following this user via subcollection
        let isFollowing = false;
        if (auth.currentUser) {
            const followingDoc = await getDoc(doc(db, "users", auth.currentUser.uid, "following", userDoc.id));
            isFollowing = followingDoc.exists();
        }

        return {
            uid: userDoc.id,
            isFollowing,
            ...userData,
            createdAt: userData.createdAt?.toDate?.()?.toISOString() || userData.createdAt
        };
    } catch (error) {
        console.error("Error getting user by username:", error);
        throw error;
    }
}

export const getUsers = async (userUids: string[]) => {
    if (!userUids || userUids.length === 0) return [];

    try {
        const chunks = [];
        for (let i = 0; i < userUids.length; i += 30) {
            chunks.push(userUids.slice(i, i + 30));
        }

        const userDocsResults = await Promise.all(
            chunks.map(chunk =>
                getDocs(query(collection(db, "users"), where(documentId(), "in", chunk)))
            )
        );

        const users = userDocsResults.flatMap(snapshot =>
            snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
            }))
        );

        // Fetch follow status if user is logged in via subcollection
        if (auth.currentUser) {
            const followStatuses = await Promise.all(
                users.map(async (u) => {
                    const followingDoc = await getDoc(doc(db, "users", auth.currentUser!.uid, "following", u.uid));
                    return { uid: u.uid, isFollowing: followingDoc.exists() };
                })
            );

            return users.map(u => ({
                ...u,
                isFollowing: followStatuses.find(f => f.uid === u.uid)?.isFollowing || false
            }));
        }

        return users;
    } catch (error) {
        console.error("Error getting users:", error);
        throw error;
    }
}

export const getFollowersDataPaginated = async (
    uid: string,
    lastFollowerId?: string,
    pageLimit: number = 20
): Promise<{ users: any[]; hasMore: boolean; lastFollowerId: string | null }> => {
    const currentUser = auth.currentUser;
    if (!uid) throw new Error("No UID provided");

    try {
        const followersRef = collection(db, "users", uid, "followers");
        let q = query(followersRef, orderBy("createdAt", "desc"), limit(pageLimit + 1));

        if (lastFollowerId) {
            const lastDoc = await getDoc(doc(db, "users", uid, "followers", lastFollowerId));
            if (lastDoc.exists()) {
                q = query(followersRef, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(pageLimit + 1));
            }
        }

        const followersSnapshot = await getDocs(q);
        const hasMore = followersSnapshot.docs.length > pageLimit;
        const followerDocs = followersSnapshot.docs.slice(0, pageLimit);
        const followerIds = followerDocs.map(doc => doc.id);

        // Get the last follower ID for pagination
        const newLastFollowerId = followerDocs.length > 0 ? followerDocs[followerDocs.length - 1].id : null;

        if (followerIds.length === 0) return { users: [], hasMore: false, lastFollowerId: null };

        const users = await getUsers(followerIds);

        // Add isFollowing status for each user
        if (currentUser) {
            const usersWithFollowStatus = await Promise.all(
                users.map(async (user: any) => {
                    const followingDoc = await getDoc(doc(db, "users", currentUser.uid, "following", user.uid));
                    return { ...user, isFollowing: followingDoc.exists() };
                })
            );
            return { users: usersWithFollowStatus, hasMore, lastFollowerId: newLastFollowerId };
        }

        return { users, hasMore, lastFollowerId: newLastFollowerId };
    } catch (error) {
        console.error("Error getting followers data paginated:", error);
        throw error;
    }
}

export const getFollowingDataPaginated = async (
    uid: string,
    lastFollowerId?: string,
    pageLimit: number = 20
): Promise<{ users: any[]; hasMore: boolean; lastFollowerId: string | null }> => {
    const currentUser = auth.currentUser;
    if (!uid) throw new Error("No UID provided");

    try {
        const followingRef = collection(db, "users", uid, "following");
        let q = query(followingRef, orderBy("createdAt", "desc"), limit(pageLimit + 1));

        if (lastFollowerId) {
            const lastDoc = await getDoc(doc(db, "users", uid, "following", lastFollowerId));
            if (lastDoc.exists()) {
                q = query(followingRef, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(pageLimit + 1));
            }
        }

        const followingSnapshot = await getDocs(q);
        const hasMore = followingSnapshot.docs.length > pageLimit;
        const followingDocs = followingSnapshot.docs.slice(0, pageLimit);
        const followingIds = followingDocs.map(doc => doc.id);

        // Get the last following ID for pagination
        const newLastFollowerId = followingDocs.length > 0 ? followingDocs[followingDocs.length - 1].id : null;

        if (followingIds.length === 0) return { users: [], hasMore: false, lastFollowerId: null };

        const users = await getUsers(followingIds);

        // Add isFollowing status for each user (they're all being followed in this case)
        if (currentUser) {
            const usersWithFollowStatus = users.map((user: any) => ({
                ...user,
                isFollowing: true // All users in following list are being followed
            }));
            return { users: usersWithFollowStatus, hasMore, lastFollowerId: newLastFollowerId };
        }

        return { users, hasMore, lastFollowerId: newLastFollowerId };
    } catch (error) {
        console.error("Error getting following data paginated:", error);
        throw error;
    }
}

export const getFriendsData = async (uid?: string) => {
    const targetUid = uid || auth.currentUser?.uid;
    if (!targetUid) throw new Error("No UID provided");

    try {
        const friendsSnapshot = await getDocs(collection(db, "users", targetUid, "friends"));
        const friendIds = friendsSnapshot.docs.map(doc => doc.id);

        if (friendIds.length === 0) return [];

        // Include conversation id from friend doc data
        const friendsDataPromises = friendIds.map(async (friendId) => {
            const friendDoc = await getDoc(doc(db, "users", targetUid, "friends", friendId));
            const friendData = friendDoc.data() || {};
            return { uid: friendId, conversationId: friendData.conversationId || null };
        });

        const friendsData = await Promise.all(friendsDataPromises);
        const users = await getUsers(friendsData.map(f => f.uid));

        // Merge conversationId into user data
        return users.map(user => {
            const friendData = friendsData.find(f => f.uid === user.uid);
            return {
                ...user,
                conversationId: friendData?.conversationId || null
            };
        });
    } catch (error) {
        console.error("Error getting friends data:", error);
        throw error;
    }
}

export const searchUsers = async (searchQuery: string) => {
    try {
        const normalizedQuery = normalizeUsername(searchQuery);
        const q = query(
            collection(db, "users"),
            where("normalizedUsername", ">=", normalizedQuery),
            where("normalizedUsername", "<=", normalizedQuery + '\uf8ff'),
            limit(10)
        );
        const querySnapshot = await getDocs(q);

        const users = querySnapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
        }));

        if (auth.currentUser) {
            const followStatuses = await Promise.all(
                users.map(async (u) => {
                    const followingDoc = await getDoc(doc(db, "users", auth.currentUser!.uid, "following", u.uid));
                    return { uid: u.uid, isFollowing: followingDoc.exists() };
                })
            );

            return users.map(u => ({
                ...u,
                isFollowing: followStatuses.find(f => f.uid === u.uid)?.isFollowing || false
            }));
        }

        return users;
    } catch (error) {
        console.error("Error searching users:", error);
        throw error;
    }
}

export const deleteAccount = async () => {
    try {
        await deleteAccountCallable();
        await signOut(auth);
    } catch (error) {
        console.error("Error deleting account:", error);
        throw error;
    }
}

export const editProfile = async (username: string, description: string, currentAvatarUrl: string, currentUsername: string, avatarFile?: File) => {
    let newAvatarUrl = currentAvatarUrl;
    let uploadedAvatarUrl: string | null = null;
    const user = auth.currentUser;

    if (!user) throw new Error("Unauthorized");

    try {
        if (username !== currentUsername) {
            const { data: { available } } = await checkUsernameCallable({ username }) as any;
            if (!available) {
                throw new Error("Username is not available");
            }
        }

        if (avatarFile) {
            newAvatarUrl = await uploadFile(avatarFile, "avatars");
            uploadedAvatarUrl = newAvatarUrl;
        }

        await updateDoc(doc(db, "users", user.uid), {
            username,
            normalizedUsername: normalizeUsername(username),
            description,
            avatarUrl: newAvatarUrl
        });

        if (uploadedAvatarUrl && currentAvatarUrl && !currentAvatarUrl.includes("/default-avatar.png")) {
            try {
                await deleteFileByUrl(currentAvatarUrl);
            } catch (deleteErr) {
                console.error("Failed to delete old avatar:", deleteErr);
            }
        }

        return newAvatarUrl;
    } catch (error) {
        if (uploadedAvatarUrl) {
            try {
                await deleteFileByUrl(uploadedAvatarUrl);
            } catch (deleteErr) {
                console.error("Failed to delete uploaded avatar during rollback:", deleteErr);
            }
        }
        throw error;
    }
}
