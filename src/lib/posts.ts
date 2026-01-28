import { adminDb } from "./firebase-admin";
import { getPostsLikedStatus, getPostsSavedStatus, getCommentsLikedStatus } from "./user";
import { getUserDataCached, getFollowStatusesCached } from "./cache";
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

  // Extract unique author IDs for batch follow check
  const authorIds = new Set<string>();
  querySnapshot.docs.forEach(doc => {
    const postData = doc.data();
    if (postData.authorId) {
      authorIds.add(postData.authorId);
    }
  });

  // Batch fetch follow statuses
  let followStatuses: { [key: string]: boolean } = {};
  if (requestingUserId && authorIds.size > 0) {
    followStatuses = await getFollowStatusesCached(requestingUserId, Array.from(authorIds));
  }

  const posts = await Promise.all(
    querySnapshot.docs.map(async doc => {
      const postData: any = {
        id: doc.id,
        ...doc.data()
      };

      // Get post author info from cache
      const authorData = await getUserDataCached(postData.authorId as string);
      if (authorData) {
        postData.authorUsername = authorData.username;
        postData.authorAvatarUrl = authorData.avatarUrl;
        postData.isAuthorFollowed = followStatuses[postData.authorId] || false;
      } else {
        postData.authorUsername = "Unknown";
        postData.authorAvatarUrl = null;
      }

      // Fetch only first 10 comments to reduce read operations
      const commentsSnapshot = await doc.ref.collection("comments").orderBy("createdAt", "desc").limit(10).get();
      const comments = commentsSnapshot.docs.map(commentDoc => ({
        id: commentDoc.id,
        ...commentDoc.data()
      }));

      // Get user from comments.authorId in comments subcollection using cache
      const commentsWithUser = await Promise.all(
        comments.map(async comment => {
          const userDoc = await getUserDataCached((comment as any).authorId);

          return {
            ...comment,
            authorId: (comment as any).authorId,
            username: userDoc ? userDoc.username : "Unknown",
            avatarUrl: userDoc ? userDoc.avatarUrl : null
          };
        })
      );

      // Get total comment count efficiently
      const commentCountSnapshot = await doc.ref.collection("comments").count().get();
      const totalCommentCount = commentCountSnapshot.data().count;

      return {
        ...postData,
        commentCount: totalCommentCount,
        comments: commentsWithUser,
        hasMoreComments: totalCommentCount > 10
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

  // Extract unique author IDs for batch follow check
  const authorIds = new Set<string>();
  querySnapshot.docs.forEach(doc => {
    const postData = doc.data();
    if (postData.authorId) {
      authorIds.add(postData.authorId);
    }
  });

  // Batch fetch follow statuses
  let followStatuses: { [key: string]: boolean } = {};
  if (requestingUserId && authorIds.size > 0) {
    followStatuses = await getFollowStatusesCached(requestingUserId, Array.from(authorIds));
  }

  const posts = await Promise.all(
    querySnapshot.docs.map(async doc => {
      const postData: any = {
        id: doc.id,
        ...doc.data()
      };

      // Get post author info from cache
      const authorData = await getUserDataCached(postData.authorId as string);
      if (authorData) {
        postData.authorUsername = authorData.username;
        postData.authorAvatarUrl = authorData.avatarUrl;
        postData.isAuthorFollowed = followStatuses[postData.authorId] || false;
      } else {
        postData.authorUsername = "Unknown";
        postData.authorAvatarUrl = null;
      }

      // Fetch only first 10 comments to reduce read operations
      const commentsSnapshot = await doc.ref.collection("comments").orderBy("createdAt", "desc").limit(10).get();
      const comments = commentsSnapshot.docs.map(commentDoc => ({
        id: commentDoc.id,
        ...commentDoc.data()
      }));

      // Get user from comments.authorId in comments subcollection using cache
      const commentsWithUser = await Promise.all(
        comments.map(async comment => {
          const userDoc = await getUserDataCached((comment as any).authorId);

          return {
            ...comment,
            authorId: (comment as any).authorId,
            username: userDoc ? userDoc.username : "Unknown",
            avatarUrl: userDoc ? userDoc.avatarUrl : null
          };
        })
      );

      // Get total comment count efficiently
      const commentCountSnapshot = await doc.ref.collection("comments").count().get();
      const totalCommentCount = commentCountSnapshot.data().count;

      return {
        ...postData,
        commentCount: totalCommentCount,
        comments: commentsWithUser,
        hasMoreComments: totalCommentCount > 10
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

export async function getExplorePostsByScore(
  limit: number = 10,
  lastPostId?: string,
  requestingUserId?: string
) {
  const postsRef = adminDb.collection("posts");
  let query = postsRef.orderBy("score", "desc").limit(limit);

  if (lastPostId) {
    const lastDoc = await postsRef.doc(lastPostId).get();
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc);
    }
  }

  const querySnapshot = await query.get();

  // Extract unique author IDs for batch follow check
  const authorIds = new Set<string>();
  querySnapshot.docs.forEach(doc => {
    const postData = doc.data();
    if (postData.authorId) {
      authorIds.add(postData.authorId);
    }
  });

  // Batch fetch follow statuses
  let followStatuses: { [key: string]: boolean } = {};
  if (requestingUserId && authorIds.size > 0) {
    followStatuses = await getFollowStatusesCached(requestingUserId, Array.from(authorIds));
  }

  const posts = await Promise.all(
    querySnapshot.docs.map(async doc => {
      const postData: any = {
        id: doc.id,
        ...doc.data()
      };

      // Get post author info from cache
      const authorData = await getUserDataCached(postData.authorId as string);
      if (authorData) {
        postData.authorUsername = authorData.username;
        postData.authorAvatarUrl = authorData.avatarUrl;
        postData.isAuthorFollowed = followStatuses[postData.authorId] || false;
      } else {
        postData.authorUsername = "Unknown";
        postData.authorAvatarUrl = null;
      }

      // Fetch only first 10 comments to reduce read operations
      const commentsSnapshot = await doc.ref.collection("comments").orderBy("createdAt", "desc").limit(10).get();
      const comments = commentsSnapshot.docs.map(commentDoc => ({
        id: commentDoc.id,
        ...commentDoc.data()
      }));

      // Get user from comments.authorId in comments subcollection using cache
      const commentsWithUser = await Promise.all(
        comments.map(async comment => {
          const userDoc = await getUserDataCached((comment as any).authorId);

          return {
            ...comment,
            authorId: (comment as any).authorId,
            username: userDoc ? userDoc.username : "Unknown",
            avatarUrl: userDoc ? userDoc.avatarUrl : null
          };
        })
      );

      // Get total comment count efficiently
      const commentCountSnapshot = await doc.ref.collection("comments").count().get();
      const totalCommentCount = commentCountSnapshot.data().count;

      return {
        ...postData,
        commentCount: totalCommentCount,
        comments: commentsWithUser,
        hasMoreComments: totalCommentCount > 10
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
