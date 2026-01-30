import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Recalculates scores for all posts daily at midnight.
 * The score formula follows: likeCount / (hoursSincePost + 2)^1.5
 */
export const recalculateScores = onSchedule("0 0 * * *", async () => {
  const db = getFirestore();
  logger.info("Recalculating scores for all posts");

  try {
    const postsSnapshot = await db.collection("posts").get();
    const now = Date.now();
    let batch = db.batch();
    let count = 0;

    for (const doc of postsSnapshot.docs) {
      const data = doc.data();
      const createdAt = data.createdAt;

      if (!createdAt) continue;

      // Convert Firestore Timestamp to Date object
      // (Firebase Admin SDK's Timestamp has .toDate() method)
      const createdDate = createdAt.toDate();
      const diffInMs = now - createdDate.getTime();
      const diffInHours = Math.floor(diffInMs / 3600000);
      const likeCount = data.likeCount || 0;

      const score = likeCount / Math.pow((diffInHours + 2), 1.5);

      batch.update(doc.ref, {score});
      count++;

      // Firestore batch limit is 500
      if (count === 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    logger.info(`Successfully recalculated scores for ${
      postsSnapshot.size} posts`);
  } catch (error) {
    logger.error("Error recalculating scores:", error);
  }
});
