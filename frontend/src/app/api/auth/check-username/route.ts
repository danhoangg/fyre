import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function POST(req: Request) {
    try {
        const { username } = await req.json()

        if (!username) {
            return NextResponse.json(
                { error: "Username is required" },
                { status: 400 }
            )
        }

        // Query Firestore for user by username
        const querySnapshot = await adminDb
            .collection("users")
            .where("username", "==", username)
            .limit(1)
            .get()

        if (querySnapshot.empty) {
            return NextResponse.json(
                { status: 200 }
            )
        }

        return NextResponse.json({ error: "Username already taken" }, { status: 409 })
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to check username" },
            { status: 500 }
        )
    }
}
