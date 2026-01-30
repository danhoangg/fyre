import { NextResponse } from "next/server"
import { bucket } from "@/lib/firebase-admin"
import { getCurrentUser } from "@/lib/session"
import { Buffer } from "buffer"

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()

    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    // Optional path folder provided by client (e.g. 'posts' or 'avatars')
    const rawPath = String(form.get("path") ?? "images")
    // sanitize path: allow letters, numbers, -, _, and slashes; reject traversal
    const sanitized = rawPath.replace(/[^a-zA-Z0-9_\-\/]/g, "").replace(/(^\/\+|\/\+$)/g, "")
    const folder = sanitized === "" ? "images" : sanitized

    const ext = (file.type && file.type.split("/")[1]) || (file as any).name?.split?.(".")?.pop() || "jpg"
    const filename = `${folder}/${user?.uid ?? "public"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const f = bucket.file(filename)
    await f.save(buffer, { contentType: file.type })
    // make public so we can return an accessible url
    await f.makePublic()

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(f.name)}`

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
