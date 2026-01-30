import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

const db = getFirestore();

// Helper functions for checking like/save status
async function getPostsLikedStatus(postIds: string[], userId: string): Promise<{ [key: string]: boolean }> {
    if (!userId || postIds.length === 0) return {};

    const likeChecks = await Promise.all(
        postIds.map(postId =>
            db.collection("posts").doc(postId).collection("likes").doc(userId).get()
        )
    );

    const likedStatus: { [key: string]: boolean } = {};
    postIds.forEach((postId, index) => {
        likedStatus[postId] = likeChecks[index].exists;
    });

    return likedStatus;
}

async function getPostsSavedStatus(postIds: string[], userId: string): Promise<{ [key: string]: boolean }> {
    if (!userId || postIds.length === 0) return {};

    const saveChecks = await Promise.all(
        postIds.map(postId =>
            db.collection("posts").doc(postId).collection("saves").doc(userId).get()
        )
    );

    const savedStatus: { [key: string]: boolean } = {};
    postIds.forEach((postId, index) => {
        savedStatus[postId] = saveChecks[index].exists;
    });

    return savedStatus;
}

async function getCommentsLikedStatus(
    comments: { id: string; postId: string }[],
    userId: string
): Promise<{ [key: string]: boolean }> {
    if (!userId || comments.length === 0) return {};

    const likeChecks = await Promise.all(
        comments.map(comment =>
            db.collection("posts")
                .doc(comment.postId)
                .collection("comments")
                .doc(comment.id)
                .collection("likes")
                .doc(userId)
                .get()
        )
    );

    const likedStatus: { [key: string]: boolean } = {};
    comments.forEach((comment, index) => {
        likedStatus[comment.id] = likeChecks[index].exists;
    });

    return likedStatus;
}

async function getFollowStatuses(fromUid: string, toUids: string[]): Promise<{ [key: string]: boolean }> {
    if (!fromUid || toUids.length === 0) return {};

    const followChecks = await Promise.all(
        toUids.map(toUid =>
            db.collection("users").doc(fromUid).collection("following").doc(toUid).get()
        )
    );

    const followStatuses: { [key: string]: boolean } = {};
    toUids.forEach((toUid, index) => {
        followStatuses[toUid] = followChecks[index].exists;
    });

    return followStatuses;
}

async function getUserData(uid: string): Promise<any> {
    const userDoc = await db.collection("users").doc(uid).get();
    return userDoc.exists ? userDoc.data() : null;
}

// Helper to enrich posts with author info, comments, like/save status
async function enrichPosts(
    docs: FirebaseFirestore.QueryDocumentSnapshot[],
    requestingUserId?: string
): Promise<any[]> {
    // Extract unique author IDs for batch fetch
    const authorIds = Array.from(new Set(docs.map(doc => doc.data().authorId).filter(Boolean))) as string[];

    // Fetch all post authors in a single batch read
    const authorsMap: Record<string, any> = {};
    if (authorIds.length > 0) {
        const authorsSnapshot = await db.collection("users").where(FieldPath.documentId(), "in", authorIds).get();
        authorsSnapshot.docs.forEach(doc => {
            authorsMap[doc.id] = doc.data();
        });
    }

    // Fetch follow statuses for all authors
    const followStatuses = requestingUserId ? await getFollowStatuses(requestingUserId, authorIds) : {};

    const posts = await Promise.all(
        docs.map(async doc => {
            const postData: any = {
                id: doc.id,
                ...doc.data()
            };

            // Get post author info
            const authorData = authorsMap[postData.authorId];
            if (authorData) {
                postData.authorUsername = authorData.username;
                postData.authorAvatarUrl = authorData.avatarUrl;
                postData.isAuthorFollowed = followStatuses[postData.authorId] || false;
            } else {
                postData.authorUsername = "Unknown";
                postData.authorAvatarUrl = null;
                postData.isAuthorFollowed = false;
            }

            // Fetch only first 10 comments
            const commentsSnapshot = await doc.ref.collection("comments").orderBy("createdAt", "desc").limit(10).get();
            const comments = commentsSnapshot.docs.map(commentDoc => ({
                id: commentDoc.id,
                ...commentDoc.data()
            }));

            // Get user from comments.authorId
            const commentsWithUser = await Promise.all(
                comments.map(async comment => {
                    const userDoc = await getUserData((comment as any).authorId);

                    return {
                        ...comment,
                        authorId: (comment as any).authorId,
                        username: userDoc ? userDoc.username : "Unknown",
                        avatarUrl: userDoc ? userDoc.avatarUrl : null
                    };
                })
            );

            // Get total comment count
            const commentCountSnapshot = await doc.ref.collection("comments").count().get();
            const totalCommentCount = commentCountSnapshot.data().count;

            return {
                ...postData,
                commentCount: totalCommentCount,
                comments: commentsWithUser,
                hasMoreComments: totalCommentCount > 10
            };
        })
    );

    // Add liked/saved status if requesting user is provided
    if (requestingUserId && posts.length > 0) {
        const postIds = posts.map(p => p.id);
        // Build comments with postId for the new getCommentsLikedStatus signature
        const commentsWithPostId = posts.flatMap(p => 
            p.comments.map((c: any) => ({ id: c.id, postId: p.id }))
        );
        const [likedStatus, savedStatus, commentsLikedStatus] = await Promise.all([
            getPostsLikedStatus(postIds, requestingUserId),
            getPostsSavedStatus(postIds, requestingUserId),
            getCommentsLikedStatus(commentsWithPostId, requestingUserId),
        ]);

        posts.forEach(post => {
            post.isLiked = likedStatus[post.id] || false;
            post.isSaved = savedStatus[post.id] || false;

            post.comments = post.comments.map((comment: any) => ({
                ...comment,
                isLiked: commentsLikedStatus[comment.id] || false
            }));
        });
    }

    // Serialize Firestore Timestamps to ISO strings
    return JSON.parse(JSON.stringify(posts));
}

/**
 * Delete a post and all related data (likes, saves, comments)
 */
export const deletePost = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError("unauthenticated", "Unauthorized");
    }

    const { postId } = request.data;
    if (!postId) {
        throw new HttpsError("invalid-argument", "Post ID is required");
    }

    const postRef = db.collection("posts").doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
        throw new HttpsError("not-found", "Post not found");
    }

    if (postDoc.data()?.authorId !== uid) {
        throw new HttpsError("permission-denied", "Forbidden");
    }

    try {
        await db.runTransaction(async (transaction) => {
            // Delete related likes from subcollection
            const likesSnapshot = await postRef.collection("likes").get();
            likesSnapshot.forEach((doc) => {
                transaction.delete(doc.ref);
            });

            // Delete related saves from subcollection
            const savesSnapshot = await postRef.collection("saves").get();
            savesSnapshot.forEach((doc) => {
                transaction.delete(doc.ref);
            });

            // Delete the post
            transaction.delete(postRef);
        });

        return { success: true };
    } catch (error) {
        logger.error("Delete post error:", error);
        throw new HttpsError("internal", "Failed to delete post");
    }
});

/**
 * Delete a comment and all related likes
 */
export const deleteComment = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError("unauthenticated", "Unauthorized");
    }

    const { postId, commentId } = request.data;
    if (!postId || !commentId) {
        throw new HttpsError("invalid-argument", "Post ID and Comment ID are required");
    }

    const postRef = db.collection("posts").doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
        throw new HttpsError("not-found", "Post not found");
    }

    const commentRef = postRef.collection("comments").doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
        throw new HttpsError("not-found", "Comment not found");
    }

    if (commentDoc.data()?.authorId !== uid) {
        throw new HttpsError("permission-denied", "Forbidden");
    }

    try {
        await db.runTransaction(async (transaction) => {
            // Delete related likes from subcollection
            const likesSnapshot = await commentRef.collection("likes").get();
            likesSnapshot.forEach((doc) => {
                transaction.delete(doc.ref);
            });

            // Delete the comment
            transaction.delete(commentRef);
        });

        return { success: true };
    } catch (error) {
        logger.error("Delete comment error:", error);
        throw new HttpsError("internal", "Failed to delete comment");
    }
});

/**
 * Get posts by user IDs (for user profile and home feed)
 */
export const getUserPosts = onCall(async (request) => {
    const requestingUserId = request.auth?.uid;

    const { uid, lastPostId, limit = 10 } = request.data;
    if (!uid) {
        throw new HttpsError("invalid-argument", "User ID is required");
    }

    try {
        const postsRef = db.collection("posts");
        let query = postsRef.where("authorId", "==", uid).orderBy("createdAt", "desc").limit(limit);

        if (lastPostId) {
            const lastDoc = await postsRef.doc(lastPostId).get();
            if (lastDoc.exists) {
                query = query.startAfter(lastDoc);
            }
        }

        const querySnapshot = await query.get();
        const posts = await enrichPosts(querySnapshot.docs, requestingUserId);
        const hasMore = querySnapshot.docs.length === limit;

        return { posts, hasMore };
    } catch (error) {
        logger.error("Get user posts error:", error);
        throw new HttpsError("internal", "Failed to fetch posts");
    }
});

/**
 * Get saved posts for a user
 */
export const getSavedPosts = onCall(async (request) => {
    const requestingUserId = request.auth?.uid;
    if (!requestingUserId) {
        throw new HttpsError("unauthenticated", "Unauthorized");
    }

    const { uid, lastPostId, limit = 5 } = request.data;
    if (!uid) {
        throw new HttpsError("invalid-argument", "User ID is required");
    }

    try {
        let savedPostsQuery = db.collection("users").doc(uid).collection("savedPosts").orderBy("createdAt", "desc").limit(limit + 1);
        if (lastPostId) {
            const lastDoc = await db.collection("users").doc(uid).collection("savedPosts").doc(lastPostId).get();
            if (lastDoc.exists) {
                savedPostsQuery = savedPostsQuery.startAfter(lastDoc);
            }
        }

        const savedPostsSnapshot = await savedPostsQuery.get();
        const savedPostIds: string[] = savedPostsSnapshot.docs.map(doc => doc.id);

        const hasMore = savedPostIds.length > limit;
        const pagePostIds = hasMore ? savedPostIds.slice(0, limit) : savedPostIds;

        if (pagePostIds.length === 0) {
            return { posts: [], hasMore: false };
        }

        // Fetch actual posts by IDs
        const postsSnapshot = await db.collection("posts").where(FieldPath.documentId(), "in", pagePostIds).get();
        const posts = await enrichPosts(postsSnapshot.docs, requestingUserId);

        // Preserve order of saved posts
        const orderMap = new Map(pagePostIds.map((id, index) => [id, index]));
        posts.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

        return { posts, hasMore };
    } catch (error) {
        logger.error("Get saved posts error:", error);
        throw new HttpsError("internal", "Failed to fetch saved posts");
    }
});

/**
 * Get home feed posts (from users the current user follows)
 */
export const getHomePosts = onCall(async (request) => {
    const requestingUserId = request.auth?.uid;
    if (!requestingUserId) {
        throw new HttpsError("unauthenticated", "Unauthorized");
    }

    const { uid, lastPostId, limit = 10 } = request.data;
    if (!uid) {
        throw new HttpsError("invalid-argument", "User ID is required");
    }

    try {
        // Get users that the current user is following
        const followingSnapshot = await db.collection("users").doc(uid).collection("following").get();
        const following = followingSnapshot.docs.map(doc => doc.id);

        if (following.length === 0) {
            return { posts: [], hasMore: false };
        }

        // Include own posts and posts from followed users
        const userIds = [uid, ...following];
        
        // Firestore "in" query limited to 30 items
        const chunks: string[][] = [];
        for (let i = 0; i < userIds.length; i += 30) {
            chunks.push(userIds.slice(i, i + 30));
        }

        const postsRef = db.collection("posts");
        let allDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

        for (const chunk of chunks) {
            let query = postsRef.where("authorId", "in", chunk).orderBy("createdAt", "desc").limit(limit);

            if (lastPostId) {
                const lastDoc = await postsRef.doc(lastPostId).get();
                if (lastDoc.exists) {
                    query = query.startAfter(lastDoc);
                }
            }

            const snapshot = await query.get();
            allDocs = allDocs.concat(snapshot.docs);
        }

        // Sort all docs by createdAt and take the first `limit`
        allDocs.sort((a, b) => {
            const aTime = a.data().createdAt?.toMillis() || 0;
            const bTime = b.data().createdAt?.toMillis() || 0;
            return bTime - aTime;
        });
        allDocs = allDocs.slice(0, limit);

        const posts = await enrichPosts(allDocs, requestingUserId);
        const hasMore = allDocs.length === limit;

        return { posts, hasMore };
    } catch (error) {
        logger.error("Get home posts error:", error);
        throw new HttpsError("internal", "Failed to fetch home posts");
    }
});

/**
 * Get explore posts (sorted by score)
 */
export const getExplorePosts = onCall(async (request) => {
    const requestingUserId = request.auth?.uid;
    if (!requestingUserId) {
        throw new HttpsError("unauthenticated", "Unauthorized");
    }

    const { lastPostId, limit = 10 } = request.data;

    try {
        const postsRef = db.collection("posts");
        let query = postsRef.orderBy("score", "desc").limit(limit);

        if (lastPostId) {
            const lastDoc = await postsRef.doc(lastPostId).get();
            if (lastDoc.exists) {
                query = query.startAfter(lastDoc);
            }
        }

        const querySnapshot = await query.get();
        const posts = await enrichPosts(querySnapshot.docs, requestingUserId);
        const hasMore = querySnapshot.docs.length === limit;

        return { posts, hasMore };
    } catch (error) {
        logger.error("Get explore posts error:", error);
        throw new HttpsError("internal", "Failed to fetch explore posts");
    }
});

/**
 * Get a single post by ID
 */
export const getPost = onCall(async (request) => {
    const requestingUserId = request.auth?.uid;
    if (!requestingUserId) {
        throw new HttpsError("unauthenticated", "Unauthorized");
    }

    const { postId } = request.data;
    if (!postId) {
        throw new HttpsError("invalid-argument", "Post ID is required");
    }

    try {
        const postDoc = await db.collection("posts").doc(postId).get();
        
        if (!postDoc.exists) {
            throw new HttpsError("not-found", "Post not found");
        }

        const posts = await enrichPosts([postDoc as FirebaseFirestore.QueryDocumentSnapshot], requestingUserId);

        return posts[0];
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error("Get post error:", error);
        throw new HttpsError("internal", "Failed to fetch post");
    }
});
