import { getCurrentUser } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";
import { getCommentsLikedStatus } from "@/lib/user";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.uid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");
    const limit = parseInt(searchParams.get("limit") || "10");
    const lastCommentId = searchParams.get("lastCommentId") || undefined;

    if (!postId) {
      return new Response(JSON.stringify({ error: "postId is required" }), { status: 400 });
    }

    const postRef = adminDb.collection("posts").doc(postId);
    let query = postRef.collection("comments").orderBy("createdAt", "desc");

    if (lastCommentId) {
      const lastDoc = await postRef.collection("comments").doc(lastCommentId).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limit + 1); // Fetch one extra to determine if there are more
    const querySnapshot = await query.get();

    const hasMore = querySnapshot.docs.length > limit;
    const comments = querySnapshot.docs.slice(0, limit).map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get user info for each comment
    const commentsWithUser = await Promise.all(
      comments.map(async (comment: any) => {
        const userDoc = await adminDb.collection("users").doc(comment.authorId).get();
        return {
          ...comment,
          username: userDoc.exists ? (userDoc.data() as any).username : "Unknown",
          avatarUrl: userDoc.exists ? (userDoc.data() as any).avatarUrl : null,
        };
      })
    );

    // Get liked status for comments
    const commentIds = comments.map((c) => c.id);
    const commentsLikedStatus = await getCommentsLikedStatus(commentIds, user.uid);

    const commentsWithLikes = commentsWithUser.map((comment: any) => ({
      ...comment,
      isLiked: commentsLikedStatus[comment.id] || false,
    }));

    return new Response(
      JSON.stringify({
        comments: commentsWithLikes,
        hasMore,
        lastCommentId: comments.length > 0 ? comments[comments.length - 1].id : null,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Get comments error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch comments" }), { status: 500 });
  }
}
