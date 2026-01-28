import { adminDb } from "./firebase-admin";

// Helper function to get followers count for a user
export async function getFollowersCount(uid: string): Promise<number> {
  const followsRef = adminDb.collection("follows");
  const snapshot = await followsRef.where("toUid", "==", uid).count().get();
  return snapshot.data().count;
}

// Helper function to get following count for a user
export async function getFollowingCount(uid: string): Promise<number> {
  const followsRef = adminDb.collection("follows");
  const snapshot = await followsRef.where("fromUid", "==", uid).count().get();
  return snapshot.data().count;
}

// Helper function to check if a user is following another user
export async function isFollowing(fromUid: string, toUid: string): Promise<boolean> {
  const followDocId = `${fromUid}_${toUid}`;
  const followDoc = await adminDb.collection("follows").doc(followDocId).get();
  return followDoc.exists;
}

// Helper function to check if two users are friends
export async function areFriends(uid1: string, uid2: string): Promise<boolean> {
  const friendsDoc = await adminDb.collection("friends").doc(uid1).get();
  if (!friendsDoc.exists) return false;
  const friends = friendsDoc.data()?.friends || [];
  return friends.includes(uid2);
}

// Helper function to get friends list for a user
export async function getFriends(uid: string): Promise<string[]> {
  const friendsDoc = await adminDb.collection("friends").doc(uid).get();
  if (!friendsDoc.exists) return [];
  return friendsDoc.data()?.friends || [];
}

// Helper function to check which posts are liked by a user
export async function getPostsLikedStatus(postIds: string[], userId: string): Promise<{ [key: string]: boolean }> {
  if (!userId || postIds.length === 0) return {};
  
  const likeChecks = await Promise.all(
    postIds.map(postId => 
      adminDb.collection("likes").doc(`${userId}_${postId}`).get()
    )
  );
  
  const likedStatus: { [key: string]: boolean } = {};
  postIds.forEach((postId, index) => {
    likedStatus[postId] = likeChecks[index].exists;
  });
  
  return likedStatus;
}

// Helper function to check which posts are saved by a user
export async function getPostsSavedStatus(postIds: string[], userId: string): Promise<{ [key: string]: boolean }> {
  if (!userId || postIds.length === 0) return {};
  
  const saveChecks = await Promise.all(
    postIds.map(postId => 
      adminDb.collection("saves").doc(`${userId}_${postId}`).get()
    )
  );
  
  const savedStatus: { [key: string]: boolean } = {};
  postIds.forEach((postId, index) => {
    savedStatus[postId] = saveChecks[index].exists;
  });
  
  return savedStatus;
}

export async function getUserByUsername(username: string) {
  const usersRef = adminDb.collection("users");
  const querySnapshot = await usersRef.where("username", "==", username).limit(1).get();

  if (querySnapshot.empty) {
    return null;
  }

  const userDoc = querySnapshot.docs[0];
  const data = userDoc.data();
  
  // Get followers and following counts from new collections
  const [followersCount, followingCount] = await Promise.all([
    getFollowersCount(userDoc.id),
    getFollowingCount(userDoc.id)
  ]);
  
  // Serialize Firestore data to plain objects
  return JSON.parse(JSON.stringify({
    uid: userDoc.id,
    ...data,
    followersCount,
    followingCount,
  }));
}

export async function getUserPosts(uid: string, limit: number = 10, lastPostId?: string, requestingUserId?: string) {
  const postsRef = adminDb.collection("posts");
  let query = postsRef.where("authorId", "==", uid);

  query = query.orderBy("createdAt", "desc").limit(limit);

  if (lastPostId) {
    const lastDoc = await postsRef.doc(lastPostId).get();
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc);
    }
  }

  const querySnapshot = await query.get();

  const posts = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as any[];

  // Add liked/saved status if requesting user is provided
  if (requestingUserId && posts.length > 0) {
    const postIds = posts.map(p => p.id);
    const [likedStatus, savedStatus] = await Promise.all([
      getPostsLikedStatus(postIds, requestingUserId),
      getPostsSavedStatus(postIds, requestingUserId)
    ]);
    
    posts.forEach(post => {
      post.isLiked = likedStatus[post.id] || false;
      post.isSaved = savedStatus[post.id] || false;
    });
  }

  const hasMore = querySnapshot.docs.length === limit;

  // Serialize Firestore data to plain objects
  return JSON.parse(JSON.stringify({ posts, hasMore })) as { posts: any[]; hasMore: boolean };
}
