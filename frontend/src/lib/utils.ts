import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a username for case-insensitive, accent-insensitive comparison.
 * This ensures that "User", "user", "USER", and "üser" are treated as equivalent.
 * 
 * Uses NFD normalization to decompose accented characters, removes diacritical marks,
 * and converts to lowercase.
 * 
 * @param username - The username to normalize
 * @returns The normalized username
 */
export function normalizeUsername(username: string): string {
  return username
    .normalize("NFD") // Decompose accented characters (e.g., é -> e + combining accent)
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
    .toLowerCase() // Convert to lowercase
    .trim(); // Remove leading/trailing whitespace
}

export function formatTimeAgo(createdAt: { _seconds: number; _nanoseconds: number } | string | null | undefined): string {
  if (!createdAt) {
    return 'Unknown date';
  }

  let createdDate: Date;

  if (typeof createdAt === 'string') {
    // Handle ISO string format
    createdDate = new Date(createdAt);
  } else if (createdAt._seconds) {
    // Handle Firestore Timestamp serialized format
    createdDate = new Date(createdAt._seconds * 1000);
  } else {
    return 'Unknown date';
  }

  if (isNaN(createdDate.getTime())) {
    return 'Unknown date';
  }

  const now = Date.now();
  const diffInMs = now - createdDate.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSeconds < 10) {
    return 'Just now';
  } else if (diffInSeconds < 60) {
    return `${diffInSeconds} second${diffInSeconds === 1 ? '' : 's'} ago`;
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  } else if (diffInDays <= 5) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  } else {
    return createdDate.toLocaleDateString();
  }
}
