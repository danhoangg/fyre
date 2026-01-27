import { NextResponse } from "next/server"
import { bucket } from "@/lib/firebase-admin"
import { getCurrentUser } from "@/lib/session"

function extractObjectNameFromUrl(url: string, bucketName: string): string | null {
  try {
    const prefix = `https://storage.googleapis.com/${bucketName}/`
    if (!url.startsWith(prefix)) return null
    const encodedName = url.slice(prefix.length)
    const objectName = decodeURIComponent(encodedName)
    if (!objectName) return null
    return objectName
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { url, path } = await req.json()

    let objectName: string | null = null

    if (typeof path === "string" && path.length > 0) {
      objectName = path
    } else if (typeof url === "string" && url.length > 0) {
      objectName = extractObjectNameFromUrl(url, bucket.name)
    }

    if (!objectName) {
      return NextResponse.json({ error: "Invalid url/path" }, { status: 400 })
    }

    // Safety check: limit deletions to files under the user's uid segment
    // Expected pattern from upload: <folder>/<uid>/<filename>
    const segments = objectName.split("/")
    if (segments.length < 3 || segments[1] !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const file = bucket.file(objectName)

    // If file does not exist, consider it already cleaned up
    const [exists] = await file.exists()
    if (!exists) {
      return NextResponse.json({ success: true, deleted: false })
    }

    await file.delete()
    return NextResponse.json({ success: true, deleted: true })
  } catch (err) {
    console.error("Delete error:", err)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
