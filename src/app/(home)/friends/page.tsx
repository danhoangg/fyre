"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { SidebarHeaderComponent } from "@/components/sidebar-header"
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
import { Input } from "@/components/ui/input"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { useUser } from "@/lib/user-context"
import { getUsersData, searchUsers } from "@/services/social"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Check, CirclePlus, Search } from "lucide-react"
import { ErrorComponent } from "@/components/ui/error"

import { toggleFollow } from "@/services/social"
import { LoadingComponent } from "@/components/ui/loading"

export default function Page() {
    const router = useRouter()
    const user = useUser()
    const sidebarUser = {
        name: user.username || "",
        email: user.email || "",
        avatarUrl: user.avatarUrl || "/default-avatar.png",
        uid: user.uid || "",
    }

    const [friendsData, setFriendsData] = useState<any[]>([]);
    const [following, setFollowing] = useState<{ [key: string]: boolean }>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [showingSearch, setShowingSearch] = useState<boolean>(false);

    useEffect(() => {
        setLoading(true);
        if (user.friends && user.friends.length > 0) {
            getUsersData(user.friends)
                .then(data => setFriendsData(data))
                .catch(error => setError(error instanceof Error ? error.message : "Failed to fetch friends data"));
        }

        setFollowing(prev => {
            const newFollowing: { [key: string]: boolean } = { ...prev };
            user.following?.forEach((uid: string) => {
                newFollowing[uid] = true;
            });
            return newFollowing;
        });

        setLoading(false);
    }, [user.friends, user.following]);

    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (searchQuery.trim()) {
                setIsSearching(true);
                setShowingSearch(true);
                try {
                    const results = await searchUsers(searchQuery);
                    setSearchResults(results);
                } catch (error) {
                    console.error("Search error:", error);
                    setError(error instanceof Error ? error.message : "Failed to search users");
                } finally {
                    setIsSearching(false);
                }
            } else {
                setShowingSearch(false);
                setSearchResults([]);
            }
        }, 300); // Debounce search by 300ms

        return () => clearTimeout(delaySearch);
    }, [searchQuery]);

    const handleFollowToggle = async (e: React.MouseEvent, friendUid: string): Promise<void> => {
        e.stopPropagation(); // Prevent navigation when clicking follow button
        // Optimistic update - immediately update UI
        const wasFollowing = following[friendUid] || false;

        setFollowing(prev => ({
            ...prev,
            [friendUid]: !prev[friendUid],
        }));

        try {
            await toggleFollow(friendUid);
        } catch (error) {
            console.error("Follow toggle error:", error);
            setError(error instanceof Error ? error.message : "An error occurred");
            // Revert on error
            setFollowing(prev => ({
                ...prev,
                [friendUid]: wasFollowing,
            }));
        }
    }

    return (
        <SidebarProvider>
            <AppSidebar user={sidebarUser} />
            <SidebarInset>
                <SidebarHeaderComponent title="Friends" />
                <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
                    <div className="mx-auto w-full max-w-2xl">
                        {error && <ErrorComponent message={error} />}

                        {/* Search Bar */}
                        <div className="mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Search for users..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        {/* Search Results */}
                        {showingSearch && (
                            <div className="mb-8">
                                <h2 className="mb-4 text-2xl font-semibold">Search Results</h2>
                                <div className="space-y-4">
                                    {isSearching && (
                                        <LoadingComponent text="Searching users..." />
                                    )}
                                    {!isSearching && searchResults.length === 0 && (
                                        <p className="text-muted-foreground">No users found.</p>
                                    )}
                                    {!isSearching && searchResults.map(user => (
                                        <Item
                                            variant="outline"
                                            key={user.uid}
                                            className="cursor-pointer transition-colors hover:bg-accent/50"
                                            onClick={() => router.push(`/account/${user.username}`)}
                                        >
                                            <ItemMedia>
                                                <Avatar size="lg">
                                                    <AvatarImage src={user.avatarUrl || "/default-avatar.png"} />
                                                    <AvatarFallback>{user.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                                                </Avatar>
                                            </ItemMedia>
                                            <ItemContent>
                                                <ItemTitle className="text-lg">{user.username}</ItemTitle>
                                                <ItemDescription>{user.description}</ItemDescription>
                                            </ItemContent>
                                            <ItemActions>
                                                {following[user.uid] ? (
                                                    <Button variant="secondary" onClick={(e) => handleFollowToggle(e, user.uid)}>
                                                        <Check className="h-4 w-4" />
                                                        <span>Following</span>
                                                    </Button>
                                                ) : (
                                                    <Button variant="outline" onClick={(e) => handleFollowToggle(e, user.uid)}>
                                                        <CirclePlus className="h-4 w-4" />
                                                        <span>Follow</span>
                                                    </Button>
                                                )}
                                            </ItemActions>
                                        </Item>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Friends List */}
                        {!showingSearch && (
                            <>
                                <h2 className="mb-6 text-2xl font-semibold">Your Friends</h2>
                                <div className="space-y-4">
                                    {loading &&
                                        <LoadingComponent text="Loading friends..." />
                                    }
                                    {!loading && friendsData.length === 0 && <p>You have no friends ☹️</p>}
                                    {friendsData.map(friend => (
                                        <Item
                                            variant="outline"
                                            key={friend.uid}
                                            className="cursor-pointer transition-colors hover:bg-accent/50"
                                            onClick={() => router.push(`/account/${friend.username}`)}
                                        >
                                            <ItemMedia>
                                                <Avatar size="lg">
                                                    <AvatarImage src={friend.avatarUrl || "/default-avatar.png"} />
                                                    <AvatarFallback>{friend.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                                                </Avatar>
                                            </ItemMedia>
                                            <ItemContent>
                                                <ItemTitle className="text-lg">{friend.username}</ItemTitle>
                                                <ItemDescription>{friend.description}</ItemDescription>
                                            </ItemContent>
                                            <ItemActions>
                                                {following[friend.uid] ? (
                                                    <Button variant="secondary" onClick={(e) => handleFollowToggle(e, friend.uid)}>
                                                        <Check className="h-4 w-4" />
                                                        <span>Following</span>
                                                    </Button>
                                                ) : (
                                                    <Button variant="outline" onClick={(e) => handleFollowToggle(e, friend.uid)}>
                                                        <CirclePlus className="h-4 w-4" />
                                                        <span>Follow</span>
                                                    </Button>
                                                )}
                                            </ItemActions>
                                        </Item>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
