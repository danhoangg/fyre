import { adminDb } from "./firebase-admin";
import { getPostsLikedStatus, getPostsSavedStatus, getCommentsLikedStatus } from "./user";
import * as admin from "firebase-admin";

export async function getPostsByUserIds(
  uids: string[],
  limit: number = 10,
  lastPostId?: string,
  requestingUserId?: string
) {
  if (!uids || uids.length === 0) {
    return { posts: [], hasMore: false };
  }

  const postsRef = adminDb.collection("posts");
  let query = postsRef.where("authorId", "in", uids);

  query = query.orderBy("createdAt", "desc").limit(limit);

  if (lastPostId) {
    const lastDoc = await postsRef.doc(lastPostId).get();
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc);
    }
  }

  const querySnapshot = await query.get();

  const posts = await Promise.all(
    querySnapshot.docs.map(async doc => {
      const postData: any = {
        id: doc.id,
        ...doc.data()
      };

      // Get post author info
      const authorDoc = await adminDb.collection("users").doc(postData.authorId as string).get();
      if (authorDoc.exists) {
        const authorData = authorDoc.data() as any;
        postData.authorUsername = authorData.username;
        postData.authorAvatarUrl = authorData.avatarUrl;

        const followDocId = `${requestingUserId}_${postData.authorId}`;
        const isFollowing = await adminDb.collection("follows").doc(followDocId).get();
        postData.isAuthorFollowed = isFollowing.exists;
      } else {
        postData.authorUsername = "Unknown";
        postData.authorAvatarUrl = null;
      }

      // Fetch comments subcollection
      const commentsSnapshot = await doc.ref.collection("comments").orderBy("createdAt", "desc").get();
      const comments = commentsSnapshot.docs.map(commentDoc => ({
        id: commentDoc.id,
        ...commentDoc.data()
      }));

      // Get user from comments.authorId in comments subcollection
      const commentsWithUser = await Promise.all(
        comments.map(async comment => {
          const userDoc = await adminDb.collection("users").doc((comment as any).authorId).get();

          return {
            ...comment,
            authorId: (comment as any).authorId,
            username: userDoc.exists ? (userDoc.data() as any).username : "Unknown",
            avatarUrl: userDoc.exists ? (userDoc.data() as any).avatarUrl : null
          };
        })
      );

      return {
        ...postData,
        commentCount: comments.length,
        comments: commentsWithUser
      };
    })
  ) as any[];

  // Add liked/saved status if requesting user is provided
  if (requestingUserId && posts.length > 0) {
    const postIds = posts.map(p => p.id);
    const commentIds = posts.flatMap(p => p.comments.map((c: any) => c.id));
    const [likedStatus, savedStatus, commentsLikedStatus] = await Promise.all([
      getPostsLikedStatus(postIds, requestingUserId),
      getPostsSavedStatus(postIds, requestingUserId),
      getCommentsLikedStatus(commentIds, requestingUserId),
    ]);

    posts.forEach(post => {
      post.isLiked = likedStatus[post.id] || false;
      post.isSaved = savedStatus[post.id] || false;

      // Add liked status for comments
      post.comments = post.comments.map((comment: any) => ({
        ...comment,
        isLiked: commentsLikedStatus[comment.id] || false
      }));
    });
  }

  const hasMore = querySnapshot.docs.length === limit;

  // Serialize Firestore data to plain objects
  return JSON.parse(JSON.stringify({ posts, hasMore })) as { posts: any[]; hasMore: boolean };
}

export async function getPostsByPostIds(
  postIds: string[],
  limit: number = 10,
  lastPostId?: string,
  requestingUserId?: string
) {
  if (!postIds || postIds.length === 0) {
    return { posts: [], hasMore: false };
  }

  const postsRef = adminDb.collection("posts");
  let query = postsRef.where(admin.firestore.FieldPath.documentId(), "in", postIds);

  query = query.orderBy("createdAt", "desc").limit(limit);

  if (lastPostId) {
    const lastDoc = await postsRef.doc(lastPostId).get();
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc);
    }
  }

  const querySnapshot = await query.get();


  const posts = await Promise.all(
    querySnapshot.docs.map(async doc => {
      const postData: any = {
        id: doc.id,
        ...doc.data()
      };

      // Get post author info
      const authorDoc = await adminDb.collection("users").doc(postData.authorId as string).get();
      if (authorDoc.exists) {
        const authorData = authorDoc.data() as any;
        postData.authorUsername = authorData.username;
        postData.authorAvatarUrl = authorData.avatarUrl;

        const followDocId = `${requestingUserId}_${postData.authorId}`;
        const isFollowing = await adminDb.collection("follows").doc(followDocId).get();
        postData.isAuthorFollowed = isFollowing.exists;
      } else {
        postData.authorUsername = "Unknown";
        postData.authorAvatarUrl = null;
      }

      // Fetch comments subcollection
      const commentsSnapshot = await doc.ref.collection("comments").orderBy("createdAt", "desc").get();
      const comments = commentsSnapshot.docs.map(commentDoc => ({
        id: commentDoc.id,
        ...commentDoc.data()
      }));

      // Get user from comments.authorId in comments subcollection
      const commentsWithUser = await Promise.all(
        comments.map(async comment => {
          const userDoc = await adminDb.collection("users").doc((comment as any).authorId).get();

          return {
            ...comment,
            authorId: (comment as any).authorId,
            username: userDoc.exists ? (userDoc.data() as any).username : "Unknown",
            avatarUrl: userDoc.exists ? (userDoc.data() as any).avatarUrl : null
          };
        })
      );

      return {
        ...postData,
        commentCount: comments.length,
        comments: commentsWithUser
      };
    })
  ) as any[];

  // Add liked/saved status if requesting user is provided
  if (requestingUserId && posts.length > 0) {
    const postIdsList = posts.map(p => p.id);
    const commentIds = posts.flatMap(p => p.comments.map((c: any) => c.id));
    const [likedStatus, savedStatus, commentsLikedStatus] = await Promise.all([
      getPostsLikedStatus(postIdsList, requestingUserId),
      getPostsSavedStatus(postIdsList, requestingUserId),
      getCommentsLikedStatus(commentIds, requestingUserId),
    ]);

    posts.forEach(post => {
      post.isLiked = likedStatus[post.id] || false;
      post.isSaved = savedStatus[post.id] || false;

      // Add liked status for comments
      post.comments = post.comments.map((comment: any) => ({
        ...comment,
        isLiked: commentsLikedStatus[comment.id] || false
      }));
    });
  }

  const hasMore = querySnapshot.docs.length === limit;

  // Serialize Firestore data to plain objects
  return JSON.parse(JSON.stringify({ posts, hasMore })) as { posts: any[]; hasMore: boolean };
}
