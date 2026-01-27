"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useUser } from "@/lib/user-context";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CirclePlus } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { PostsGrid } from "@/components/posts-grid";

export default function AccountClient({ accountUser }: { accountUser: any }) {
    const user = useUser();
    const [posts, setPosts] = useState(accountUser.initialPosts || []);
    const [hasMore, setHasMore] = useState(accountUser.hasMore || false);
    const [loading, setLoading] = useState(false);
    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    loadMorePosts();
                }
            },
            { threshold: 1.0 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loading, posts]);

    const loadMorePosts = async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        try {
            const lastPostId = posts[posts.length - 1]?.id;
            const response = await fetch(
                `/api/posts/user-posts?uid=${accountUser.uid}&lastPostId=${lastPostId}&limit=10`
            );
            const data = await response.json();

            setPosts((prev: any[]) => [...prev, ...data.posts]);
            setHasMore(data.hasMore);
        } catch (error) {
            console.error("Failed to load more posts:", error);
        } finally {
            setLoading(false);
        }
    };

    const sidebarUser = {
        name: user.username || "",
        email: user.email || "",
        avatarUrl: user.avatarUrl || "/default-avatar.png",
        uid: user.uid || "",
    };

    accountUser.followersCount = accountUser.followers.length;
    accountUser.followingCount = accountUser.following.length;

    const ownerViewing = accountUser.uid === user.uid;

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
                        <span className="text-xl font-semibold">{accountUser.username == user.username ? "Your Account" : accountUser.username}</span>
                    </div>

                </header>
                <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-12 pt-0">
                    <div className="mx-auto w-full max-w-2xl">
                        <div className="space-y-6">
                            {/* Profile Section */}
                            <div className="border border-border rounded-lg p-4 md:p-6 space-y-4">
                                {/* Avatar and Action Button Row */}
                                <div className="flex items-start justify-between gap-4">
                                    <img
                                        src={accountUser.avatarUrl || "/default-avatar.png"}
                                        alt="User Avatar"
                                        className="size-16 md:size-20 rounded-full object-cover shrink-0"
                                    />
                                    {ownerViewing && (
                                        <Button variant="outline">
                                            <span>Edit Profile</span>
                                        </Button>
                                    )}
                                    {!ownerViewing && (
                                        <Button variant="secondary">
                                            <CirclePlus className="h-4 w-4" />
                                            <span>Follow</span>
                                        </Button>
                                    )}
                                </div>

                                {/* Username */}
                                <div>
                                    <h1 className="text-xl md:text-2xl font-semibold">
                                        @{accountUser.username}
                                    </h1>
                                </div>

                                {/* Description */}
                                {accountUser.description && (
                                    <p className="text-base md:text-lg text-foreground">
                                        {accountUser.description}
                                    </p>
                                )}

                                {/* Stats Row */}
                                <div className="flex flex-wrap gap-4 md:gap-6 text-sm md:text-base">
                                    <div>
                                        <span className="font-semibold">{posts.length}</span>{" "}
                                        <span className="text-muted-foreground">
                                            post{posts.length !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-semibold">{accountUser.followersCount}</span>{" "}
                                        <span className="text-muted-foreground">follower{accountUser.followersCount !== 1 ? "s" : ""}</span>
                                    </div>
                                    <div>
                                        <span className="font-semibold">{accountUser.followingCount}</span>{" "}
                                        <span className="text-muted-foreground">following</span>
                                    </div>
                                </div>
                            </div>

                            <PostsGrid 
                                posts={posts} 
                                currentUserId={user.uid}
                            />

                            {/* Infinite scroll trigger */}
                            {hasMore && (
                                <div ref={observerTarget} className="flex justify-center py-4">
                                    {loading && <span className="text-muted-foreground">Loading more posts...</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
