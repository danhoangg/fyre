import { adminDb } from "@/lib/firebase-admin"
import { getCurrentUser } from "@/lib/session"

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

export async function POST(req: Request) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { query } = await req.json();
        
        if (typeof query !== "string") {
            return new Response(JSON.stringify({ error: "Invalid query" }), { status: 400 });
        }

        const searchQuery = query.toLowerCase().trim();

        let userData: Array<Record<string, any>> = [];

        // Fetch all users and filter client-side for substring matching
        const userDocs = await adminDb.collection("users").get();

        userData = userDocs.docs.map(doc => {
            const data = doc.data();
            const plainData = serializeFirestoreValue(data);
            return {
                uid: doc.id,
                ...plainData
            };
        });

        // Filter by username or email if search query exists
        if (searchQuery) {
            userData = userData.filter(user =>
                user.username?.toLowerCase().includes(searchQuery) ||
                user.email?.toLowerCase().includes(searchQuery)
            );
        }

        // Limit results to 10
        userData = userData.slice(0, 10);

        // Exclude current user from results
        userData = userData.filter(user => user.uid !== currentUser.uid);

        return new Response(JSON.stringify({ users: userData }), { status: 200 });
    } catch (error) {
        console.error("Search users error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to search users" }), 
            { status: 500 }
        );
    }
}
