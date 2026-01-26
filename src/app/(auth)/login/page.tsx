"use client"

import { useState } from "react"
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth"
import { auth } from "@/lib/firebase"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const loginEmail = async () => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      await createSession(cred.user)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const loginGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      await createSession(cred.user)
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div>
      <input placeholder="email" onChange={e => setEmail(e.target.value)} />
      <input placeholder="password" type="password" onChange={e => setPassword(e.target.value)} />
      <button onClick={loginEmail}>Login</button>
      <button onClick={loginGoogle}>Google</button>
      {error}
    </div>
  )
}

async function createSession(user: any) {
  const idToken = await user.getIdToken()
  await fetch("/api/session/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  })
}