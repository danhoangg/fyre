import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth"
import { auth, functions } from "@/lib/firebase"
import { httpsCallable } from "firebase/functions"
import { setCookie, destroyCookie } from "nookies"

// Callable function references
const checkUsernameCallable = httpsCallable(functions, "checkUsername");
const lookupEmailCallable = httpsCallable(functions, "lookupEmail");
const createSessionCallable = httpsCallable(functions, "createSession");
const revokeSessionCallable = httpsCallable(functions, "revokeSession");

export const signUp = async (username: string, email: string, password: string) => {
    // Clear any existing session cookie before attempting to sign up
    destroyCookie(null, "session", { path: "/" });
    
    // Check if username is already taken via Cloud function
    const { data: { available } } = await checkUsernameCallable({ username }) as { data: { available: boolean } };
    
    if (!available) {
        throw new Error("Username is already taken");
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Create session cookie via serverless Cloud Function
    const idToken = await cred.user.getIdToken()
    try {
        const result = await createSessionCallable({ idToken });
        const { sessionCookie, maxAge } = result.data as { sessionCookie: string, maxAge: number };
        
        setCookie(null, "session", sessionCookie, {
            maxAge: maxAge,
            path: "/",
            secure: true, // Always true if deployed (usually HTTPS)
            sameSite: "lax",
        });
    } catch (error) {
        console.error("Failed to create session in Cloud Function:", error);
        throw new Error("Login failed: Could not establish session.");
    }
}

export const signIn = async (usernameOrEmail: string, password: string) => {
    // Clear any existing session cookie before attempting to sign in
    destroyCookie(null, "session", { path: "/" });
    
    let email = usernameOrEmail

    // Check if input is a username (doesn't contain @)
    if (!usernameOrEmail.includes("@")) {
        // Call Cloud Function to look up email by username
        const { data: { email: foundEmail } } = await lookupEmailCallable({ username: usernameOrEmail }) as { data: { email: string } };
        email = foundEmail
    }

    // Sign in with email and password
    const cred = await signInWithEmailAndPassword(auth, email, password)

    // Create session cookie
    const idToken = await cred.user.getIdToken()
    try {
        const result = await createSessionCallable({ idToken });
        const { sessionCookie, maxAge } = result.data as { sessionCookie: string, maxAge: number };
        
        setCookie(null, "session", sessionCookie, {
            maxAge: maxAge,
            path: "/",
            secure: true,
            sameSite: "lax",
        });
    } catch (error) {
        console.error("Failed to create session in signIn:", error);
        throw new Error("Login failed during session exchange.");
    }
}

export const signInWithGoogle = async () => {
    // Clear any existing session cookie before attempting to sign in
    destroyCookie(null, "session", { path: "/" });
    
    const provider = new GoogleAuthProvider();
    // Sign in. The Firestore document will be created automatically 
    // by the syncUserRecord Auth trigger if it doesn't exist.
    const cred = await signInWithPopup(auth, provider);

    // Create session cookie
    const idToken = await cred.user.getIdToken()
    try {
        const result = await createSessionCallable({ idToken });
        const { sessionCookie, maxAge } = result.data as { sessionCookie: string, maxAge: number };
        
        setCookie(null, "session", sessionCookie, {
            maxAge: maxAge,
            path: "/",
            secure: true,
            sameSite: "lax",
        });
    } catch (error) {
        console.error("Failed to create session in Google Login:", error);
        throw new Error("Login failed during Google session exchange.");
    }
}

export const logOut = async () => {
    try {
        await revokeSessionCallable();
    } catch (error) {
        console.error("Error revoking session:", error);
    }
    
    await signOut(auth);
    destroyCookie(null, "session", { path: "/" });
}
