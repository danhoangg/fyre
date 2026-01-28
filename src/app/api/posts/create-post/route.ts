import { adminDb } from "@/lib/firebase-admin"
import { getCurrentUser } from "@/lib/session"
import * as admin from "firebase-admin"

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser()
        if (!user?.uid) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
        }

        const form = await req.formData()

        const title = String(form.get("title") || "")
        const description = String(form.get("description") || "")
        const ingredients = String(form.get("ingredients") || "")
        const directions = String(form.get("directions") || "")
        const nutrition = String(form.get("nutrition") || "")
        const imageUrls = JSON.parse(String(form.get("imageUrls") || "[]"))

        const docRef = await adminDb.collection("posts").add({
            authorId: user.uid,
            title,
            description,
            ingredients,
            directions,
            nutrition,
            imageUrls,
            likeCount: 0,
            saveCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        return new Response(JSON.stringify({ success: true, id: docRef.id }), { status: 200 })
    } catch (error) {
        console.error("Create post error:", error)
        return new Response(JSON.stringify({ error: "Failed to create post" }), { status: 500 })
    }
}