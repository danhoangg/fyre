import { adminDb } from "./firebase-admin";

export async function getUserByUsername(username: string) {
  const usersRef = adminDb.collection("users");
  const querySnapshot = await usersRef.where("username", "==", username).limit(1).get();

  if (querySnapshot.empty) {
    return null;
  }

  const userDoc = querySnapshot.docs[0];
  const data = userDoc.data();
  
  // Serialize Firestore data to plain objects
  return JSON.parse(JSON.stringify({
    uid: userDoc.id,
    ...data,
  }));
}

export async function getUserPosts(uid: string, limit: number = 10, lastPostId?: string) {
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
  }));

  const hasMore = querySnapshot.docs.length === limit;

  // Serialize Firestore data to plain objects
  return JSON.parse(JSON.stringify({ posts, hasMore }));
}
