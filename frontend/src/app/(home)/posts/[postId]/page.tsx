"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarHeaderComponent } from "@/components/sidebar-header";
import { ErrorComponent } from "@/components/ui/error";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useUser } from "@/lib/user-context";
import { deletePost, getPost } from "@/services/posts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpRight, Bookmark, ChevronLeft, ChevronRight, CirclePlus, Heart, MoreHorizontal, Send, Share, Trash2, UserRoundX, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatTimeAgo } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { toggleLikePost, toggleSavePost, toggleLikeComment, getComments, toggleFollow } from "@/services/social";
import { writeComment, deleteComment } from "@/services/posts";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { LoadingComponent } from "@/components/ui/loading";

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

export default function PostPage() {
    const router = useRouter();
    const params = useParams();
    const postIdParam = params?.postId;
    const postId = typeof postIdParam === "string" ? decodeURIComponent(postIdParam) : "";
    const { user, setUser } = useUser();

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [post, setPost] = useState<Post | null>(null);
    const [viewingImage, setViewingImage] = useState<{ postId: string; imageIndex: number } | null>(null);
    const [isOwner, setIsOwner] = useState<boolean>(false);
    const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
    const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"ingredients" | "nutrition">("ingredients");
    const [commentText, setCommentText] = useState<string>("");
    const [submittingComment, setSubmittingComment] = useState<boolean>(false);
    const [comments, setComments] = useState<any[]>([]);
    const [likedComments, setLikedComments] = useState<{ [key: string]: boolean }>({});
    const [commentLikeCounts, setCommentLikeCounts] = useState<{ [key: string]: number }>({});
    const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
    const [loadingComments, setLoadingComments] = useState<boolean>(false);
    const [hasMoreComments, setHasMoreComments] = useState<boolean>(false);
    const [lastCommentId, setLastCommentId] = useState<string | null>(null);
    const commentScrollRef = useRef<HTMLDivElement | null>(null);

    const sidebarUser: SidebarUser = {
        name: user.username || "",
        email: user.email || "",
        avatarUrl: user.avatarUrl || "/default-avatar.png",
        uid: user.uid || "",
    };

    const openImageViewer = (postId: string, imageIndex: number, e: React.MouseEvent<HTMLImageElement>) => {
        e.stopPropagation();

        setViewingImage({ postId, imageIndex });
    };

    const navigateImage = (direction: 'left' | 'right') => {
        if (!viewingImage) return;

        if (!post || !post.imageUrls) return;

        const newIndex = direction === 'left'
            ? (viewingImage.imageIndex - 1 + post.imageUrls.length) % post.imageUrls.length
            : (viewingImage.imageIndex + 1) % post.imageUrls.length;

        setViewingImage({ ...viewingImage, imageIndex: newIndex });
    };

    const closeImageViewer = () => {
        setViewingImage(null);
    };

    const fetchPost = async (postId: string) => {
        setLoading(true);
        setError(null);
        try {
            const postData = await getPost(postId);
            setPost(postData);
        } catch (error) {
            console.error("Failed to load post:", error);
            setError("Failed to load post");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (postId) {
            fetchPost(postId);
        }

        setIsOwner(user.uid === post?.authorId);
    }, [postId, user.uid, post?.authorId]);


    const handleDeletePost = async (postId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirmPostId(postId);
    };

    const handleSharePost = async () => {
        const postUrl = `${window.location.origin}/posts/${encodeURIComponent(postId)}`;
        try {
            await navigator.clipboard.writeText(postUrl);
            toast.success("Link copied to clipboard!");
        } catch (error) {
            console.error("Failed to copy link:", error);
            toast.error("Failed to copy link");
        }
    };

    const parseIngredientLine = (line: string) => {
        const match = line.match(/^([\d.,/\s]+(?:g|kg|ml|l|oz|lb|cups|cup|tbsp|tsp|teaspoons|teaspoon|tablespoons|tablespoon|pieces|piece)?\s*)(.*)$/i);
        if (match) {
            return { quantity: match[1].trim(), name: match[2].trim() };
        }
        return { quantity: "", name: line.trim() };
    };

    const parseNutritionLine = (line: string) => {
        const match = line.match(/^(.+?):\s*(.+)$/);
        if (match) {
            return { label: match[1].trim(), value: match[2].trim() };
        }
        return { label: line.trim(), value: "" };
    };

    const confirmDelete = async () => {
        if (!deleteConfirmPostId) return;

        setDeletingPostId(deleteConfirmPostId);
        setError(null);

        try {
            await deletePost(deleteConfirmPostId);

            router.push("/");
            setDeleteConfirmPostId(null);
        } catch (error) {
            console.error("Failed to delete post:", error);
            setError(error instanceof Error ? error.message : "Failed to delete post");
        } finally {
            setDeletingPostId(null);
        }
    }

    const handleLikePostToggle = async (postId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!post) return;

        // Optimistic update - immediately update UI
        const wasLiked = post.isLiked || false;
        const newLikedState = !wasLiked;
        const previousCount = post.likeCount || 0;
        const newCount = newLikedState ? previousCount + 1 : previousCount - 1;

        setPost(prevPost => prevPost ? { ...prevPost, isLiked: newLikedState, likeCount: newCount } : prevPost);

        try {
            await toggleLikePost(postId);
        } catch (error) {
            console.error("Failed to toggle like:", error);
            // Revert on error
            setPost(prevPost => prevPost ? { ...prevPost, isLiked: wasLiked, likeCount: previousCount } : prevPost);
        }
    };

    const handleSaveToggle = async (postId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!post) return;

        const wasSaved = post.isSaved || false;
        const newSavedState = !wasSaved;
        const previousCount = post.saveCount || 0;
        const newCount = newSavedState ? previousCount + 1 : previousCount - 1;

        setPost(prevPost => prevPost ? { ...prevPost, isSaved: newSavedState, saveCount: newCount } : prevPost);

        try {
            // Assume toggleSavePost is implemented similarly to toggleLikePost
            await toggleSavePost(postId);
        } catch (error) {
            console.error("Failed to toggle save:", error);
            // Revert on error
            setPost(prevPost => prevPost ? { ...prevPost, isSaved: wasSaved, saveCount: previousCount } : prevPost);
        }
    }

    const handleFollowToggle = async (authorId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!user || !authorId || !post) return;

        const wasFollowing = post.isAuthorFollowed || false;
        const newFollowing = !wasFollowing;

        setPost(prevPost => prevPost ? { ...prevPost, isAuthorFollowed: newFollowing } : prevPost);

        try {
            await toggleFollow(authorId);
        } catch (error) {
            console.error("Failed to toggle follow:", error);
            setPost(prevPost => prevPost ? { ...prevPost, isAuthorFollowed: wasFollowing } : prevPost);
            setError(error instanceof Error ? error.message : "Failed to toggle follow");
        }
    };

    // Fetch comments when post loads
    useEffect(() => {
        if (post?.comments) {
            setComments(post.comments);
            setHasMoreComments(post.hasMoreComments || false);
            // Initialize liked state for comments
            const initialLiked: { [key: string]: boolean } = {};
            const initialCounts: { [key: string]: number } = {};
            post.comments.forEach((comment: any) => {
                initialLiked[comment.id] = comment.isLiked || false;
                initialCounts[comment.id] = comment.likeCount || 0;
            });
            setLikedComments(initialLiked);
            setCommentLikeCounts(initialCounts);
        }
    }, [post?.comments]);

    const loadMoreComments = async () => {
        if (!post || loadingComments || !hasMoreComments) return;

        setLoadingComments(true);
        try {
            const lastComment = comments[comments.length - 1];
            const result = await getComments(post.id, lastComment?.id, 10);
            setComments(prev => [...prev, ...result.comments]);
            setHasMoreComments(result.hasMore);

            // Initialize liked state for new comments
            result.comments.forEach((comment: any) => {
                setLikedComments(prev => ({ ...prev, [comment.id]: comment.isLiked || false }));
                setCommentLikeCounts(prev => ({ ...prev, [comment.id]: comment.likeCount || 0 }));
            });
        } catch (error) {
            console.error("Failed to load more comments:", error);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleCommentScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
            loadMoreComments();
        }
    };

    const handleSubmitComment = async () => {
        if (!post || !commentText.trim() || submittingComment) return;

        setSubmittingComment(true);

        // Optimistic comment
        const optimisticComment = {
            id: `temp-${Date.now()}`,
            text: commentText,
            username: user.username,
            avatarUrl: user.avatarUrl,
            authorId: user.uid,
            createdAt: new Date().toISOString(),
            isOptimistic: true,
            likeCount: 0,
            isLiked: false
        };

        setComments(prev => [optimisticComment, ...prev]);
        const savedText = commentText;
        setCommentText("");

        try {
            await writeComment({ postId: post.id, content: savedText });
            // Refetch to get the real comment
            const result = await getComments(post.id, undefined, 10);
            setComments(result.comments);
            setHasMoreComments(result.hasMore);
            result.comments.forEach((comment: any) => {
                setLikedComments(prev => ({ ...prev, [comment.id]: comment.isLiked || false }));
                setCommentLikeCounts(prev => ({ ...prev, [comment.id]: comment.likeCount || 0 }));
            });
        } catch (error) {
            console.error("Failed to submit comment:", error);
            // Remove optimistic comment on error
            setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
            setCommentText(savedText);
            toast.error("Failed to post comment");
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleCommentDelete = async (commentId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!post || deletingCommentId) return;

        setDeletingCommentId(commentId);
        try {
            await deleteComment(post.id, commentId);
            setComments(prev => prev.filter(c => c.id !== commentId));
            toast.success("Comment deleted");
        } catch (error) {
            console.error("Failed to delete comment:", error);
            toast.error("Failed to delete comment");
        } finally {
            setDeletingCommentId(null);
        }
    };

    const handleLikeCommentToggle = async (commentId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!post || !user.uid) return;

        const wasLiked = likedComments[commentId] || false;
        const newLikedState = !wasLiked;
        const previousCount = commentLikeCounts[commentId] || 0;
        const newCount = newLikedState ? previousCount + 1 : previousCount - 1;

        setLikedComments(prev => ({ ...prev, [commentId]: newLikedState }));
        setCommentLikeCounts(prev => ({ ...prev, [commentId]: newCount }));

        try {
            await toggleLikeComment(post.id, commentId);
        } catch (error) {
            console.error("Failed to toggle comment like:", error);
            setLikedComments(prev => ({ ...prev, [commentId]: wasLiked }));
            setCommentLikeCounts(prev => ({ ...prev, [commentId]: previousCount }));
        }
    };


    if (!post) {
        return (
            <SidebarProvider>
                <AppSidebar user={sidebarUser} />
                <SidebarInset>
                    <SidebarHeaderComponent title="Post" />
                    {loading && <LoadingComponent text="Loading post..." />}
                    {error && <ErrorComponent message={error} />}
                </SidebarInset>
            </SidebarProvider>
        )
    }

    return (
        <SidebarProvider>
            <AppSidebar user={sidebarUser} />
            <SidebarInset>
                <SidebarHeaderComponent title="Post" />
                {error && <ErrorComponent message={error} />}
                <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-12 pt-0">
                    <div className="mx-auto w-full max-w-2xl">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={(e) => router.push("/account/" + encodeURIComponent(post.authorUsername))} >
                                <Avatar size="lg" className="flex-shrink-0 aspect-square rounded-full overflow-hidden">
                                    <AvatarImage
                                        src={post.authorAvatarUrl || "/default-avatar.png"}
                                        alt={post.authorUsername || "Author"}
                                        className="object-cover rounded-full"
                                    />
                                    <AvatarFallback>
                                        {(post.authorUsername || "A").charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-sm">
                                        {post.authorUsername || "Unknown"}
                                    </span>
                                    {post.createdAt && (
                                        <span className="text-xs text-muted-foreground">
                                            {formatTimeAgo(post.createdAt)}
                                        </span>
                                    )}
                                </div>
                            </div>


                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={handleSharePost}>
                                        <Share />
                                        Share Post
                                    </DropdownMenuItem>
                                    {isOwner && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem variant="destructive" onClick={(e) => handleDeletePost(post.id, e)}>
                                                <Trash2 />
                                                Delete
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    {!post.isAuthorFollowed ? (
                                        <DropdownMenuItem onClick={(e) => handleFollowToggle(post.authorId, e)}>
                                            <CirclePlus className="h-4 w-4" />
                                            <span>Follow User</span>
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onClick={(e) => handleFollowToggle(post.authorId, e)}>
                                            <UserRoundX className="h-4 w-4" />
                                            <span>Unfollow User</span>
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>

                        </div>

                        <div className="flex items-start justify-between gap-2">
                            <h2 className="text-2xl font-semibold mb-4">{post?.title}</h2>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <button
                                        className={`hover:text-destructive cursor-default flex items-center gap-1 transition-colors ${post.isLiked ? 'text-destructive' : ''
                                            }`}
                                        onClick={(e) => handleLikePostToggle(post.id, e)}
                                        aria-label={post.isLiked ? "Unlike post" : "Like post"}
                                    >
                                        <Heart
                                            className="h-5 w-5"
                                            fill={post.isLiked ? "currentColor" : "none"}
                                        />
                                        <span className="text-sm">{post.likeCount || 0}</span>
                                    </button>
                                    <button
                                        className={`hover:text-green-500 cursor-default flex items-center gap-1 transition-colors ${post.isSaved ? 'text-green-500' : ''
                                            }`}
                                        onClick={(e) => handleSaveToggle(post.id, e)}
                                        aria-label={post.isSaved ? "Unsave post" : "Save post"}
                                    >
                                        <Bookmark
                                            className="h-5 w-5"
                                            fill={post.isSaved ? "currentColor" : "none"}
                                        />
                                        <span className="text-sm">{post.saveCount || 0}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Images Carousel/Grid */}
                        {post.imageUrls && post.imageUrls.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                                {post.imageUrls.map((url: string, idx: number) => (
                                    <img
                                        key={idx}
                                        src={url}
                                        alt={`${post.title} - Image ${idx + 1}`}
                                        className="w-full h-48 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={(e) => openImageViewer(post.id, idx, e)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Description */}
                        {post.description && (
                            <p className="text-base leading-relaxed mt-4">{post.description}</p>
                        )}

                        {/* Ingredients/Nutrition Table */}
                        {(post.ingredients || post.nutrition) && (
                            <div className="mt-6">
                                <div className="flex gap-2 mb-4">
                                    {post.ingredients && (
                                        <Button
                                            variant={activeTab === "ingredients" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setActiveTab("ingredients")}
                                        >
                                            Ingredients
                                        </Button>
                                    )}
                                    {post.nutrition && (
                                        <Button
                                            variant={activeTab === "nutrition" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setActiveTab("nutrition")}
                                        >
                                            Nutrition
                                        </Button>
                                    )}
                                </div>

                                <div className="rounded-lg border">
                                    <Table>
                                        <TableBody>
                                            {activeTab === "ingredients" && post.ingredients && (
                                                post.ingredients.split("\n").filter((line: string) => line.trim()).map((line: string, idx: number) => {
                                                    const { quantity, name } = parseIngredientLine(line);
                                                    return (
                                                        <TableRow key={idx}>
                                                            <TableCell className="w-24 font-medium text-muted-foreground">
                                                                {quantity}
                                                            </TableCell>
                                                            <TableCell>{name}</TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                            {activeTab === "nutrition" && post.nutrition && (
                                                post.nutrition.split("\n").filter((line: string) => line.trim()).map((line: string, idx: number) => {
                                                    const { label, value } = parseNutritionLine(line);
                                                    return (
                                                        <TableRow key={idx}>
                                                            <TableCell className="font-medium">{label}</TableCell>
                                                            <TableCell className="text-right text-muted-foreground">
                                                                {value}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Steps */}
                        {post.directions && (
                            <div className="mt-6">
                                <h3 className="text-lg font-semibold mb-4">Steps</h3>
                                <div className="space-y-3">
                                    {post.directions.split("\n").filter((line: string) => line.trim()).map((step: string, idx: number) => (
                                        <div key={idx} className="flex gap-3 items-start">
                                            <Avatar size="sm" className="flex-shrink-0">
                                                <AvatarFallback>
                                                    {idx + 1}
                                                </AvatarFallback>
                                            </Avatar>
                                            <p className="text-base leading-relaxed pt-0.5">{step.trim()}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Separator className="my-6" />

                        {/* Comments Section */}

                        <div className="space-y-4">
                            <h4 className="font-semibold text-sm">Comments</h4>

                            {/* Comment Input */}
                            {user.uid && (
                                <div className="flex gap-2 items-center">
                                    <Avatar className="h-8 w-8 flex-shrink-0">
                                        <AvatarImage src={user.avatarUrl || '/default-avatar.png'} alt={user.username || 'User'} />
                                        <AvatarFallback>
                                            {user.username?.charAt(0).toUpperCase() || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 flex gap-2">
                                        <Input
                                            placeholder="Write a comment..."
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSubmitComment();
                                                }
                                            }}
                                            disabled={submittingComment}
                                            className="flex-1"
                                        />
                                        <Button
                                            size="icon"
                                            onClick={handleSubmitComment}
                                            disabled={!commentText.trim() || submittingComment}
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Existing Comments */}
                            {comments.length > 0 && (
                                <div
                                    ref={commentScrollRef}
                                    onScroll={handleCommentScroll}
                                    className="space-y-3 max-h-96 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50"
                                >
                                    {comments.map((comment: any, index: number) => (
                                        <div key={comment.id || index} className={`flex gap-3 ${comment.isOptimistic || deletingCommentId === comment.id ? 'opacity-60' : ''}`}>
                                            <Avatar className="h-8 w-8 flex-shrink-0 cursor-pointer" onClick={() => router.push("/account/" + encodeURIComponent(comment.username))}>
                                                <AvatarImage src={comment.avatarUrl || "/default-avatar.png"} alt={comment.username || "User"} />
                                                <AvatarFallback>
                                                    {comment.username?.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/account/" + encodeURIComponent(comment.username))}>
                                                        <span className="font-semibold text-sm">{comment.username === user.username ? "You" : comment.username}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatTimeAgo(comment.createdAt)}
                                                        </span>
                                                    </div>
                                                    {user.uid === comment.authorId && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button size="icon" variant="ghost" className="h-6 w-6">
                                                                    <MoreHorizontal className="h-3 w-3" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent>
                                                                <DropdownMenuItem variant="destructive" onClick={(e) => handleCommentDelete(comment.id, e)}>
                                                                    <Trash2 />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </div>
                                                <p className="text-sm">{comment.text}</p>
                                                <button
                                                    className={`hover:text-destructive cursor-default flex items-center gap-1 transition-colors ${likedComments[comment.id] ? 'text-destructive' : ''}`}
                                                    onClick={(e) => handleLikeCommentToggle(comment.id, e)}
                                                    disabled={!user.uid}
                                                    aria-label={likedComments[comment.id] ? "Unlike comment" : "Like comment"}
                                                >
                                                    <Heart
                                                        className="h-4 w-4"
                                                        fill={likedComments[comment.id] ? "currentColor" : "none"}
                                                    />
                                                    <span className="text-sm">{commentLikeCounts[comment.id] || 0}</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Loading indicator for more comments */}
                                    {loadingComments && (
                                        <div className="flex justify-center py-2">
                                            <Spinner className="h-4 w-4" />
                                        </div>
                                    )}

                                    {/* "Load more" message when at end */}
                                    {!hasMoreComments && comments.length > 4 && (
                                        <div className="text-center text-xs text-muted-foreground py-2">
                                            No more comments
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Empty state */}
                            {comments.length === 0 && !loadingComments && (
                                <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
                            )}
                        </div>

                    </div>
                </div>

                {/* Image Viewer Modal */}
                {viewingImage && (() => {
                    if (!post || !post.imageUrls) return null;

                    const currentImage = post.imageUrls[viewingImage.imageIndex];
                    const hasMultipleImages = post.imageUrls.length > 1;

                    return (
                        <div
                            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                            onClick={closeImageViewer}
                        >
                            {/* Close Button */}
                            <button
                                className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
                                onClick={closeImageViewer}
                                aria-label="Close"
                            >
                                <X className="h-8 w-8" />
                            </button>

                            {/* Image Counter */}
                            {hasMultipleImages && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                                    {viewingImage.imageIndex + 1} / {post.imageUrls.length}
                                </div>
                            )}

                            {/* Navigation Buttons */}
                            {hasMultipleImages && (
                                <>
                                    <button
                                        className="absolute left-4 text-white hover:text-gray-300 transition-colors p-2 bg-black/50 rounded-full"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigateImage('left');
                                        }}
                                        aria-label="Previous image"
                                    >
                                        <ChevronLeft className="h-8 w-8" />
                                    </button>
                                    <button
                                        className="absolute right-4 text-white hover:text-gray-300 transition-colors p-2 bg-black/50 rounded-full"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigateImage('right');
                                        }}
                                        aria-label="Next image"
                                    >
                                        <ChevronRight className="h-8 w-8" />
                                    </button>
                                </>
                            )}

                            {/* Image */}
                            <img
                                src={currentImage}
                                alt={`${post.title} - Image ${viewingImage.imageIndex + 1}`}
                                className="max-h-[90vh] max-w-[90vw] object-contain"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    );
                })()}

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={deleteConfirmPostId !== null} onOpenChange={(open) => !open && setDeleteConfirmPostId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Post</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete this post? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDelete}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </SidebarInset>
        </SidebarProvider >
    )
}