"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useUser } from "@/lib/user-context";
import { Button } from "@/components/ui/button";
import { CirclePlus, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { PostsGrid } from "@/components/posts-grid";
import { toggleFollow, editProfile } from "@/services/social";
import { ErrorComponent } from "@/components/ui/error";
import { SidebarHeaderComponent } from "@/components/sidebar-header";
import { EditProfileDialog } from "@/components/edit-profile-dialog";
import { loadUserPosts, getPost } from "@/services/posts";
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

export default function AccountPage() {
  const params = useParams();
  const username = decodeURIComponent(params.username as string);
  const user = useUser();

  const [accountUser, setAccountUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const [displayUsername, setDisplayUsername] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("/default-avatar.png");

  const [following, setFollowing] = useState<boolean>(false);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initial data fetch
  useEffect(() => {
    const fetchAccountData = async () => {
      if (!username) return;

      setLoading(true);
      try {
        const response = await fetch(`/api/social/get-users?username=${encodeURIComponent(username)}`);
        if (!response.ok) {
          throw new Error('User not found');
        }

        const userData = await response.json();
        setAccountUser(userData);
        setDisplayUsername(userData.username);
        setDescription(userData.description || "");
        setAvatarUrl(userData.avatarUrl || "/default-avatar.png");
        setFollowersCount(userData.followersCount || 0);
        setFollowingCount(userData.followingCount || 0);
        setFollowing(userData.isFollowing || false);

        // Load initial posts
        const postsData = await loadUserPosts(userData.uid, undefined, 5);
        setPosts(postsData.posts);
        setHasMore(postsData.hasMore);
      } catch (error) {
        console.error("Failed to load account:", error);
        setError("Failed to load account data");
      } finally {
        setLoading(false);
      }
    };

    fetchAccountData();
  }, [username]);

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
    if (loadingMore || !hasMore || !accountUser) return;

    setLoadingMore(true);
    try {
      const lastPostId: string | undefined = posts[posts.length - 1]?.id;
      const data = await loadUserPosts(accountUser.uid, lastPostId, 5);

      setPosts((prev: Post[]) => [...prev, ...data.posts]);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Failed to load more posts:", error);
      setError("Failed to load more posts");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFollowToggle = async (): Promise<void> => {
    if (!accountUser) return;

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
    if (!accountUser) return;

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

      setDisplayUsername(data.username);
      setDescription(data.description);
      setAvatarUrl(newAvatarUrl);
    } catch (error) {
      throw error;
    }
  };

  const sidebarUser: SidebarUser = {
    name: user.username || "",
    email: user.email || "",
    avatarUrl: user.avatarUrl || "/default-avatar.png",
    uid: user.uid || "",
  };

  const ownerViewing: boolean = accountUser?.uid === user.uid;

  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar user={sidebarUser} />
        <SidebarInset>
          <SidebarHeaderComponent title="Account" />
          <div className="flex flex-1 items-center justify-center">
            <LoadingComponent text="Loading account..." />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!accountUser) {
    return (
      <SidebarProvider>
        <AppSidebar user={sidebarUser} />
        <SidebarInset>
          <SidebarHeaderComponent title="Account" />
          <div className="flex flex-1 justify-center">
            <h1 className="text-xl md:text-2xl font-semibold">
              Could not find user: {username}
            </h1>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar user={sidebarUser} />
      <SidebarInset>
        <SidebarHeaderComponent title={displayUsername === user.username ? "Your Account" : displayUsername} />
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
                    {displayUsername}
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
                    <span className="font-semibold">{followingCount}</span>{" "}
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
                onCommentUpdated={async (postId) => {
                  // Refresh only the specific post that was commented on
                  try {
                    const updatedPost = await getPost(postId);
                    setPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
                  } catch (error) {
                    console.error("Failed to refresh post after comment:", error);
                  }
                }}
                showFollowing={false}
              />

              {/* Infinite scroll trigger */}
              {hasMore && (
                <div ref={observerTarget} className="flex justify-center py-4">
                  {loadingMore && <LoadingComponent text="Loading more posts..." />}
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
      <EditProfileDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        currentUsername={displayUsername}
        currentDescription={description}
        currentAvatarUrl={avatarUrl}
        onSave={handleSaveProfile}
      />
    </SidebarProvider>
  );
}
