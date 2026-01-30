import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { normalizeUsername } from "../utils/normalizeUsername";

/**
 * Checks if a username is already taken.
 * Compares against normalized usernames for case-insensitive uniqueness.
 * Callable from the client SDK.
 */
export const checkUsername = onCall(async (request) => {
  const { username } = request.data;

  if (!username || typeof username !== "string") {
    throw new HttpsError("invalid-argument", "Username is required and must be a string.");
  }

  const db = getFirestore();
  const normalizedUsername = normalizeUsername(username);
  
  try {
    const querySnapshot = await db
      .collection("users")
      .where("normalizedUsername", "==", normalizedUsername)
      .limit(1)
      .get();

    return {
      available: querySnapshot.empty
    };
  } catch (error) {
    throw new HttpsError("internal", "Failed to check username availability.");
  }
});
