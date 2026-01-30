import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import * as admin from "firebase-admin"
import { getStorage } from "firebase-admin/storage"

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, "\n")
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

if (!getApps().length) {
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Firebase Admin credentials missing from environment variables!")
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    storageBucket,
  })
}

export const adminAuth = getAuth()

export const adminDb = admin.firestore()

export const bucket = getStorage().bucket(storageBucket)