import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";

/**
 * Generates a session cookie string using the Firebase Admin SDK.
 * This can then be set by the client using nookies or js-cookie.
 */
export const createSession = onCall({
  region: "europe-west1",
}, async (request) => {
  const { idToken } = request.data;

  if (!idToken) {
    throw new HttpsError("invalid-argument", "ID Token is required");
  }

  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

  try {
    const sessionCookie = await getAuth().createSessionCookie(idToken, { expiresIn });
    return { 
      sessionCookie, 
      maxAge: expiresIn / 1000 
    };
  } catch (error) {
    console.error("Error creating session cookie:", error);
    throw new HttpsError("internal", "Failed to create session cookie");
  }
});

/**
 * Revokes the session for the authenticated user.
 */
export const revokeSession = onCall({
  region: "europe-west1",
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in to revoke session.");
  }

  try {
    await getAuth().revokeRefreshTokens(request.auth.uid);
    return { status: "success" };
  } catch (error) {
    throw new HttpsError("internal", "Failed to revoke session.");
  }
});
