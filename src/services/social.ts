export const toggleLikePost = async (postId: string) => {
    const res = await fetch("/api/social/like-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to toggle like");
    }

    const result = await res.json();
    return result.isLiked;
}

export const toggleSavePost = async (postId: string) => {
    const res = await fetch("/api/social/save-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to toggle save");
    }

    const result = await res.json();
    return result.isSaved;
}

export const toggleFollow = async (followUid: string) => {
    const res = await fetch("/api/social/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUid }),
    });

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to toggle follow");
    }

    const result = await res.json();
    return result.isFollowing;
}

export const editProfile = async (username: string, description: string, currentAvatarUrl: string, currentUsername: string, avatarFile?: File) => {
    let newAvatarUrl = currentAvatarUrl;
    let uploadedAvatarUrl: string | null = null;

    try {
        // Check if username is being changed and if new username is available
        if (username !== currentUsername) {
            const checkRes = await fetch("/api/auth/check-username", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username }),
            });

            if (!checkRes.ok) {
                const data = await checkRes.json();
                throw new Error(data.error || "Username is not available");
            }
        }

        // Upload new avatar if provided
        if (avatarFile) {
            const formData = new FormData();
            formData.append("file", avatarFile);
            formData.append("path", "avatars");

            const uploadRes = await fetch("/api/storage/upload", {
                method: "POST",
                body: formData,
            });

            if (!uploadRes.ok) {
                const data = await uploadRes.json();
                throw new Error(data.error || "Failed to upload avatar");
            }

            const uploadData = await uploadRes.json();
            newAvatarUrl = uploadData.url;
            uploadedAvatarUrl = uploadData.url;
        }

        // Update user record
        const updateRes = await fetch("/api/social/edit-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, description, avatarUrl: newAvatarUrl }),
        });

        if (!updateRes.ok) {
            const data = await updateRes.json();
            
            // Revert: delete the newly uploaded avatar if update fails
            if (uploadedAvatarUrl) {
                try {
                    await fetch("/api/storage/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url: uploadedAvatarUrl }),
                    });
                } catch (deleteErr) {
                    console.error("Failed to delete uploaded avatar during rollback:", deleteErr);
                }
            }

            throw new Error(data.error || "Failed to update profile");
        }

        // Delete old avatar if everything succeeded and we uploaded a new one
        if (uploadedAvatarUrl && currentAvatarUrl && !currentAvatarUrl.includes("/default-avatar.png")) {
            try {
                await fetch("/api/storage/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: currentAvatarUrl }),
                });
            } catch (deleteErr) {
                // Log but don't fail the operation if old avatar cleanup fails
                console.error("Failed to delete old avatar:", deleteErr);
            }
        }

        return newAvatarUrl;
    } catch (error) {
        throw error;
    }
}