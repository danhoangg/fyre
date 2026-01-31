"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarHeaderComponent } from "@/components/sidebar-header";
import { ErrorComponent } from "@/components/ui/error";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUser } from "@/lib/user-context";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
// Format a message date: if within 24h, show time, else show date
function formatMessageDate(createdAt: any): string {
    let dateObj: Date | null = null;
    if (!createdAt) return "";
    if (typeof createdAt.toDate === "function") {
        dateObj = createdAt.toDate();
    } else if (createdAt instanceof Date) {
        dateObj = createdAt;
    } else if (typeof createdAt === "number") {
        dateObj = new Date(createdAt);
    } else if (typeof createdAt === "string") {
        const parsed = Date.parse(createdAt);
        if (!isNaN(parsed)) dateObj = new Date(parsed);
    }
    if (!dateObj) return "";
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 24) {
        // Show time (e.g. 14:23)
        return dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else {
        // Show date (e.g. Jan 31, 2026)
        return dateObj.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
    }
}
import { getConversationById, subscribeToNewMessages, sendMessage, Message } from "@/services/conversations";
import { getUsers, toggleFollow } from "@/services/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { LoadingComponent } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CirclePlus, MoreHorizontal, Scroll, Send, Share, UserRoundX } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface SidebarUser {
    name: string;
    email: string;
    avatarUrl: string;
    uid: string;
}

const PAGE_SIZE = 15;

export default function MessagesPage() {
    const router = useRouter();
    const params = useParams();
    const conversationIdParam = params?.conversationId;
    const conversationId = typeof conversationIdParam === "string" ? decodeURIComponent(conversationIdParam) : "";
    const { user, setUser } = useUser();
    const [friend, setFriend] = useState<any>(null);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [lastMessageId, setLastMessageId] = useState<string | null>(null);
    const [messageInput, setMessageInput] = useState<string>("");

    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const sidebarUser: SidebarUser = {
        name: user.username || "",
        email: user.email || "",
        avatarUrl: user.avatarUrl || "/default-avatar.png",
        uid: user.uid || "",
    };

    // Load initial messages
    useEffect(() => {
        if (!conversationId) return;

        const loadInitialMessages = async () => {
            try {
                setLoading(true);
                const result = await getConversationById(conversationId, null, PAGE_SIZE);

                const friendId = (result.conversation as any).users.find((id: string) => id !== user.uid);
                const friendData = await getUsers([friendId]);
                setFriend(friendData[0]);

                // Reverse to show oldest first at the top
                setMessages(result.messages.reverse() as Message[]);
                setHasMore(result.hasMore);
                setLastMessageId(result.lastMessageId);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load messages");
            } finally {
                setLoading(false);
            }
        };

        loadInitialMessages();
    }, [conversationId, user.uid]);

    useEffect(() => {
        if (!scrollAreaRef.current) return;

        const viewport = scrollAreaRef.current.querySelector(
            "[data-radix-scroll-area-viewport]"
        ) as HTMLDivElement | null;

        if (!viewport) return;

        viewport.scrollTop = viewport.scrollHeight;
    }, [messages.length]);


    // Subscribe to new messages in real-time
    useEffect(() => {
        if (!conversationId || !user.uid) return;

        const unsubscribe = subscribeToNewMessages(
            conversationId,
            user.uid,
            (newMessage) => {
                setMessages((prev) => {
                    // If message already exists by id, ignore
                    if (prev.some((m) => m.id === newMessage.id)) return prev;

                    // Remove matching optimistic message (by text + uid) to avoid duplicates
                    const filtered = prev.filter(
                        (m) => !(m.isOptimistic && m.text === newMessage.text && m.uid === newMessage.uid)
                    );

                    return [...filtered, newMessage];
                });
                // Scroll to bottom when new message arrives
                setTimeout(() => {
                    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
                    if (viewport) {
                        viewport.scrollTop = viewport.scrollHeight;
                    }
                }, 100);
            },
            (err) => {
                console.error("Subscription error:", err);
            }
        );

        return () => unsubscribe();
    }, [conversationId, user.uid]);

    // Load more messages (infinite scroll)
    const loadMoreMessages = useCallback(async () => {
        if (!conversationId || !hasMore || loadingMore || !lastMessageId) return;

        try {
            if (!scrollAreaRef.current) {
                setLoadingMore(true);
                const result = await getConversationById(conversationId, lastMessageId, PAGE_SIZE);
                setMessages((prev) => [...(result.messages.reverse() as Message[]), ...prev]);
                setHasMore(result.hasMore);
                setLastMessageId(result.lastMessageId);
                setLoadingMore(false);
                return;
            }

            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
            if (!viewport) {
                setLoadingMore(true);
                const result = await getConversationById(conversationId, lastMessageId, PAGE_SIZE);
                setMessages((prev) => [...(result.messages.reverse() as Message[]), ...prev]);
                setHasMore(result.hasMore);
                setLastMessageId(result.lastMessageId);
                setLoadingMore(false);
                return;
            }

            // Record scroll position from bottom before loading
            const prevScrollHeight = viewport.scrollHeight;
            const prevScrollTop = viewport.scrollTop;

            setLoadingMore(true);
            const result = await getConversationById(conversationId, lastMessageId, PAGE_SIZE);
            setMessages((prev) => {
                // After state update, adjust scroll so user sees same messages
                setTimeout(() => {
                    if (viewport) {
                        const newScrollHeight = viewport.scrollHeight;
                        viewport.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
                    }
                }, 0);
                return [...(result.messages.reverse() as Message[]), ...prev];
            });
            setHasMore(result.hasMore);
            setLastMessageId(result.lastMessageId);
        } catch (err) {
            console.error("Failed to load more messages:", err);
        } finally {
            setLoadingMore(false);
        }
    }, [conversationId, hasMore, loadingMore, lastMessageId]);

    // Handle scroll for infinite loading (scroll up to load older messages)
    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
        const target = event.target as HTMLDivElement;

        // Load more when scrolled near the top
        if (target.scrollTop < 100 && hasMore && !loadingMore) {
            loadMoreMessages();
        }
    }, [hasMore, loadingMore, loadMoreMessages]);

    const handleFollowToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!friend) return;

        const wasFollowing = friend.isFollowing || false;
        const newFollowing = !wasFollowing;

        setFriend((prevFriend: any) => prevFriend ? { ...prevFriend, isFollowing: newFollowing } : prevFriend);

        try {
            await toggleFollow(friend.id);
        } catch (error) {
            console.error("Failed to toggle follow:", error);
            setFriend((prevFriend: any) => prevFriend ? { ...prevFriend, isFollowing: wasFollowing } : prevFriend);
            setError(error instanceof Error ? error.message : "Failed to toggle follow");
        }
    };

    const handleSendMessage = async () => {
        if (!conversationId) return;

        const text = messageInput.trim();
        if (!text) return;

        // Clear input immediately so user can type the next message
        setMessageInput("");

        // Create optimistic message
        const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimisticMessage: any = {
            id: optimisticId,
            text,
            uid: user.uid,
            createdAt: new Date(),
            isOptimistic: true,
        };

        setMessages((prev) => [...prev, optimisticMessage]);

        try {
            const sent = await sendMessage(conversationId, text);

            // Replace optimistic message with the real one (match by optimisticId)
            setMessages((prev) => prev.map((m) => m.id === optimisticId ? sent : m));

            // Scroll to bottom after sending
            setTimeout(() => {
                const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
                if (viewport) {
                    viewport.scrollTop = viewport.scrollHeight;
                }
            }, 100);
        } catch (err) {
            console.error("Failed to send message:", err);
            toast.error(err instanceof Error ? err.message : "Failed to send message");

            // Remove optimistic message on error
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    if (!friend) {
        return (
            <SidebarProvider>
                <AppSidebar user={sidebarUser} />
                <SidebarInset>
                    <SidebarHeaderComponent title="Messages" />
                    {loading && <LoadingComponent text="Loading chat..." />}
                    {error && <ErrorComponent message={error} />}
                </SidebarInset>
            </SidebarProvider>
        )
    }

    return (
        <SidebarProvider>
            <AppSidebar user={sidebarUser} />
            <SidebarInset className="flex flex-col h-[98vh] overflow-hidden">
                <SidebarHeaderComponent title="Messages" />
                {error && <ErrorComponent message={error} />}

                <div className="flex flex-1 flex-col overflow-hidden px-4 md:px-8 lg:px-12">
                    <div className="mx-auto w-full max-w-2xl flex flex-col flex-1 min-h-0 overflow-hidden">
                        {/* Friend header */}
                        <div
                            className="cursor-pointer  flex-shrink-0"
                            onClick={() => router.push("/account/" + encodeURIComponent(friend.username))}
                        >
                            <div className="flex justify-between items-center px-2">
                                <div className="flex items-center gap-4 py-4">
                                    <Avatar size="lg" className="flex-shrink-0">
                                        <AvatarImage
                                            src={friend.avatarUrl || "/default-avatar.png"}
                                            alt={friend.username || "Author"}
                                            className="object-cover"
                                        />
                                        <AvatarFallback>
                                            {(friend.username || "A").charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-xl">
                                            {friend.username || "Unknown"}
                                        </span>
                                    </div>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="icon" variant="ghost">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {!friend.isFollowing ? (
                                            <DropdownMenuItem onClick={(e) => handleFollowToggle(e)}>
                                                <CirclePlus className="h-4 w-4" />
                                                <span>Follow User</span>
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem onClick={(e) => handleFollowToggle(e)}>
                                                <UserRoundX className="h-4 w-4" />
                                                <span>Unfollow User</span>
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                        <Separator className="flex-shrink-0" />

                        {/* Messages scrollable area */}
                        <ScrollArea
                            ref={scrollAreaRef}
                            className="min-h-0 py-4 flex-1 max-h-[75vh] px-4"
                            onScrollCapture={handleScroll}
                        >
                            <div>
                                {loadingMore && (
                                    <LoadingComponent text="Loading older messages..." />
                                )}

                                {loading ? (
                                    <LoadingComponent text="Loading messages..." />
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-4 text-muted-foreground">
                                        No messages yet. Start the conversation!
                                    </div>
                                ) : (
                                    messages.map((message, i, arr) => {
                                        const isOwn = message.uid === user.uid;
                                        const prevSameUser = i > 0 && arr[i - 1].uid === message.uid;
                                        const nextSameUser = i < arr.length - 1 && arr[i + 1].uid === message.uid;
                                        const showTime = !nextSameUser;

                                        return (
                                            <div
                                                key={message.id}
                                                className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                                            >
                                                {/* Message row */}
                                                <div className={`flex ${isOwn ? "justify-end" : "justify-start"} w-full`}>
                                                    <div
                                                        className={`
                                                                    max-w-[70%] px-4 py-2
                                                                    ${prevSameUser ? "mt-1" : "mt-4"}
                                                                    ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}
                                                                    rounded-2xl
                                                                    ${!isOwn && prevSameUser ? "rounded-tl-none" : ""}
                                                                    ${!isOwn && nextSameUser ? "rounded-bl-none" : ""}
                                                                    ${isOwn && prevSameUser ? "rounded-tr-none" : ""}
                                                                    ${isOwn && nextSameUser ? "rounded-br-none" : ""}
                                                                `}
                                                        style={{ wordBreak: "break-word" }}
                                                    >
                                                        <p className="break-words whitespace-pre-line">
                                                            {message.text}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Timestamp */}
                                                {showTime && (
                                                    <span
                                                        className={`
                                                                    mt-1 text-xs opacity-70
                                                                    ${isOwn ? "text-right" : "text-left"}
                                                                    max-w-[70%]
                                                                `}
                                                    >
                                                        {formatMessageDate(message.createdAt)}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })

                                )}
                            </div>
                        </ScrollArea>

                        {/* Message input fixed at bottom */}
                        <div className="py-4 bg-background flex-shrink-0">
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    placeholder="Message..."
                                    className="flex-1 h-10"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={false}
                                />
                                <Button
                                    className="h-10"
                                    onClick={handleSendMessage}
                                    disabled={!messageInput.trim()}
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Send
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
