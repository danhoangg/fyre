import { adminDb } from "@/lib/firebase-admin";
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
    }));

    const hasMore = querySnapshot.docs.length === limit;

    // Serialize Firestore data to plain objects
    const serialized = JSON.parse(JSON.stringify({ posts, hasMore }));

    return new Response(JSON.stringify(serialized), { status: 200 });
  } catch (error) {
    console.error("Fetch user posts error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch posts" }), { status: 500 });
  }
}
