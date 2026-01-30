"use client"

import { createContext, useContext, useState, useEffect } from "react"

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

const UserContext = createContext<{
  user: User;
  setUser: (user: User) => void;
} | null>(null)

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
}

export function UserProvider({
  user: initialUser,
  children,
}: {
  user: User
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User>(initialUser);

  // Update local state if the prop changes (e.g. from router.refresh())
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  )
}
