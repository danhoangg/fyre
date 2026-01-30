import * as functions from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

/**
 * Automatically creates a Firestore user document when a new Firebase Auth user is created.
 * Also handles Google Auth signup by using the profile data.
 */
export const syncUserRecord = functions
  .region("europe-west1")
  .auth.user()
  .onCreate(async (user) => {
  const db = getFirestore();
  const { uid, email, displayName, photoURL } = user;

  logger.info(`Creating user document for ${uid}`);

  try {
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        username: displayName || email?.split("@")[0] || `user_${uid.slice(0, 5)}`,
        email: email || "",
        avatarURL: photoURL || null,
        description: "",
        createdAt: new Date(),
        followersCount: 0,
        followingCount: 0,
      });
      logger.info(`Successfully created document for ${uid}`);
    }
  } catch (error) {
    logger.error(`Error creating user document for ${uid}:`, error);
  }
});
