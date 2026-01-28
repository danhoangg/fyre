export const createPost = async (data: {
    title: string;
    description: string;
    ingredients: string;
    directions: string;
    nutrition: string;
    imageUrls: string[];
}): Promise<void> => {
    const res = await fetch("/api/posts/create-post", {
        method: "POST",
        body: new URLSearchParams({
            title: data.title,
            description: data.description,
            ingredients: data.ingredients,
            directions: data.directions,
            nutrition: data.nutrition,
            imageUrls: JSON.stringify(data.imageUrls),
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Create post failed: ${res.status} ${text}`);
    }
};

export const deletePost = async (postId: string): Promise<void> => {
    const res = await fetch("/api/posts/delete-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete post");
    }
}

export const loadUserPosts = async (uid: string, lastPostId?: string, limit: number = 10): Promise<{
    posts: any[];
    hasMore: boolean;
}> => {
    const response = await fetch(
        `/api/posts/user-posts?uid=${uid}&lastPostId=${lastPostId || ''}&limit=${limit}`
    );

    if (!response.ok) {
        throw new Error("Failed to load posts");
    }

    return response.json();
};

export const loadSavedPosts = async (uid: string, lastPostId?: string, limit: number = 10): Promise<{
    posts: any[];
    hasMore: boolean;
}> => {
    const response = await fetch(
        `/api/posts/get-saved-posts?uid=${uid}&lastPostId=${lastPostId || ''}&limit=${limit}`
    );

    if (!response.ok) {
        throw new Error("Failed to load saved posts");
    }

    return response.json();
};

export const loadHomePosts = async (uid: string, lastPostId?: string, limit: number = 10): Promise<{
    posts: any[];
    hasMore: boolean;
}> => {
    const response = await fetch(
        `/api/posts/get-home-posts?uid=${uid}&lastPostId=${lastPostId || ''}&limit=${limit}`
    );

    if (!response.ok) {
        throw new Error("Failed to load home posts");
    }

    return response.json();
};

export const writeComment = async (data: {
    postId: string;
    content: string;
}): Promise<void> => {
    const res = await fetch("/api/posts/write-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            postId: data.postId,
            content: data.content,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Write comment failed: ${res.status} ${text}`);
    }
};

export const deleteComment = async (postId: string, commentId: string): Promise<void> => {
    const res = await fetch("/api/posts/delete-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, commentId }),
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete comment");
    }
};

export const getPost = async (postId: string): Promise<any> => {
    const response = await fetch(`/api/posts/get-post?postId=${postId}`);

    if (!response.ok) {
        throw new Error("Failed to load post");
    }

    return response.json();
};