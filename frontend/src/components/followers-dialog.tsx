"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Search, UserPlus, Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface User {
  uid: string;
  username: string;
  avatarUrl?: string;
  description?: string;
  isFollowing?: boolean;
}

interface FollowersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "followers" | "following";
  userId: string;
  currentUserId?: string;
  onToggleFollow?: (userId: string) => Promise<void>;
  fetchUsers: (
    userId: string,
    lastFollowerId?: string,
    pageLimit?: number
  ) => Promise<{ users: User[]; hasMore: boolean; lastFollowerId: string | null }>;
}

export function FollowersDialog({
  open,
  onOpenChange,
  type,
  userId,
  currentUserId,
  onToggleFollow,
  fetchUsers,
}: FollowersDialogProps) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastFollowerId, setLastFollowerId] = useState<string | null>(null);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});
  const [togglingFollow, setTogglingFollow] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setUsers([]);
      setFilteredUsers([]);
      setSearchQuery("");
      setHasMore(false);
      setLastFollowerId(null);
      setFollowingStates({});
      loadInitialUsers();
    }
  }, [open, userId, type]);

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            user.username.toLowerCase().includes(query) ||
            user.description?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (!open) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreUsers();
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.1,
      }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [open, hasMore, loadingMore, loading, users]);

  const loadInitialUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchUsers(userId, undefined, 5);
      setUsers(data.users);
      setFilteredUsers(data.users);
      setHasMore(data.hasMore);
      setLastFollowerId(data.lastFollowerId);

      // Initialize following states
      const states: Record<string, boolean> = {};
      data.users.forEach((user) => {
        states[user.uid] = user.isFollowing || false;
      });
      setFollowingStates(states);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreUsers = async () => {
    if (loadingMore || !hasMore || !lastFollowerId) return;

    setLoadingMore(true);
    try {
      const data = await fetchUsers(userId, lastFollowerId, 5);

      setUsers((prev) => [...prev, ...data.users]);
      setHasMore(data.hasMore);
      setLastFollowerId(data.lastFollowerId);

      // Update following states for new users
      const newStates: Record<string, boolean> = { ...followingStates };
      data.users.forEach((user) => {
        newStates[user.uid] = user.isFollowing || false;
      });
      setFollowingStates(newStates);
    } catch (error) {
      console.error("Failed to load more users:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleFollow = async (targetUserId: string) => {
    if (!onToggleFollow || togglingFollow) return;

    setTogglingFollow(targetUserId);
    const wasFollowing = followingStates[targetUserId];

    // Optimistic update
    setFollowingStates((prev) => ({
      ...prev,
      [targetUserId]: !wasFollowing,
    }));

    try {
      await onToggleFollow(targetUserId);
    } catch (error) {
      // Revert on error
      setFollowingStates((prev) => ({
        ...prev,
        [targetUserId]: wasFollowing,
      }));
      console.error("Failed to toggle follow:", error);
    } finally {
      setTogglingFollow(null);
    }
  };

  const handleUserClick = (username: string) => {
    onOpenChange(false);
    router.push(`/account/${encodeURIComponent(username)}`);
  };

  const title = type === "followers" ? "Followers" : "Following";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${title.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Users List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto min-h-[300px] max-h-[400px] -mx-6 px-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50"
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
              <span className="ml-2 text-muted-foreground">Loading...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              {searchQuery
                ? "No users found matching your search"
                : `No ${title.toLowerCase()} yet`}
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.uid}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  {/* Avatar */}
                  <button
                    onClick={() => handleUserClick(user.username)}
                    className="shrink-0"
                  >
                    <img
                      src={user.avatarUrl || "/default-avatar.png"}
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  </button>

                  {/* User Info */}
                  <button
                    onClick={() => handleUserClick(user.username)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="font-medium truncate">{user.username}</p>
                    {user.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {user.description}
                      </p>
                    )}
                  </button>

                  {/* Follow Button */}
                  {currentUserId && user.uid !== currentUserId && onToggleFollow && (
                    <Button
                      size="sm"
                      variant={followingStates[user.uid] ? "secondary" : "default"}
                      onClick={() => handleToggleFollow(user.uid)}
                      disabled={togglingFollow === user.uid}
                      className="shrink-0"
                    >
                      {togglingFollow === user.uid ? (
                        <Spinner className="h-4 w-4" />
                      ) : followingStates[user.uid] ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-1" />
                          Follow
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ))}

              {/* Infinite scroll trigger */}
              {hasMore && (
                <div
                  ref={observerTarget}
                  className="flex justify-center py-4"
                >
                  {loadingMore && (
                    <div className="flex items-center gap-2">
                      <Spinner />
                      <span className="text-sm text-muted-foreground">
                        Loading more...
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
