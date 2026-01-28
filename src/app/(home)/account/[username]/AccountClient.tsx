"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useUser } from "@/lib/user-context";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
    CirclePlus,
    Check
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { PostsGrid } from "@/components/posts-grid";
import { Spinner } from "@/components/ui/spinner";
import { toggleFollow, editProfile } from "@/services/social";
import { ErrorComponent } from "@/components/ui/error";
import { SidebarHeaderComponent } from "@/components/sidebar-header";
import { EditProfileDialog } from "@/components/edit-profile-dialog";
import { uploadFile } from "@/lib/storage";

interface Post {
    id: string;
    [key: string]: any;
}

interface AccountUser {
    uid: string;
    username: string;
    avatarUrl?: string;
    description?: string;
    followersCount: number;
    followingCount: number;
    initialPosts?: Post[];
    hasMore?: boolean;
}

interface SidebarUser {
    name: string;
    email: string;
    avatarUrl: string;
    uid: string;
}

interface AccountClientProps {
    accountUser: AccountUser;
}

interface PostsResponse {
    posts: Post[];
    hasMore: boolean;
}

export default function AccountClient({ accountUser }: AccountClientProps) {
    const user = useUser();
    const [posts, setPosts] = useState<Post[]>(accountUser.initialPosts || []);
    const [hasMore, setHasMore] = useState<boolean>(accountUser.hasMore || false);
    const [loading, setLoading] = useState<boolean>(false);

    const [username, setUsername] = useState<string>(accountUser.username);
    const [description, setDescription] = useState<string>(accountUser.description || "");
    const [avatarUrl, setAvatarUrl] = useState<string>(accountUser.avatarUrl || "/default-avatar.png");

    const [following, setFollowing] = useState<boolean>(false);
    const [followersCount, setFollowersCount] = useState<number>(accountUser.followersCount || 0);
    const [error, setError] = useState<string | null>(null);

    const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
    const [mounted, setMounted] = useState<boolean>(false);

    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setFollowing(user.following?.includes(accountUser.uid) || false);
    }, [user.following, accountUser.uid]);

    useEffect(() => {
        const observer: IntersectionObserver = new IntersectionObserver(
            (entries: IntersectionObserverEntry[]) => {
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

    const loadMorePosts = async (): Promise<void> => {
        if (loading || !hasMore) return;

        setLoading(true);
        try {
            const lastPostId: string | undefined = posts[posts.length - 1]?.id;
            const response: Response = await fetch(
                `/api/posts/user-posts?uid=${accountUser.uid}&lastPostId=${lastPostId}&limit=10`
            );
            const data: PostsResponse = await response.json();

            setPosts((prev: Post[]) => [...prev, ...data.posts]);
            setHasMore(data.hasMore);
        } catch (error) {
            console.error("Failed to load more posts:", error);
            setError("Failed to load more posts");
        } finally {
            setLoading(false);
        }
    };

    const handleFollowToggle = async (): Promise<void> => {
        // Optimistic update - immediately update UI
        const wasFollowing = following;
        const previousCount = followersCount;
        const newFollowingState = !wasFollowing;
        const newCount = newFollowingState ? previousCount + 1 : previousCount - 1;
        
        setFollowing(newFollowingState);
        setFollowersCount(newCount);
        
        try {
            await toggleFollow(accountUser.uid);
        } catch (error) {
            console.error("Follow toggle error:", error);
            setError(error instanceof Error ? error.message : "An error occurred");
            // Revert on error
            setFollowing(wasFollowing);
            setFollowersCount(previousCount);
        }
    }

    const handleSaveProfile = async (data: {
        username: string;
        description: string;
        avatarFile?: File;
        avatarChanged: boolean;
    }): Promise<void> => {
        try {
            const newAvatarUrl = await editProfile(
                data.username,
                data.description,
                accountUser.avatarUrl || "/default-avatar.png",
                accountUser.username,
                data.avatarFile
            );

            if (newAvatarUrl !== accountUser.avatarUrl) {
                accountUser.avatarUrl = newAvatarUrl;
            }
            accountUser.username = data.username;
            accountUser.description = data.description;

            setUsername(data.username);
            setDescription(data.description);
            setAvatarUrl(newAvatarUrl);
        } catch (error) {
            throw error; // Re-throw to let the dialog handle the error
        }
    };

    const sidebarUser: SidebarUser = {
        name: user.username || "",
        email: user.email || "",
        avatarUrl: user.avatarUrl || "/default-avatar.png",
        uid: user.uid || "",
    };

    const ownerViewing: boolean = accountUser.uid === user.uid;

    if (!mounted) {
        return null;
    }

    return (
        <SidebarProvider>
            <AppSidebar user={sidebarUser} />
            <SidebarInset>
                <SidebarHeaderComponent title={username === user.username ? "Your Account" : username} />
                {error && <ErrorComponent message={error} />}
                <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-12 pt-0">
                    <div className="mx-auto w-full max-w-2xl">
                        <div className="space-y-6">
                            {/* Profile Section */}
                            <div className="border border-border rounded-lg p-4 md:p-6 space-y-4">
                                {/* Avatar and Action Button Row */}
                                <div className="flex items-start justify-between gap-4">
                                    <img
                                        src={avatarUrl || "/default-avatar.png"}
                                        alt="User Avatar"
                                        className="size-16 md:size-20 rounded-full object-cover shrink-0"
                                    />
                                    {ownerViewing && (
                                        <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                                            <span>Edit Profile</span>
                                        </Button>
                                    )}
                                    {!ownerViewing && !following && (
                                        <Button variant="secondary" onClick={handleFollowToggle}>
                                            <CirclePlus className="h-4 w-4" />
                                            <span>Follow</span>
                                        </Button>
                                    )}
                                    {!ownerViewing && following && (
                                        <Button variant="secondary" onClick={handleFollowToggle}>
                                            <Check className="h-4 w-4" />
                                            <span>Following</span>
                                        </Button>
                                    )}
                                </div>

                                {/* Username */}
                                <div>
                                    <h1 className="text-xl md:text-2xl font-semibold">
                                        @{username}
                                    </h1>
                                </div>

                                {/* Description */}
                                {description && (
                                    <p className="text-base md:text-lg text-foreground">
                                        {description}
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
                                        <span className="font-semibold">{followersCount}</span>{" "}
                                        <span className="text-muted-foreground">follower{followersCount !== 1 ? "s" : ""}</span>
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
                                onPostDeleted={(postId) => {
                                    setPosts(prev => prev.filter(p => p.id !== postId));
                                }}
                            />

                            {/* Infinite scroll trigger */}
                            {hasMore && (
                                <div ref={observerTarget} className="flex justify-center py-4">
                                    {loading && <div className="flex items-center gap-2"><Spinner /> <span className="text-muted-foreground">Loading more posts...</span></div>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </SidebarInset>
            <EditProfileDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                currentUsername={username}
                currentDescription={description}
                currentAvatarUrl={avatarUrl}
                onSave={handleSaveProfile}
            />
        </SidebarProvider>
    );
}
