"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Upload } from "lucide-react";
import { ErrorComponent } from "./ui/error";
import { useRouter } from "next/navigation";

interface EditProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentUsername: string;
    currentDescription?: string;
    currentAvatarUrl?: string;
    onSave: (data: { 
        username: string; 
        description: string; 
        avatarFile?: File;
        avatarChanged: boolean;
    }) => Promise<void>;
}

export function EditProfileDialog({
    open,
    onOpenChange,
    currentUsername,
    currentDescription = "",
    currentAvatarUrl = "",
    onSave,
}: EditProfileDialogProps) {
    const router =useRouter();

    const [username, setUsername] = useState(currentUsername);
    const [description, setDescription] = useState(currentDescription);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string>(currentAvatarUrl);
    const [avatarChanged, setAvatarChanged] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset to original values when dialog opens
    useEffect(() => {
        if (open) {
            setUsername(currentUsername);
            setDescription(currentDescription);
            setAvatarFile(null);
            setAvatarPreview(currentAvatarUrl);
            setAvatarChanged(false);
            setError(null);
        }
    }, [open, currentUsername, currentDescription, currentAvatarUrl]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file');
                return;
            }
            
            setAvatarFile(file);
            setAvatarChanged(true);
            
            // Create preview URL
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            setError(null);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            await onSave({ 
                username, 
                description, 
                avatarFile: avatarFile || undefined,
                avatarChanged
            });
            onOpenChange(false);

            if (username !== currentUsername) {
                router.replace(`/account/${encodeURIComponent(username)}`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save profile");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                        Make changes to your profile here. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Tell us about yourself"
                        />
                    </div>
                    
                    <div className="grid gap-2">
                        <Label>Profile Picture</Label>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading}
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Image
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </div>
                    {avatarPreview && (
                        <div className="flex flex-col items-center gap-2">
                            <img
                                src={avatarPreview}
                                alt="Avatar preview"
                                className="size-24 rounded-full object-cover border-2 border-border"
                            />
                            {avatarChanged && (
                                <span className="text-xs text-muted-foreground">
                                    {avatarFile ? `New image: ${avatarFile.name}` : 'Avatar updated'}
                                </span>
                            )}
                        </div>
                    )}
                    {error && (
                        <ErrorComponent message={error} />
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Spinner className="mr-2" />}
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
