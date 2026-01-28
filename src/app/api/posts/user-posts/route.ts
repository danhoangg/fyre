import { adminDb } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/session";
import { getPostsLikedStatus, getPostsSavedStatus } from "@/lib/user";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const uid = searchParams.get("uid");
    const lastPostId = searchParams.get("lastPostId");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!uid) {
      return new Response(JSON.stringify({ error: "uid is required" }), { status: 400 });
    }

    // Get current user for liked/saved status
    const currentUser = await getCurrentUser();

    const postsRef = adminDb.collection("posts");
    let query = postsRef.where("authorId", "==", uid).orderBy("createdAt", "desc").limit(limit);

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

    // Add liked/saved status if user is logged in
    if (currentUser?.uid && posts.length > 0) {
      const postIds = posts.map(p => p.id);
      const [likedStatus, savedStatus] = await Promise.all([
        getPostsLikedStatus(postIds, currentUser.uid),
        getPostsSavedStatus(postIds, currentUser.uid)
      ]);
      
      posts.forEach(post => {
        post.isLiked = likedStatus[post.id] || false;
        post.isSaved = savedStatus[post.id] || false;
      });
    }

    const hasMore = querySnapshot.docs.length === limit;

    // Serialize Firestore data to plain objects
    const serialized = JSON.parse(JSON.stringify({ posts, hasMore }));

    return new Response(JSON.stringify(serialized), { status: 200 });
  } catch (error) {
    console.error("Fetch user posts error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch posts" }), { status: 500 });
  }
}
