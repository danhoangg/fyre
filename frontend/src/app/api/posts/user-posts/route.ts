import { getCurrentUser } from "@/lib/session";
import { getPostsByUserIds } from "@/lib/posts";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const uid = searchParams.get("uid");
    const lastPostId = searchParams.get("lastPostId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!uid) {
      return new Response(JSON.stringify({ error: "uid is required" }), { status: 400 });
    }

    // Get current user for liked/saved status
    const currentUser = await getCurrentUser();

    const result = await getPostsByUserIds([uid], limit, lastPostId, currentUser?.uid);

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    console.error("Fetch user posts error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch posts" }), { status: 500 });
  }
}
