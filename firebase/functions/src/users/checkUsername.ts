import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Checks if a username is already taken.
 * Callable from the client SDK.
 */
export const checkUsername = onCall(async (request) => {
  const { username } = request.data;

  if (!username || typeof username !== "string") {
    throw new HttpsError("invalid-argument", "Username is required and must be a string.");
  }

  const db = getFirestore();
  
  try {
    const querySnapshot = await db
      .collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();

    return {
      available: querySnapshot.empty
    };
  } catch (error) {
    throw new HttpsError("internal", "Failed to check username availability.");
  }
});
