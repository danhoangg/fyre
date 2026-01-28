import { adminDb } from "@/lib/firebase-admin"
import { getCurrentUser } from "@/lib/session"
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

export async function POST(req: Request) {
    try {
        const { users } = await req.json();
        if (!Array.isArray(users) || users.length === 0) {
            return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
        }

        const userDocs = await adminDb.collection("users").where(admin.firestore.FieldPath.documentId(), "in", users).get();
        const userData = userDocs.docs.map(doc => {
            const data = doc.data();

            const plainData = serializeFirestoreValue(data);
            return {
                uid: doc.id,
                ...plainData
            };
        });

        return new Response(JSON.stringify({ users: userData }), { status: 200 });
    } catch (error) {

    }
}