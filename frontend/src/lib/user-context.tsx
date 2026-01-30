"use client"

import { createContext, useContext } from "react"

export type User = {
  uid: string
  username?: string
  email?: string | null
  avatarUrl?: string
  createdAt?: string // ISO string from Firestore Timestamp
  following?: string[] // Array of uids the user is following
  followers?: string[] // Array of uids who follow the user
  followersCount?: number
  followingCount?: number
  liked?: string[] // Array of post ids the user has liked
  saved?: string[] // Array of post ids the user has saved
  description?: string

  // allow any additional Firestore fields to be present
  [key: string]: any
}

const UserContext = createContext<User | null>(null)

export function useUser() {
  return useContext(UserContext)!
}

export function UserProvider({
  user,
  children,
}: {
  user: User
  children: React.ReactNode
}) {
  return (
    <UserContext.Provider value={user}>
      {children}
    </UserContext.Provider>
  )
}
