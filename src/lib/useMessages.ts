// src/lib/useMessages.ts
// Real-time messaging hook using Firestore onSnapshot
// Data model:
//   conversations/{conversationId}
//     - clientId, doctorId, clientName, doctorName
//     - lastMessage, lastMessageAt, lastSenderId
//     - unreadClient (int), unreadDoctor (int)
//     - createdAt
//
//   conversations/{conversationId}/messages/{messageId}
//     - senderId, senderName, senderRole
//     - clientId, doctorId (denormalized for secure list rules)
//     - text, createdAt, read

import { useEffect, useState } from "react";
import {
  collection, query, where, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp,
  getDocs, getDoc, setDoc, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Cap history so opening a thread stays snappy on mobile. */
const MESSAGE_PAGE_SIZE = 80;

export interface Conversation {
  id:            string;
  clientId:      string;
  doctorId:      string;
  clientName:    string;
  doctorName:    string;
  lastMessage:   string;
  lastMessageAt: any;
  lastSenderId:  string;
  unreadClient:  number;
  unreadDoctor:  number;
  createdAt:            any;
  doctorSpecialization?: string;
}

export interface Message {
  id:         string;
  senderId:   string;
  senderName: string;
  senderRole: "client" | "doctor";
  text:       string;
  createdAt:  any;
  read:       boolean;
  clientId?:  string;
  doctorId?:  string;
}

function mapMessageDocs(docs: { id: string; data: () => Record<string, unknown> }[]): Message[] {
  return docs
    .map(d => ({ id: d.id, ...d.data() }) as Message)
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const tb = b.createdAt?.toMillis?.() ?? (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return ta - tb;
    });
}

// ── Get or create a conversation between client and doctor ─────────────────
export async function getOrCreateConversation(
  clientId:   string,
  clientName: string,
  doctorId:   string,
  doctorName: string,
): Promise<string> {
  const q = query(
    collection(db, "conversations"),
    where("clientId", "==", clientId),
    where("doctorId", "==", doctorId),
  );
  const snap = await getDocs(q);
  if (!snap.empty) return snap.docs[0].id;

  const ref = doc(collection(db, "conversations"));
  await setDoc(ref, {
    clientId,
    clientName,
    doctorId,
    doctorName,
    lastMessage:   "",
    lastMessageAt: serverTimestamp(),
    lastSenderId:  "",
    unreadClient:  0,
    unreadDoctor:  0,
    createdAt:     serverTimestamp(),
  });
  return ref.id;
}

// ── Send a message ─────────────────────────────────────────────────────────
export async function sendMessage(
  conversationId: string,
  senderId:       string,
  senderName:     string,
  senderRole:     "client" | "doctor",
  text:           string,
) {
  const trimmed = text.trim();
  if (!trimmed) return;

  // Denormalize participants onto each message so list rules can authorize
  // without a get() that some clients reject as an unsafe query.
  const convSnap = await getDoc(doc(db, "conversations", conversationId));
  const conv     = convSnap.data();
  if (!conv) throw new Error("Conversation not found");

  await addDoc(
    collection(db, "conversations", conversationId, "messages"),
    {
      senderId,
      senderName,
      senderRole,
      clientId:  conv.clientId,
      doctorId:  conv.doctorId,
      text:      trimmed,
      createdAt: serverTimestamp(),
      read:      false,
    }
  );

  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage:   trimmed,
    lastMessageAt: serverTimestamp(),
    lastSenderId:  senderId,
    ...(senderRole === "client"
      ? { unreadDoctor: increment(1) }
      : { unreadClient: increment(1) }),
  });

  // Web push to the other participant (non-PHI). Fire-and-forget.
  try {
    const { authedFetch } = await import("@/lib/authedFetch");
    void authedFetch("/api/push/message", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ conversationId }),
    }).catch(() => {});
  } catch { /* ignore */ }
}

// ── Mark conversation as read for a role ──────────────────────────────────
export async function markRead(conversationId: string, role: "client" | "doctor") {
  await updateDoc(doc(db, "conversations", conversationId), {
    ...(role === "client" ? { unreadClient: 0 } : { unreadDoctor: 0 }),
  });
}

// ── Hook: live list of conversations ──────────────────────────────────────
export function useConversations(userId: string, role: "client" | "doctor") {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const field = role === "client" ? "clientId" : "doctorId";
    const q = query(
      collection(db, "conversations"),
      where(field, "==", userId),
      orderBy("lastMessageAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Conversation));
        setLoading(false);
      },
      err => {
        console.error("[useConversations]", err);
        setConversations([]);
        setLoading(false);
      },
    );
    return unsub;
  }, [userId, role]);

  return { conversations, loading };
}

// ── Hook: live total unread message count for a user ──────────────────────
export function useUnreadCount(userId: string, role: "client" | "doctor") {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) { setCount(0); return; }
    const field = role === "client" ? "clientId" : "doctorId";
    const q = query(collection(db, "conversations"), where(field, "==", userId));
    const unsub = onSnapshot(
      q,
      snap => {
        let total = 0;
        snap.docs.forEach(d => {
          const data = d.data() as any;
          total += (role === "client" ? data.unreadClient : data.unreadDoctor) || 0;
        });
        setCount(total);
      },
      () => setCount(0),
    );
    return unsub;
  }, [userId, role]);

  return count;
}

// ── Hook: live messages in a conversation ─────────────────────────────────
export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    // Clear immediately so we never flash the previous thread's content
    setMessages([]);

    const col = collection(db, "conversations", conversationId, "messages");
    // Prefer newest N messages (fast path). Fall back if orderBy/index fails.
    const q = query(col, orderBy("createdAt", "desc"), limit(MESSAGE_PAGE_SIZE));

    let activeUnsub: (() => void) | undefined;

    activeUnsub = onSnapshot(
      q,
      snap => {
        // Fetched newest-first → mapMessageDocs sorts oldest→newest for the UI
        setMessages(mapMessageDocs(snap.docs));
        setLoading(false);
        setError(null);
      },
      err => {
        console.warn("[useMessages] ordered query failed, falling back:", err?.message || err);
        activeUnsub?.();
        activeUnsub = onSnapshot(
          col,
          snap => {
            const all = mapMessageDocs(snap.docs);
            setMessages(all.length > MESSAGE_PAGE_SIZE ? all.slice(-MESSAGE_PAGE_SIZE) : all);
            setLoading(false);
            setError(null);
          },
          err2 => {
            console.error("[useMessages]", err2);
            setMessages([]);
            setLoading(false);
            setError("Could not load messages. Please refresh.");
          },
        );
      },
    );

    return () => { activeUnsub?.(); };
  }, [conversationId]);

  return { messages, loading, error };
}
