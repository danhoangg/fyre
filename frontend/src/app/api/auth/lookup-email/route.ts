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
        { error: "Username not found" },
        { status: 404 }
      )
    }

    const userDoc = querySnapshot.docs[0]
    const email = userDoc.data().email

    return NextResponse.json({ email })
  } catch (error) {
    console.error("Email lookup error:", error)
    return NextResponse.json(
      { error: "Failed to lookup email" },
      { status: 500 }
    )
  }
}
