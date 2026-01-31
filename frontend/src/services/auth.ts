import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth"
import { auth, functions } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions"
// import Cookies from "js-cookie"

// Callable function references
const checkUsernameCallable = httpsCallable(functions, "checkUsername");
const lookupEmailCallable = httpsCallable(functions, "lookupEmail");
const createSessionCallable = httpsCallable(functions, "createSession");
const revokeSessionCallable = httpsCallable(functions, "revokeSession");

export const signUp = async (username: string, email: string, password: string) => {
    // No need to clear session cookie on client; server will overwrite
    
    // Check if username is already taken via Cloud function
    const { data: { available } } = await checkUsernameCallable({ username }) as { data: { available: boolean } };
    
    if (!available) {
        throw new Error("Username is already taken");
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);

        // Create session cookie via new API route
        const idToken = await cred.user.getIdToken();
        const res = await fetch("/api/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
        });
        if (!res.ok) {
            const { error } = await res.json();
            throw new Error(error || "Login failed: Could not establish session.");
        }
}

export const signIn = async (usernameOrEmail: string, password: string) => {
    // No need to clear session cookie on client; server will overwrite
    
    let email = usernameOrEmail

    // Check if input is a username (doesn't contain @)
    if (!usernameOrEmail.includes("@")) {
        // Call Cloud Function to look up email by username
        const { data: { email: foundEmail } } = await lookupEmailCallable({ username: usernameOrEmail }) as { data: { email: string } };
        email = foundEmail
    }

    // Sign in with email and password
    const cred = await signInWithEmailAndPassword(auth, email, password)

        // Create session cookie via new API route
        const idToken = await cred.user.getIdToken();
        const res = await fetch("/api/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
        });
        if (!res.ok) {
            const { error } = await res.json();
            throw new Error(error || "Login failed during session exchange.");
        }
}

export const signInWithGoogle = async () => {
    // No need to clear session cookie on client; server will overwrite
    
    const provider = new GoogleAuthProvider();
    // Sign in. The Firestore document will be created automatically 
    // by the syncUserRecord Auth trigger if it doesn't exist.
    const cred = await signInWithPopup(auth, provider);

        // Create session cookie via new API route
        const idToken = await cred.user.getIdToken();
        const res = await fetch("/api/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
        });
        if (!res.ok) {
            const { error } = await res.json();
            throw new Error(error || "Login failed during Google session exchange.");
        }
}

export const logOut = async () => {
    try {
        await revokeSessionCallable();
    } catch (error) {
        console.error("Error revoking session:", error);
    }
    
    await signOut(auth);
    // Remove session cookie via API route
    await fetch("/api/session", { method: "DELETE" });
}
