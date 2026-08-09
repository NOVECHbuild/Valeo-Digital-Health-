// Stamp peer messages as read + clear conversation unread for the caller.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { conversationId } = await req.json().catch(() => ({}));
    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const convRef = adminDb.collection("conversations").doc(conversationId);
    const convSnap = await convRef.get();
    if (!convSnap.exists) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    const conv = convSnap.data()!;

    const isClient = gate.uid === conv.clientId;
    const isDoctor = gate.uid === conv.doctorId;
    if (!isClient && !isDoctor && gate.role !== "admin") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    // Client reading → stamp doctor messages; doctor reading → stamp client messages
    const role: "client" | "doctor" = isClient ? "client" : "doctor";
    const peerRole = role === "client" ? "doctor" : "client";
    const readField = role === "client" ? "readByClient" : "readByDoctor";
    const unreadField = role === "client" ? "unreadClient" : "unreadDoctor";

    const msgSnap = await convRef.collection("messages")
      .orderBy("createdAt", "desc")
      .limit(80)
      .get();

    const batch = adminDb.batch();
    let stamped = 0;
    for (const docSnap of msgSnap.docs) {
      const data = docSnap.data();
      if (data.senderRole !== peerRole) continue;
      if (data[readField] === true) continue;
      batch.update(docSnap.ref, {
        [readField]: true,
        read: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
      stamped++;
    }

    batch.update(convRef, {
      [unreadField]: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return NextResponse.json({ ok: true, stamped });
  } catch (err) {
    console.error("[messages/mark-read]", err);
    return NextResponse.json({ error: "Could not mark read." }, { status: 500 });
  }
}
