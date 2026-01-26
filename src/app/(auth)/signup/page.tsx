"use client"

import { useState } from "react"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState("")

  const signup = async () => {
    try {
      // 1. Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password)

      // 2. Create Firestore user document
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email,
        username,
        createdAt: serverTimestamp(),
      })

      // 3. Create session cookie
      const idToken = await cred.user.getIdToken()
      await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div>
      <input placeholder="username" onChange={e => setUsername(e.target.value)} />
      <input placeholder="email" onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="password" onChange={e => setPassword(e.target.value)} />
      <button onClick={signup}>Sign up</button>
      {error}
    </div>
  )
}