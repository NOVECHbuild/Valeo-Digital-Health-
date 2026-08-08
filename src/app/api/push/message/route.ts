// Fire-and-forget web push when a chat message is sent. Non-PHI body only.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit } from "@/lib/rateLimit";
import { sendPushToUser } from "@/lib/pushServer";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.valeoexperience.com";

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    if (!rateLimit(`push-msg:${gate.uid}`, 60, 60_000)) {
      return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
    }

    const { conversationId } = await req.json();
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const convSnap = await adminDb.collection("conversations").doc(conversationId).get();
    if (!convSnap.exists) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    const conv = convSnap.data()!;

    if (gate.uid !== conv.clientId && gate.uid !== conv.doctorId && gate.role !== "admin") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const senderIsClient = gate.uid === conv.clientId;
    const recipientId = senderIsClient ? conv.doctorId : conv.clientId;
    if (!recipientId) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const senderName = senderIsClient
      ? (conv.clientName || "Your client")
      : (conv.doctorName || "Your therapist");

    const url = senderIsClient
      ? `${APP_URL}/doctor/messages`
      : `${APP_URL}/client/messages`;

    const push = await sendPushToUser(recipientId, {
      title: "New message",
      body: senderIsClient
        ? `New message from ${senderName}`
        : "New message from your therapist",
      url,
      prefKey: "pushMessages",
    });

    return NextResponse.json({ ok: true, push });
  } catch (err: any) {
    console.warn("[push/message]", err?.message || err);
    return NextResponse.json({ ok: true, skipped: true });
  }
}
