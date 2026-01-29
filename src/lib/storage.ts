import { storage } from "./firebase"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"

export async function uploadFile(file: File, path = "images"): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg"
  const filename = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const storageRef = ref(storage, filename)

  const snapshot = await uploadBytes(storageRef, file)
  const url = await getDownloadURL(snapshot.ref)
  return url
}

export async function deleteFileByUrl(url: string): Promise<void> {
  try {
    const storageRef = ref(storage, url)
    await deleteObject(storageRef)
  } catch (err) {
    console.error("Delete failed:", err)
    // Don't throw if delete fails, just log it
  }
}
