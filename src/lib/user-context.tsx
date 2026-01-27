"use client"

import { createContext, useContext } from "react"

export type User = {
  uid: string
  username?: string
  email?: string | null
  avatarUrl?: string
  createdAt?: string // ISO string from Firestore Timestamp
  followers?: string[]
  following?: string[]
  liked?: string[]
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
