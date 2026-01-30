import { adminDb } from "@/lib/firebase-admin"
import { getCurrentUser } from "@/lib/session"
import { isFollowingCached, getFollowStatusesCached } from "@/lib/cache"
import * as admin from "firebase-admin"

function serializeFirestoreValue(value: any): any {
    if (value && typeof value.toDate === "function") return value.toDate().toISOString();
    if (Array.isArray(value)) return value.map(serializeFirestoreValue);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, serializeFirestoreValue(v)])
        );
    }
    return value;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const username = searchParams.get('username');
        
        if (!username) {
            return new Response(JSON.stringify({ error: "Username is required" }), { status: 400 });
        }

        const currentUser = await getCurrentUser();
        
        const userSnapshot = await adminDb.collection("users")
            .where("username", "==", username)
            .limit(1)
            .get();

        if (userSnapshot.empty) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
        }

        const userDoc = userSnapshot.docs[0];
        const data = userDoc.data();
        const plainData = serializeFirestoreValue(data);
        
        let isFollowing = false;
        if (currentUser) {
            isFollowing = await isFollowingCached(currentUser.uid, userDoc.id);
        }

        return new Response(JSON.stringify({
            uid: userDoc.id,
            isFollowing,
            ...plainData
        }), { status: 200 });
    } catch (error) {
        console.error("Failed to get user:", error);
        return new Response(JSON.stringify({ error: "Failed to get user" }), { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { users } = await req.json();
        if (!Array.isArray(users) || users.length === 0) {
            return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
        }

        const currentUser = await getCurrentUser();
        const userDocs = await adminDb.collection("users").where(admin.firestore.FieldPath.documentId(), "in", users).get();
        
        const targetUids = userDocs.docs.map(doc => doc.id);
        const followStatuses = currentUser ? await getFollowStatusesCached(currentUser.uid, targetUids) : {};

        const userData = userDocs.docs.map((doc) => {
            const data = doc.data();
            const plainData = serializeFirestoreValue(data);
            
            return {
                uid: doc.id,
                isFollowing: followStatuses[doc.id] || false,
                ...plainData
            };
        });

        return new Response(JSON.stringify({ users: userData }), { status: 200 });
    } catch (error) {
        console.error("Failed to get users:", error);
        return new Response(JSON.stringify({ error: "Failed to get users" }), { status: 500 });
    }
}