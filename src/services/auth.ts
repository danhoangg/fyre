import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
} from "firebase/auth"
import { auth } from "@/lib/firebase"

export const signUp = (email: string, password: string) =>
    createUserWithEmailAndPassword(auth, email, password)

export const signIn = (email: string, password: string) =>
    signInWithEmailAndPassword(auth, email, password)

export const logOut = () => signOut(auth)
