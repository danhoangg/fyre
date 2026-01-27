import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"

export const signUp = async (username: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Check if username is already taken
    const res = await fetch("/api/auth/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Username is already taken");
    }

    // Create a user document in Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
        username,
        email,
        createdAt: serverTimestamp(),
        avatarURL: null,
        followers: [],
        following: [],
        description: ""
    });

    // Create session cookie
    const idToken = await cred.user.getIdToken()
    await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
    })
}

export const signIn = async (usernameOrEmail: string, password: string) => {
    let email = usernameOrEmail

    // Check if input is a username (doesn't contain @)
    if (!usernameOrEmail.includes("@")) {
        // Call API to look up email by username
        const lookupRes = await fetch("/api/auth/lookup-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: usernameOrEmail }),
        })

        if (!lookupRes.ok) {
            const data = await lookupRes.json()
            throw new Error(data.error || "Username not found")
        }

        const { email: foundEmail } = await lookupRes.json()
        email = foundEmail
    }

    // Sign in with email and password
    const cred = await signInWithEmailAndPassword(auth, email, password)

    // Create session cookie
    const idToken = await cred.user.getIdToken()
    const sessionRes = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
        credentials: "include",
    })

    if (!sessionRes.ok) {
        throw new Error("Failed to create session")
    }
}

export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);

    // Check if user document exists, if not create one
    const userDocRef = doc(db, "users", cred.user.uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
        await setDoc(userDocRef, {
            username: cred.user.displayName,
            email: cred.user.email,
            createdAt: serverTimestamp(),
            avatarURL: cred.user.photoURL || null,
            followers: [],
            following: [],
            description: ""
        });
    }

    // Create session cookie
    const idToken = await cred.user.getIdToken()
    await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
    })
}

export const logOut = () => {
    signOut(auth)
    return fetch("/api/session/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    })
}
