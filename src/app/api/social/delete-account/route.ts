import { getCurrentUser } from "@/lib/session"
import { adminDb, adminAuth, bucket } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user?.uid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const uid = user.uid

    // 1. Fetch all user data to clean up
    const [
      postsSnapshot,
      followersSnapshot,
      followingSnapshot,
      friendsSnapshot,
      savedPostsSnapshot,
      myLikesSnapshot,
      mySavesSnapshot,
      myCommentLikesSnapshot,
      followsASnapshot,
      followsBSnapshot,
      myCommentsSnapshot,
    ] = await Promise.all([
      adminDb.collection("posts").where("authorId", "==", uid).get(),
      adminDb.collection("users").doc(uid).collection("followers").get(),
      adminDb.collection("users").doc(uid).collection("following").get(),
      adminDb.collection("users").doc(uid).collection("friends").get(),
      adminDb.collection("users").doc(uid).collection("savedPosts").get(),
      adminDb.collection("postLikes").where("uid", "==", uid).get(),
      adminDb.collection("postSaves").where("uid", "==", uid).get(),
      adminDb.collection("commentLikes").where("uid", "==", uid).get(),
      adminDb.collection("follows").where("fromUid", "==", uid).get(),
      adminDb.collection("follows").where("toUid", "==", uid).get(),
      adminDb.collectionGroup("comments").where("authorId", "==", uid).get(),
    ])

    const batch = adminDb.batch()
    let batchSize = 0

    const commitBatchIfFull = async () => {
      if (batchSize >= 450) {
        await batch.commit()
        batchSize = 0
      }
    }

    // A. Cleanup my posts
    for (const postDoc of postsSnapshot.docs) {
      const postId = postDoc.id
      
      // Cleanup post likes/saves
      const postLikes = await adminDb.collection("postLikes").where("postId", "==", postId).get()
      const postSaves = await adminDb.collection("postSaves").where("postId", "==", postId).get()
      
      for (const like of postLikes.docs) {
        batch.delete(like.ref)
        batchSize++
        await commitBatchIfFull()
      }
      
      for (const save of postSaves.docs) {
        // Also remove from the saver's savedPosts subcollection
        const saverUid = save.data().uid
        batch.delete(adminDb.collection("users").doc(saverUid).collection("savedPosts").doc(postId))
        batch.delete(save.ref)
        batchSize += 2
        await commitBatchIfFull()
      }

      // Delete comments subcollection
      const comments = await postDoc.ref.collection("comments").get()
      for (const comment of comments.docs) {
        // Delete commentLikes for this comment
        const commentLikes = await adminDb.collection("commentLikes").where("commentId", "==", comment.id).get()
        for (const cl of commentLikes.docs) {
          batch.delete(cl.ref)
          batchSize++
          await commitBatchIfFull()
        }
        batch.delete(comment.ref)
        batchSize++
        await commitBatchIfFull()
      }

      batch.delete(postDoc.ref)
      batchSize++
      await commitBatchIfFull()
    }

    // B. Cleanup following (decrement followersCount for targets)
    for (const followingDoc of followingSnapshot.docs) {
      const targetUid = followingDoc.id
      batch.update(adminDb.collection("users").doc(targetUid), {
        followersCount: FieldValue.increment(-1)
      })
      batch.delete(adminDb.collection("users").doc(targetUid).collection("followers").doc(uid))
      batch.delete(followingDoc.ref)
      batchSize += 3
      await commitBatchIfFull()
    }

    // C. Cleanup followers (decrement followingCount for followers)
    for (const followerDoc of followersSnapshot.docs) {
      const followerUid = followerDoc.id
      batch.update(adminDb.collection("users").doc(followerUid), {
        followingCount: FieldValue.increment(-1)
      })
      batch.delete(adminDb.collection("users").doc(followerUid).collection("following").doc(uid))
      batch.delete(followerDoc.ref)
      batchSize += 3
      await commitBatchIfFull()
    }

    // D. Cleanup friends
    for (const friendDoc of friendsSnapshot.docs) {
      const friendUid = friendDoc.id
      batch.delete(adminDb.collection("users").doc(friendUid).collection("friends").doc(uid))
      batch.delete(friendDoc.ref)
      batchSize += 2
      await commitBatchIfFull()
    }

    // E. Cleanup my saves (decrement saveCount for Target Post)
    for (const saveDoc of mySavesSnapshot.docs) {
      const targetPostId = saveDoc.data().postId
      batch.update(adminDb.collection("posts").doc(targetPostId), {
        saveCount: FieldValue.increment(-1)
      })
      batch.delete(saveDoc.ref)
      batchSize += 2
      await commitBatchIfFull()
    }

    // F. Cleanup my savedPosts subcollection (already fetched mySavesSnapshot for counts)
    for (const spDoc of savedPostsSnapshot.docs) {
      batch.delete(spDoc.ref)
      batchSize++
      await commitBatchIfFull()
    }

    // G. Cleanup my likes (decrement likeCount for Target Post)
    for (const likeDoc of myLikesSnapshot.docs) {
      const targetPostId = likeDoc.data().postId
      batch.update(adminDb.collection("posts").doc(targetPostId), {
        likeCount: FieldValue.increment(-1)
      })
      batch.delete(likeDoc.ref)
      batchSize += 2
      await commitBatchIfFull()
    }

    // H. Cleanup my comment likes (decrement likeCount for Comment)
    for (const clDoc of myCommentLikesSnapshot.docs) {
      const { postId, commentId } = clDoc.data()
      batch.update(adminDb.collection("posts").doc(postId).collection("comments").doc(commentId), {
        likeCount: FieldValue.increment(-1)
      })
      batch.delete(clDoc.ref)
      batchSize += 2
      await commitBatchIfFull()
    }

    // I. Cleanup my comments
    for (const commentDoc of myCommentsSnapshot.docs) {
      // No need to decrement commentCount as it is calculated on the fly in lib/posts.ts
      
      // Also cleanup commentLikes for these comments
      const clSnapshot = await adminDb.collection("commentLikes").where("commentId", "==", commentDoc.id).get()
      for (const clDoc of clSnapshot.docs) {
        batch.delete(clDoc.ref)
        batchSize++
        await commitBatchIfFull()
      }

      batch.delete(commentDoc.ref)
      batchSize++
      await commitBatchIfFull()
    }

    // J. Cleanup follows collection
    const allFollows = [...followsASnapshot.docs, ...followsBSnapshot.docs]
    for (const fDoc of allFollows) {
      batch.delete(fDoc.ref)
      batchSize++
      await commitBatchIfFull()
    }

    // K. Final Deletions
    batch.delete(adminDb.collection("users").doc(uid))
    batchSize++
    
    await batch.commit()

    // L. Cleanup Storage (Post images)
    for (const postDoc of postsSnapshot.docs) {
      try {
        // This deletes all files within the posts/POST_ID folder
        await bucket.deleteFiles({ prefix: `posts/${postDoc.id}/` });
      } catch (err) {
        console.error(`Failed to delete storage for post ${postDoc.id}:`, err);
        // Continue with other deletions even if one fails
      }
    }

    // M. Cleanup Storage (Avatar)
    try {
      // This deletes the user's avatar folder
      await bucket.deleteFiles({ prefix: `avatars/${uid}/` });
    } catch (err) {
      console.error(`Failed to delete avatar storage for user ${uid}:`, err);
    }

    // N. Final Auth Deletion
    try {
      await adminAuth.deleteUser(uid);
    } catch (err) {
      console.error(`Failed to delete auth user ${uid}:`, err);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    console.error("Delete account error:", error)
    return new Response(JSON.stringify({ error: "Failed to delete account" }), { status: 500 })
  }
}