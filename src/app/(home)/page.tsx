"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useUser } from "@/lib/user-context"
import { Separator } from "@/components/ui/separator"

export default function Page() {
  const user = useUser()
  const sidebarUser = {
    name: user.username || "",
    email: user.email || "",
    avatarUrl: user.avatarUrl || "/default-avatar.png",
    uid: user.uid || "",
  }

  const posts = [
    {
      id: "1",
      author: { name: "Chris Nolan", avatar: "/default-avatar.png" },
      time: "2h",
      content: "Just shipped a small update — performance improvements and bug fixes!",
      likes: 12,
    },
    {
      id: "2",
      author: { name: "Ava Smith", avatar: "/default-avatar.png" },
      time: "5h",
      content: "Excited to share a new design I've been working on.",
      likes: 34,
    },
    {
      id: "3",
      author: { name: "Jordan Lee", avatar: "/default-avatar.png" },
      time: "1d",
      content: "Does anyone have tips for scaling realtime features?",
      likes: 7,
    },
  ]

  return (
    <SidebarProvider>
      <AppSidebar user={sidebarUser} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <span className="text-xl font-semibold">Your Feed</span>
          </div>

        </header>
        <div className="flex flex-1 flex-col gap-6 p-48 pt-0">
          <div className="mx-auto w-full max-w-2xl">
            <h2 className="mb-6 text-2xl font-semibold">Latest posts</h2>
            <div className="space-y-4">
              {posts.map((post) => (
                <Card key={post.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={post.author.avatar} alt={post.author.name} />
                        <AvatarFallback>{post.author.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="grid">
                        <CardTitle>{post.author.name}</CardTitle>
                        <CardDescription>{post.time} · {post.likes} likes</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{post.content}</p>
                  </CardContent>
                  <CardFooter>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">Like</Button>
                      <Button variant="ghost" size="sm">Comment</Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
