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
    Bookmark
} from "lucide-react";
import { useState, useEffect } from "react";
import { toggleLikePost, toggleSavePost } from "@/services/social";
import { useUser } from "@/lib/user-context";

interface PostsGridProps {
    posts: any[];
    currentUserId?: string;
}

export function PostsGrid({ posts, currentUserId }: PostsGridProps) {
    const user = useUser();
    const [expandedPosts, setExpandedPosts] = useState<{ [key: string]: { ingredients: boolean; details: boolean } }>({});
    const [viewingImage, setViewingImage] = useState<{ postId: string; imageIndex: number } | null>(null);
    const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
    const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({});
    const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
    const [saveCounts, setSaveCounts] = useState<{ [key: string]: number }>({});

    // Initialize liked and saved status and counts from posts and user's liked/saved arrays
    useEffect(() => {
        const initialLiked: { [key: string]: boolean } = {};
        const initialLikeCounts: { [key: string]: number } = {};
        const initialSaved: { [key: string]: boolean } = {};
        const initialSaveCounts: { [key: string]: number } = {};

        posts.forEach(post => {
            initialLiked[post.id] = user?.liked?.includes(post.id) || false;
            initialLikeCounts[post.id] = post.likeCount || 0;
            initialSaved[post.id] = user?.saved?.includes(post.id) || false;
            initialSaveCounts[post.id] = post.saveCount || 0;
        });

        setLikedPosts(initialLiked);
        setLikeCounts(initialLikeCounts);
        setSavedPosts(initialSaved);
        setSaveCounts(initialSaveCounts);
    }, [posts, user?.liked, user?.saved]);

    const handleLikeToggle = async (postId: string, e: React.MouseEvent) => {
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

    const toggleSection = (postId: string, section: 'ingredients' | 'details') => {
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
            {/* Posts Grid */}
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
                                                onClick={(e) => handleLikeToggle(post.id, e)}
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
                                                onClick={() => console.log('Delete post:', post.id)}
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
        </>
    );
}
