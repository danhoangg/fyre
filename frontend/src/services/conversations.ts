import { db, auth, functions } from "@/lib/firebase";
import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    limit,
    documentId,
    updateDoc,
    orderBy,
    startAfter,
    Timestamp,
    onSnapshot,
    Unsubscribe,
    addDoc
} from "firebase/firestore";

export const getConversationById = async (
    conversationId: string,
    lastMessageId: string | null,
    pageLimit: number
) => {
    const conversationRef = doc(db, "conversations", conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (!conversationSnap.exists()) {
        throw new Error("Conversation not found");
    }

    const messagesRef = collection(db, "conversations", conversationId, "messages");
    let messagesQuery;

    if (lastMessageId) {
        // Get the last message document to use as cursor for pagination
        const lastMessageRef = doc(db, "conversations", conversationId, "messages", lastMessageId);
        const lastMessageSnap = await getDoc(lastMessageRef);
        
        if (!lastMessageSnap.exists()) {
            throw new Error("Last message not found");
        }

        messagesQuery = query(
            messagesRef,
            orderBy("createdAt", "desc"),
            startAfter(lastMessageSnap),
            limit(pageLimit)
        );
    } else {
        // First page - no cursor needed
        messagesQuery = query(
            messagesRef,
            orderBy("createdAt", "desc"),
            limit(pageLimit)
        );
    }

    const messagesSnap = await getDocs(messagesQuery);
    const messages = messagesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));

    return {
        conversation: {
            id: conversationSnap.id,
            ...conversationSnap.data(),
        },
        messages,
        hasMore: messagesSnap.docs.length === pageLimit,
        lastMessageId: messages.length > 0 ? messages[messages.length - 1].id : null,
    };
};

export interface Message {
    id: string;
    text: string;
    uid: string;
    createdAt: Timestamp | null;
    [key: string]: any;
}

export const subscribeToNewMessages = (
    conversationId: string,
    currentUserId: string,
    onNewMessage: (message: Message) => void,
    onError?: (error: Error) => void
): Unsubscribe => {
    if (!currentUserId) {
        console.error("User ID not provided - cannot subscribe to messages");
        onError?.(new Error("User not authenticated"));
        return () => {};
    }

    const messagesRef = collection(db, "conversations", conversationId, "messages");
    
    // Track subscription start time for client-side filtering
    const subscriptionStartTime = Timestamp.now();
    const seenMessageIds = new Set<string>();
    
    const messagesQuery = query(
        messagesRef,
        orderBy("createdAt", "desc"),
        limit(1)
    );

    const unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const messageId = change.doc.id;
                    
                    // Skip if we've already seen this message
                    if (seenMessageIds.has(messageId)) return;
                    
                    // Only emit messages created after subscription started
                    const createdAt = data.createdAt as Timestamp | null;
                    if (createdAt && createdAt.toMillis() > subscriptionStartTime.toMillis()) {
                        seenMessageIds.add(messageId);
                        const message: Message = {
                            id: messageId,
                            ...data,
                        } as Message;
                        onNewMessage(message);
                    }
                }
            });
        },
        (error) => {
            console.error("Error subscribing to messages:", error);
            onError?.(error);
        }
    );

    return unsubscribe;
};

/**
 * Send a message in a conversation.
 * Uses auth.currentUser to ensure the sender is the authenticated user.
 * 
 * @param conversationId - The conversation to send the message to
 * @param text - The message text
 * @returns The created message with its ID
 */
export const sendMessage = async (
    conversationId: string,
    text: string
): Promise<Message> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error("User not authenticated");
    }

    if (!text.trim()) {
        throw new Error("Message cannot be empty");
    }

    if (text.length > 2000) {
        throw new Error("Message exceeds maximum length of 2000 characters");
    }

    const uid = currentUser.uid;
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    
    const messageData = {
        text: text.trim(),
        uid: uid,
        createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(messagesRef, messageData);

    // Update conversation's lastMessage and updatedAt
    const conversationRef = doc(db, "conversations", conversationId);
    await updateDoc(conversationRef, {
        lastMessage: text.trim(),
        lastMessageUid: uid,
        updatedAt: serverTimestamp(),
    });

    return {
        id: docRef.id,
        ...messageData,
        createdAt: Timestamp.now(), 
    };
};
