"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { DecodedIdToken } from "firebase-admin/auth"

type AuthContextType = {
  user: DecodedIdToken | null
  email: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  email: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DecodedIdToken | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/session', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          const currentUser = data.user as DecodedIdToken | null
          if (currentUser) {
            setUser(currentUser)
            setEmail(currentUser.email || null)
          } else {
            setUser(null)
            setEmail(null)
          }
        } else {
          setUser(null)
          setEmail(null)
        }
      } catch (e) {
        setUser(null)
        setEmail(null)
      }
      setLoading(false)
    }

    fetchUser()
  }, [])

  return (
    <AuthContext.Provider value={{ user, email, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
