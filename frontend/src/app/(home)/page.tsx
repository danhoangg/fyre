"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useUser } from "@/lib/user-context";
import { useState, useEffect, useRef } from "react";
import { PostsGrid } from "@/components/posts-grid";
import { ErrorComponent } from "@/components/ui/error";
import { SidebarHeaderComponent } from "@/components/sidebar-header";
import { getPost, loadHomePosts } from "@/services/posts";
import { LoadingComponent } from "@/components/ui/loading";
import { useParams } from "next/navigation";

interface Post {
    id: string;
    [key: string]: any;
}

interface SidebarUser {
    name: string;
    email: string;
    avatarUrl: string;
    uid: string;
}

export default function HomePage() {
    const params = useParams();
    const { user } = useUser();

    const [posts, setPosts] = useState<Post[]>([]);
    const [hasMore, setHasMore] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [mounted, setMounted] = useState<boolean>(false);

    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Initial data fetch
    useEffect(() => {
        const fetchHomeData = async () => {
            setLoading(true);
            try {
                // Load initial posts
                const postsData = await loadHomePosts(user.uid, undefined, 5);
                setPosts(postsData.posts);
                setHasMore(postsData.hasMore);
            } catch (error) {
                console.error("Failed to load home data:", error);
                setError("Failed to load home data");
            } finally {
                setLoading(false);
            }
        };

        fetchHomeData();
    }, [user.uid, params]);

    useEffect(() => {
        const observer: IntersectionObserver = new IntersectionObserver(
            (entries: IntersectionObserverEntry[]) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore) {
                    loadMorePosts();
                }
            },
            { threshold: 1.0 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loadingMore, posts]);

    const loadMorePosts = async (): Promise<void> => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            const lastPostId: string | undefined = posts[posts.length - 1]?.id;
            const data = await loadHomePosts(user.uid, lastPostId, 5);

            setPosts((prev: Post[]) => [...prev, ...data.posts]);
            setHasMore(data.hasMore);
        } catch (error) {
            console.error("Failed to load more posts:", error);
            setError("Failed to load more posts");
        } finally {
            setLoadingMore(false);
        }
    };

    const sidebarUser: SidebarUser = {
        name: user.username || "",
        email: user.email || "",
        avatarUrl: user.avatarUrl || "/default-avatar.png",
        uid: user.uid || "",
    };

    if (!mounted) {
        return null;
    }

    if (loading) {
        return (
            <SidebarProvider>
                <AppSidebar user={sidebarUser} />
                <SidebarInset>
                    <SidebarHeaderComponent title="Home" />
                    <div className="flex flex-1 items-center justify-center">
                        <LoadingComponent text="Loading home page..." />
                    </div>
                </SidebarInset>
            </SidebarProvider>
        );
    }

    return (
        <SidebarProvider>
            <AppSidebar user={sidebarUser} />
            <SidebarInset>
                <SidebarHeaderComponent title="Home" />
                {error && <ErrorComponent message={error} />}
                <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-12 pt-0">
                    <div className="mx-auto w-full max-w-2xl">
                      <h2 className="text-2xl font-semibold mb-4">Latest Posts</h2>
                        {posts.length === 0 ? (
                            <p className="text-center text-gray-500">You either have no friends or your friends haven't posted anything yet 😢 (go check the explore page)</p>
                        ) : (
                        <div className="space-y-6">
                            <PostsGrid
                                posts={posts}
                                currentUserId={user.uid}
                                onPostDeleted={(postId) => {
                                    setPosts(prev => prev.filter(p => p.id !== postId));
                                }}
                                onCommentUpdated={async (postId) => {
                                    // Refresh only the specific post that was commented on
                                    try {
                                        const updatedPost = await getPost(postId);
                                        setPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
                                    } catch (error) {
                                        console.error("Failed to refresh post after comment:", error);
                                    }
                                }}
                            />

                            {/* Infinite scroll trigger */}
                            {hasMore && (
                                <div ref={observerTarget} className="flex justify-center py-4">
                                    {loadingMore && <LoadingComponent text="Loading more posts..." />}
                                </div>
                            )}
                        </div>
                        )}
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
