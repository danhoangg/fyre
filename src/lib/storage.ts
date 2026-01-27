export async function uploadFile(file: File, path = "images"): Promise<string> {
  const fd = new FormData()
  fd.append("file", file, file.name)
  fd.append("path", path)

  const res = await fetch("/api/storage/upload", {
    method: "POST",
    body: fd,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.url
}

export async function deleteFileByUrl(url: string): Promise<void> {
  const res = await fetch("/api/storage/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Delete failed: ${res.status} ${text}`)
  }
}
