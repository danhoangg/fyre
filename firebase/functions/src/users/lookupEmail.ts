import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Looks up the email associated with a given username.
 * Callable from the client SDK.
 */
export const lookupEmail = onCall(async (request) => {
    try {
        const { username } = request.data;

        if (!username) {
            throw new HttpsError(
                "invalid-argument",
                "Username is required"
            );
        }

        const db = getFirestore();

        // Query Firestore for user by username
        const querySnapshot = await db
            .collection("users")
            .where("username", "==", username)
            .limit(1)
            .get()

        if (querySnapshot.empty) {
            throw new HttpsError(
                "not-found",
                "Username not found"
            );
        }

        const userDoc = querySnapshot.docs[0]
        const email = userDoc.data().email

        return { email };
    } catch (error) {
        console.error("Email lookup error:", error)
        throw new HttpsError(
            "internal",
            "Failed to lookup email"
        )
    }
});
