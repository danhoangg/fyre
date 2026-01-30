"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

import React, { useEffect, useRef, useState } from "react"
import { Field, FieldLabel, FieldContent } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useUser } from "@/lib/user-context"
import { uploadFile, deleteFileByUrl } from "@/lib/storage"
import { Spinner } from "@/components/ui/spinner"
import { createPost } from "@/services/posts"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { routerServerGlobal } from "next/dist/server/lib/router-utils/router-server-context"
import { useRouter } from "next/navigation"
import { SidebarHeaderComponent } from "@/components/sidebar-header"

export default function CreatePostPage() {
    const router = useRouter()

    const { user } = useUser()
    const sidebarUser = {
        name: user.username || "",
        email: user.email || "",
        avatarUrl: user.avatarUrl || "/default-avatar.png",
        uid: user.uid || "",
    }

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // form state
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [ingredients, setIngredients] = useState("")
    const [directions, setDirections] = useState("")
    const [nutrition, setNutrition] = useState("")

    type ImageItem = { id: string; file?: File; url: string }
    const [images, setImages] = useState<ImageItem[]>([])
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const MAX_IMAGES = 5

    function deleteImage(id: string) {
        setImages((prev) => {
            const toDelete = prev.find((p) => p.id === id)
            if (toDelete) URL.revokeObjectURL(toDelete.url)
            return prev.filter((p) => p.id !== id)
        })
    }

    // track images in a ref and revoke object URLs only on unmount
    const imagesRef = useRef<ImageItem[]>([])
    useEffect(() => {
        imagesRef.current = images
    }, [images])

    useEffect(() => {
        return () => {
            imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url))
        }
    }, [])

    // DnD sensors and handlers
    const sensors = useSensors(useSensor(PointerSensor))

    function onDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over) return
        if (active.id !== over.id) {
            setImages((prev) => {
                const oldIndex = prev.findIndex((i) => i.id === active.id)
                const newIndex = prev.findIndex((i) => i.id === over.id)
                if (oldIndex === -1 || newIndex === -1) return prev
                return arrayMove(prev, oldIndex, newIndex)
            })
        }
    }

    function SortableImage({ img, index }: { img: ImageItem; index: number }) {
        const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: img.id })
        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
        }

        return (
            <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="col-span-1">
                <Card className="relative overflow-hidden">
                    <img src={img.url} alt={`upload-${index}`} className="h-32 w-full object-cover" />
                    <div className="absolute right-2 top-2 flex gap-2">
                        <Button
                            size="icon-sm"
                            variant="destructive"
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => deleteImage(img.id)}
                            aria-label="delete"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                </Card>
            </div>
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        let newlyUploadedUrls: string[] = []
        try {
            const filesToUpload = images.filter((i) => i.file)
            let finalImageUrls: string[] = []
            if (filesToUpload.length > 0) {
                newlyUploadedUrls = await Promise.all(filesToUpload.map((i) => uploadFile(i.file!, "posts")))
                let idx = 0
                finalImageUrls = images.map((img) => {
                    if (img.file) return newlyUploadedUrls[idx++]
                    return img.url
                })
            } else {
                finalImageUrls = []
            }

            await createPost({
                title,
                description,
                ingredients,
                directions,
                nutrition,
                imageUrls: finalImageUrls,
            });

            // reset form
            setTitle("")
            setDescription("")
            setIngredients("")
            setDirections("")
            setNutrition("")
            images.forEach((i) => URL.revokeObjectURL(i.url))
            setImages([])
            setError(null)

            router.push("/")
        } catch (err) {
            const message = err instanceof Error ? err.message : "Upload failed"
            setError(message)
            if (newlyUploadedUrls.length > 0) {
                try {
                    await Promise.all(newlyUploadedUrls.map((url) => deleteFileByUrl(url)))
                } catch {}
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <SidebarProvider>
            <AppSidebar user={sidebarUser} />
            <SidebarInset>
                <SidebarHeaderComponent title="Create Post" />
                <main className="p-8">
                    <div className="mx-auto max-w-3xl">
                        <form
                            onSubmit={handleSubmit}
                            className="flex flex-col gap-6"
                        >
                            <Field>
                                <FieldLabel>Title</FieldLabel>
                                <FieldContent>
                                    <Input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Enter a title"
                                        required
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel>Description</FieldLabel>
                                <FieldContent>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Short description"
                                        rows={4}
                                        className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel>Ingredients</FieldLabel>
                                <FieldContent>
                                    <textarea
                                        value={ingredients}
                                        onChange={(e) => setIngredients(e.target.value)}
                                        placeholder={"2 cups flour\n1 tsp salt"}
                                        rows={4}
                                        className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel>Directions</FieldLabel>
                                <FieldContent>
                                    <textarea
                                        value={directions}
                                        onChange={(e) => setDirections(e.target.value)}
                                        placeholder="Step by step directions"
                                        rows={6}
                                        className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50"
                                    />
                                </FieldContent>
                            </Field>

                            <Field>
                                <FieldLabel>Nutrition</FieldLabel>
                                <FieldContent>
                                    <textarea
                                        value={nutrition}
                                        onChange={(e) => setNutrition(e.target.value)}
                                        placeholder="Nutrition facts"
                                        rows={3}
                                        className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50"
                                    />
                                </FieldContent>
                            </Field>

                            <div>
                                <Field>
                                    <FieldLabel>Photos</FieldLabel>
                                    <FieldContent>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => {
                                                const files = e.target.files
                                                if (!files) return
                                                const remaining = MAX_IMAGES - images.length
                                                if (remaining <= 0) {
                                                    e.currentTarget.value = ""
                                                    return
                                                }
                                                const selected = Array.from(files).slice(0, remaining)
                                                const newItems = selected.map((file) => ({
                                                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                                                    file,
                                                    url: URL.createObjectURL(file),
                                                }))
                                                setImages((prev) => [...prev, ...newItems])
                                                e.currentTarget.value = ""
                                            }}
                                        />

                                        <div className="mt-2 flex flex-col gap-3">
                                            <div className="grid grid-cols-3 gap-3">
                                                {images.length === 0 && (
                                                    <div className="col-span-3 text-sm text-muted-foreground">No images yet. Add some using the <strong>+</strong> button below.</div>
                                                )}

                                                {images.length > 0 && (
                                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                                                        <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
                                                            {images.map((img, idx) => (
                                                                <SortableImage key={img.id} img={img} index={idx} />
                                                            ))}
                                                        </SortableContext>
                                                    </DndContext>
                                                )}
                                            </div>

                                            <div className="mt-2 flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={images.length >= MAX_IMAGES}
                                                >
                                                    <Plus className="size-4" />
                                                    <span>Add photo</span>
                                                </Button>
                                                <div className="text-sm text-muted-foreground">
                                                    You can add, delete or reorder photos. <span className={"ml-2 text-xs" + (images.length >= MAX_IMAGES ? " text-red-500" : "")}>({images.length}/{MAX_IMAGES})</span>
                                                </div>
                                            </div>
                                        </div>
                                    </FieldContent>
                                </Field>
                            </div>

                            <Separator />
                            {error && (
                                <Alert className="border-red-500 bg-red-50">
                                    <AlertDescription className="text-red-700">
                                        {error}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex gap-2">
                                <Button type="submit" disabled={isLoading}>{isLoading && <Spinner />}<span>{!isLoading ? "Save" : "Uploading..."}</span></Button>
                                <Button type="button" variant="ghost" onClick={() => {
                                    setTitle("")
                                    setDescription("")
                                    setIngredients("")
                                    setDirections("")
                                    setNutrition("")
                                    images.forEach((i) => URL.revokeObjectURL(i.url))
                                    setImages([])
                                }}>Reset</Button>
                            </div>
                        </form>
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}