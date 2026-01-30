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
