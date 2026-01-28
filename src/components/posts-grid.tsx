"use client";

import { Button } from "@/components/ui/button";
import {
    Heart,
    ChefHat,
    BookOpen,
    Trash2,
    ChevronLeft,
    ChevronRight,
    X,
    Bookmark,
    MessageCircleIcon,
    Send
} from "lucide-react";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toggleLikePost, toggleSavePost, toggleLikeComment } from "@/services/social";
import { deleteComment, deletePost, writeComment } from "@/services/posts";
import { useUser } from "@/lib/user-context";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ErrorComponent } from "@/components/ui/error";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@radix-ui/react-separator";
import { Item } from "@/components/ui/item"
import { formatTimeAgo } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface PostsGridProps {
    posts: any[];
    currentUserId?: string;
    onPostDeleted?: (postId: string) => void;
    onCommentUpdated?: (postId: string) => void;
}

export function PostsGrid({ posts, currentUserId, onPostDeleted, onCommentUpdated }: PostsGridProps) {
    const user = useUser();
    const [expandedPosts, setExpandedPosts] = useState<{ [key: string]: { ingredients: boolean; details: boolean; comments: boolean } }>({});
    const [viewingImage, setViewingImage] = useState<{ postId: string; imageIndex: number } | null>(null);
    const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
    const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({});
    const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
    const [saveCounts, setSaveCounts] = useState<{ [key: string]: number }>({});
    const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
    const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [commentTexts, setCommentTexts] = useState<{ [key: string]: string }>({});
    const [submittingComment, setSubmittingComment] = useState<{ [key: string]: boolean }>({});
    const [optimisticComments, setOptimisticComments] = useState<{ [key: string]: any[] }>({});
    const [deletingComments, setDeletingComments] = useState<{ [key: string]: boolean }>({});

    // Initialize liked and saved status and counts from posts' isLiked/isSaved properties
    useEffect(() => {
        const initialLiked: { [key: string]: boolean } = {};
        const initialLikeCounts: { [key: string]: number } = {};
        const initialSaved: { [key: string]: boolean } = {};
        const initialSaveCounts: { [key: string]: number } = {};

        posts.forEach(post => {
            initialLiked[post.id] = post.isLiked || false;
            initialLikeCounts[post.id] = post.likeCount || 0;
            initialSaved[post.id] = post.isSaved || false;
            initialSaveCounts[post.id] = post.saveCount || 0;

            // Initialize comment like counts if comments exist
            if (post.comments) {
                post.comments.forEach((comment: any) => {
                    initialLiked[comment.id] = comment.isLiked || false;
                    initialLikeCounts[comment.id] = comment.likeCount || 0;
                });
            }

            // Clean up optimistic comments that now exist in real data
            if (optimisticComments[post.id] && post.comments) {
                const realCommentTexts = new Set(post.comments.map((c: any) => c.text));
                const filteredOptimistic = optimisticComments[post.id].filter(
                    oc => !realCommentTexts.has(oc.text)
                );
                if (filteredOptimistic.length !== optimisticComments[post.id].length) {
                    setOptimisticComments(prev => ({
                        ...prev,
                        [post.id]: filteredOptimistic
                    }));
                }
            }
        });

        setLikedPosts(initialLiked);
        setLikeCounts(initialLikeCounts);
        setSavedPosts(initialSaved);
        setSaveCounts(initialSaveCounts);
    }, [posts, optimisticComments]);

    const handleLikeCommentToggle = async (postId: string, commentId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!currentUserId) return;

        // Optimistic update - immediately update UI
        const wasLiked = likedPosts[commentId] || false;
        const newLikedState = !wasLiked;
        const previousCount = likeCounts[commentId] || 0;
        const newCount = newLikedState ? previousCount + 1 : previousCount - 1;

        setLikedPosts(prev => ({ ...prev, [commentId]: newLikedState }));
        setLikeCounts(prev => ({ ...prev, [commentId]: newCount }));

        try {
            await toggleLikeComment(postId, commentId);
        } catch (error) {
            console.error("Failed to toggle like:", error);
            // Revert on error
            setLikedPosts(prev => ({ ...prev, [commentId]: wasLiked }));
            setLikeCounts(prev => ({ ...prev, [commentId]: previousCount }));
        }
    };

    const handleLikePostToggle = async (postId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!currentUserId) return;

        // Optimistic update - immediately update UI
        const wasLiked = likedPosts[postId] || false;
        const newLikedState = !wasLiked;
        const previousCount = likeCounts[postId] || 0;
        const newCount = newLikedState ? previousCount + 1 : previousCount - 1;

        setLikedPosts(prev => ({ ...prev, [postId]: newLikedState }));
        setLikeCounts(prev => ({ ...prev, [postId]: newCount }));

        try {
            await toggleLikePost(postId);
        } catch (error) {
            console.error("Failed to toggle like:", error);
            // Revert on error
            setLikedPosts(prev => ({ ...prev, [postId]: wasLiked }));
            setLikeCounts(prev => ({ ...prev, [postId]: previousCount }));
        }
    };

    const handleSaveToggle = async (postId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!currentUserId) return;

        const wasSaved = savedPosts[postId] || false;
        const newSavedState = !wasSaved;
        const previousCount = saveCounts[postId] || 0;
        const newCount = newSavedState ? previousCount + 1 : previousCount - 1;

        setSavedPosts(prev => ({ ...prev, [postId]: newSavedState }));
        setSaveCounts(prev => ({ ...prev, [postId]: newCount }));

        try {
            // Assume toggleSavePost is implemented similarly to toggleLikePost
            await toggleSavePost(postId);
        } catch (error) {
            console.error("Failed to toggle save:", error);
            // Revert on error
            setSavedPosts(prev => ({ ...prev, [postId]: wasSaved }));
            setSaveCounts(prev => ({ ...prev, [postId]: previousCount }));
        }
    }

    const handleDeletePost = async (postId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirmPostId(postId);
    }

    const handleCommentChange = (postId: string, text: string) => {
        setCommentTexts(prev => ({ ...prev, [postId]: text }));
    };

    const handleCommentDelete = async (postId: string, commentId: string) => {
        setError(null);
        setDeletingComments(prev => ({ ...prev, [commentId]: true }));
        try {
            await deleteComment(postId, commentId);
            if (onCommentUpdated) {
                onCommentUpdated(postId);
            }
        } catch (error) {
            console.error("Failed to delete comment:", error);
            setError(error instanceof Error ? error.message : "Failed to delete comment");
        } finally {
            setDeletingComments(prev => ({ ...prev, [commentId]: false })); 
        }
    }

    const handleSubmitComment = async (postId: string) => {
        const commentText = commentTexts[postId]?.trim();
        if (!commentText || !currentUserId) return;

        setSubmittingComment(prev => ({ ...prev, [postId]: true }));

        // Create optimistic comment
        const optimisticComment = {
            id: `temp-${Date.now()}`,
            text: commentText,
            authorId: currentUserId,
            username: user.displayName || 'You',
            avatarUrl: user.avatarUrl || '',
            createdAt: new Date().toISOString(),
            likeCount: 0,
            isLiked: false,
            isOptimistic: true
        };

        // Add optimistic comment to UI immediately
        setOptimisticComments(prev => ({
            ...prev,
            [postId]: [optimisticComment, ...(prev[postId] || [])]
        }));

        // Clear input immediately for better UX
        setCommentTexts(prev => ({ ...prev, [postId]: '' }));

        try {
            await writeComment({ postId, content: commentText });
            // Notify parent to refresh posts (optimistic comment will be cleaned up when real data arrives)
            if (onCommentUpdated) {
                onCommentUpdated(postId);
            }
        } catch (error) {
            console.error('Failed to submit comment:', error);
            setError(error instanceof Error ? error.message : 'Failed to submit comment');
            // Revert optimistic update and restore input text
            setOptimisticComments(prev => ({
                ...prev,
                [postId]: (prev[postId] || []).filter(c => c.id !== optimisticComment.id)
            }));
            setCommentTexts(prev => ({ ...prev, [postId]: commentText }));
        } finally {
            setSubmittingComment(prev => ({ ...prev, [postId]: false }));
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirmPostId) return;

        setDeletingPostId(deleteConfirmPostId);
        setError(null);

        try {
            await deletePost(deleteConfirmPostId);

            // Call the optional callback to update parent component
            if (onPostDeleted) {
                onPostDeleted(deleteConfirmPostId);
            }
            setDeleteConfirmPostId(null);
        } catch (error) {
            console.error("Failed to delete post:", error);
            setError(error instanceof Error ? error.message : "Failed to delete post");
        } finally {
            setDeletingPostId(null);
        }
    }

    const toggleSection = (postId: string, section: 'ingredients' | 'details' | 'comments') => {
        setExpandedPosts(prev => ({
            ...prev,
            [postId]: {
                ...prev[postId],
                [section]: !prev[postId]?.[section]
            }
        }));
    };

    const openImageViewer = (postId: string, imageIndex: number) => {
        setViewingImage({ postId, imageIndex });
    };

    const closeImageViewer = () => {
        setViewingImage(null);
    };

    const navigateImage = (direction: 'left' | 'right') => {
        if (!viewingImage) return;

        const post = posts.find((p: any) => p.id === viewingImage.postId);
        if (!post || !post.imageUrls) return;

        const newIndex = direction === 'left'
            ? (viewingImage.imageIndex - 1 + post.imageUrls.length) % post.imageUrls.length
            : (viewingImage.imageIndex + 1) % post.imageUrls.length;

        setViewingImage({ ...viewingImage, imageIndex: newIndex });
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!viewingImage) return;

            if (e.key === 'Escape') {
                closeImageViewer();
            } else if (e.key === 'ArrowLeft') {
                navigateImage('left');
            } else if (e.key === 'ArrowRight') {
                navigateImage('right');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewingImage, posts]);

    return (
        <>
            {/* Error Message */}
            {error && <ErrorComponent message={error} />}

            <div className="space-y-6">
                {posts.map((post: any) => {
                    const isOwner = currentUserId && post.authorId === currentUserId;

                    return (
                        <div key={post.id} className="border border-border rounded-lg overflow-hidden">
                            {/* Images Carousel/Grid */}
                            {post.imageUrls && post.imageUrls.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-muted/20">
                                    {post.imageUrls.map((url: string, idx: number) => (
                                        <img
                                            key={idx}
                                            src={url}
                                            alt={`${post.title} - Image ${idx + 1}`}
                                            className="w-full h-48 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => openImageViewer(post.id, idx)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Post Content */}
                            <div className="p-4 space-y-3">
                                {/* Title and Likes */}
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-xl font-semibold">{post.title}</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <button
                                                className={`hover:text-destructive cursor-default flex items-center gap-1 transition-colors ${likedPosts[post.id] ? 'text-destructive' : ''
                                                    }`}
                                                onClick={(e) => handleLikePostToggle(post.id, e)}
                                                disabled={!currentUserId}
                                                aria-label={likedPosts[post.id] ? "Unlike post" : "Like post"}
                                            >
                                                <Heart
                                                    className="h-5 w-5"
                                                    fill={likedPosts[post.id] ? "currentColor" : "none"}
                                                />
                                                <span className="text-sm">{likeCounts[post.id] || 0}</span>
                                            </button>
                                            <button
                                                className={`hover:text-blue-400 cursor-default flex items-center gap-1 transition-colors ${expandedPosts[post.id]?.comments ? 'text-blue-400' : ''}`}
                                                onClick={() => toggleSection(post.id, 'comments')}
                                                disabled={!currentUserId}
                                                aria-label={"Comment on post"}
                                            >
                                                <MessageCircleIcon
                                                    className="h-5 w-5"
                                                />
                                                <span className="text-sm">{post.commentCount || 0}</span>
                                            </button>
                                            <button
                                                className={`hover:text-green-500 cursor-default flex items-center gap-1 transition-colors ${savedPosts[post.id] ? 'text-green-500' : ''
                                                    }`}
                                                onClick={(e) => handleSaveToggle(post.id, e)}
                                                disabled={!currentUserId}
                                                aria-label={savedPosts[post.id] ? "Unsave post" : "Save post"}
                                            >
                                                <Bookmark
                                                    className="h-5 w-5"
                                                    fill={savedPosts[post.id] ? "currentColor" : "none"}
                                                />
                                                <span className="text-sm">{saveCounts[post.id] || 0}</span>
                                            </button>
                                        </div>
                                        {isOwner && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                aria-label="Delete post"
                                                onClick={(e) => handleDeletePost(post.id, e)}
                                                disabled={deletingPostId === post.id}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Description */}
                                {post.description && (
                                    <p className="text-sm text-muted-foreground">{post.description}</p>
                                )}

                                {/* Action Buttons */}
                                {(post.ingredients || post.directions || post.nutrition) && (
                                    <div className="flex gap-2 pt-2">
                                        {post.ingredients && (
                                            <Button
                                                variant={expandedPosts[post.id]?.ingredients ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => toggleSection(post.id, 'ingredients')}
                                            >
                                                <ChefHat className="h-4 w-4" />
                                                <span>Ingredients</span>
                                            </Button>
                                        )}
                                        {(post.directions || post.nutrition) && (
                                            <Button
                                                variant={expandedPosts[post.id]?.details ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => toggleSection(post.id, 'details')}
                                            >
                                                <BookOpen className="h-4 w-4" />
                                                <span>Details</span>
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {/* Collapsible Ingredients Section */}
                                {expandedPosts[post.id]?.ingredients && post.ingredients && (
                                    <div className="pt-3 border-t border-border space-y-2">
                                        <h4 className="font-semibold text-sm">Ingredients:</h4>
                                        <p className="text-sm whitespace-pre-line">{post.ingredients}</p>
                                    </div>
                                )}

                                {/* Collapsible Details Section */}
                                {expandedPosts[post.id]?.details && (
                                    <div className="pt-3 border-t border-border space-y-3">
                                        {post.directions && (
                                            <div className="space-y-2">
                                                <h4 className="font-semibold text-sm">Directions:</h4>
                                                <p className="text-sm whitespace-pre-line">{post.directions}</p>
                                            </div>
                                        )}
                                        {post.nutrition && (
                                            <div className="space-y-2">
                                                <h4 className="font-semibold text-sm">Nutrition:</h4>
                                                <p className="text-sm whitespace-pre-line">{post.nutrition}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Comments Section */}
                                {expandedPosts[post.id]?.comments && (
                                    <div className="pt-3 border-t border-border space-y-4">
                                        <h4 className="font-semibold text-sm">Comments</h4>

                                        {/* Comment Input */}
                                        {currentUserId && (
                                            <div className="flex gap-2 items-center">
                                                <Avatar className="h-8 w-8 flex-shrink-0">
                                                    <AvatarImage src={user.avatarUrl || 'default-avatar.png'} alt={user.displayName || 'User'} />
                                                    <AvatarFallback>
                                                        {user.displayName?.charAt(0).toUpperCase() || 'U'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 flex gap-2">
                                                    <Input
                                                        placeholder="Write a comment..."
                                                        value={commentTexts[post.id] || ''}
                                                        onChange={(e) => handleCommentChange(post.id, e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handleSubmitComment(post.id);
                                                            }
                                                        }}
                                                        disabled={submittingComment[post.id]}
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        size="icon"
                                                        onClick={() => handleSubmitComment(post.id)}
                                                        disabled={!commentTexts[post.id]?.trim() || submittingComment[post.id]}
                                                    >
                                                        <Send className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Existing Comments */}
                                        {(() => {
                                            const allComments = [
                                                ...(optimisticComments[post.id] || []),
                                                ...(post.comments || [])
                                            ];
                                            return allComments.length > 0 && (
                                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50">
                                                    {allComments.map((comment: any, index: number) => (
                                                        <div key={comment.id || index} className={`flex gap-3 ${comment.isOptimistic || deletingComments[comment.id] ? 'opacity-60' : ''}`}>
                                                            <Avatar className="h-8 w-8 flex-shrink-0">
                                                                <AvatarImage src={comment.avatarUrl} alt={comment.username} />
                                                                <AvatarFallback>
                                                                    {comment.username?.charAt(0).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1 space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-semibold text-sm">{comment.username == user.username ? "You" : comment.username}</span>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {formatTimeAgo(comment.createdAt)}
                                                                        </span>
                                                                    </div>
                                                                    {user.uid === comment.authorId && (
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                            aria-label="Delete post"
                                                                            onClick={() => handleCommentDelete(post.id, comment.id)}
                                                                            disabled={deletingComments[comment.id]}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm">{comment.text}</p>
                                                                <button
                                                                    className={`hover:text-destructive cursor-default flex items-center gap-1 transition-colors ${likedPosts[comment.id] ? 'text-destructive' : ''
                                                                        }`}
                                                                    onClick={(e) => handleLikeCommentToggle(post.id, comment.id, e)}
                                                                    disabled={!currentUserId}
                                                                    aria-label={likedPosts[comment.id] ? "Unlike comment" : "Like comment"}
                                                                >
                                                                    <Heart
                                                                        className="h-4 w-4"
                                                                        fill={likedPosts[comment.id] ? "currentColor" : "none"}
                                                                    />
                                                                    <span className="text-sm">{likeCounts[comment.id] || 0}</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Image Viewer Modal */}
            {viewingImage && (() => {
                const post = posts.find((p: any) => p.id === viewingImage.postId);
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
        </>
    );
}
