import { db, auth, functions } from "@/lib/firebase";
import {
    collection,
    addDoc,
    serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// Cloud Function references
const deletePostCallable = httpsCallable(functions, "deletePost");
const deleteCommentCallable = httpsCallable(functions, "deleteComment");
const getUserPostsCallable = httpsCallable(functions, "getUserPosts");
const getSavedPostsCallable = httpsCallable(functions, "getSavedPosts");
const getHomePostsCallable = httpsCallable(functions, "getHomePosts");
const getExplorePostsCallable = httpsCallable(functions, "getExplorePosts");
const getPostCallable = httpsCallable(functions, "getPost");

/**
 * Create a new post using the client SDK.
 * Simple write operation - no complex logic needed.
 */
export const createPost = async (data: {
    title: string;
    description: string;
    ingredients: string;
    directions: string;
    nutrition: string;
    imageUrls: string[];
}): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    const docRef = await addDoc(collection(db, "posts"), {
        authorId: user.uid,
        title: data.title,
        description: data.description,
        ingredients: data.ingredients,
        directions: data.directions,
        nutrition: data.nutrition,
        imageUrls: data.imageUrls,
        likeCount: 0,
        saveCount: 0,
        score: 0,
        createdAt: serverTimestamp(),
    });

    return docRef.id;
};

/**
 * Delete a post using Cloud Function.
 * Requires transaction to delete related likes, saves, and comments.
 */
export const deletePost = async (postId: string): Promise<void> => {
    await deletePostCallable({ postId });
};

/**
 * Load posts by a specific user using Cloud Function.
 */
export const loadUserPosts = async (uid: string, lastPostId?: string, limit: number = 10): Promise<{
    posts: any[];
    hasMore: boolean;
}> => {
    const result = await getUserPostsCallable({ uid, lastPostId, limit });
    return result.data as { posts: any[]; hasMore: boolean };
};

/**
 * Load saved posts using Cloud Function.
 */
export const loadSavedPosts = async (uid: string, lastPostId?: string, limit: number = 10): Promise<{
    posts: any[];
    hasMore: boolean;
}> => {
    const result = await getSavedPostsCallable({ uid, lastPostId, limit });
    return result.data as { posts: any[]; hasMore: boolean };
};

/**
 * Load home feed posts using Cloud Function.
 */
export const loadHomePosts = async (uid: string, lastPostId?: string, limit: number = 10): Promise<{
    posts: any[];
    hasMore: boolean;
}> => {
    const result = await getHomePostsCallable({ uid, lastPostId, limit });
    return result.data as { posts: any[]; hasMore: boolean };
};

/**
 * Load explore posts using Cloud Function.
 */
export const loadExplorePosts = async (lastPostId?: string, limit: number = 10): Promise<{
    posts: any[];
    hasMore: boolean;
}> => {
    const result = await getExplorePostsCallable({ lastPostId, limit });
    return result.data as { posts: any[]; hasMore: boolean };
};

/**
 * Write a comment using the client SDK.
 * Simple write to a subcollection - no complex logic needed.
 */
export const writeComment = async (data: {
    postId: string;
    content: string;
}): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    const commentRef = await addDoc(collection(db, "posts", data.postId, "comments"), {
        authorId: user.uid,
        text: data.content,
        likeCount: 0,
        createdAt: serverTimestamp(),
    });

    return commentRef.id;
};

/**
 * Delete a comment using Cloud Function.
 * Requires transaction to delete related comment likes.
 */
export const deleteComment = async (postId: string, commentId: string): Promise<void> => {
    await deleteCommentCallable({ postId, commentId });
};

/**
 * Get a single post by ID using Cloud Function.
 */
export const getPost = async (postId: string): Promise<any> => {
    const result = await getPostCallable({ postId });
    return result.data;
};