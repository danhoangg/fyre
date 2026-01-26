"use client"

import { getAnalytics, isSupported } from "firebase/analytics"
import { app } from "@/lib/firebase"

export async function initAnalytics() {
  if (typeof window === "undefined") return null

  const supported = await isSupported()
  if (!supported) return null

  return getAnalytics(app)
}