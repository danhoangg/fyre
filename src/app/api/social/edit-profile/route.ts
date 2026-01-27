import { getCurrentUser } from "@/lib/session";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { username, description, avatarUrl } = await req.json();

        if (!username) {
            return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
        }

        const userRef = adminDb.collection("users").doc(user.uid);

        const updateData: any = {
            username,
            description,
            avatarUrl
        };

        await adminDb.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error("User not found");
            }
            transaction.update(userRef, updateData);
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        console.error("Edit profile error:", error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500 });
    }
}