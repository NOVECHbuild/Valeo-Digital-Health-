import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth } from "@/lib/requireAuth";
import { dollarsToCents, getStripe } from "@/lib/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.valeoexperience.com";

const SESSION_PRICES: Record<string, number> = {
  "Individual Therapy": 400,
  "Couples Therapy":    600,
  "Life Coaching":      350,
  "Workplace Wellness": 500,
  "Free Consultation":  0,
};

// ── POST /api/payments/initiate ───────────────────────────────────────────────
// Creates a Firestore payment record + Stripe Checkout Session (hosted).
// Returns { checkoutUrl } for a browser redirect. Free sessions skip Stripe.
// WiPay routes remain in the repo but are unused by the client booking flow.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId, clientId, clientName, clientEmail, sessionType } = body ?? {};

    const missing: string[] = [];
    if (!appointmentId) missing.push("appointmentId");
    if (!clientId)      missing.push("clientId");
    if (!sessionType)   missing.push("sessionType");

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("[Initiate] STRIPE_SECRET_KEY not set");
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
    }

    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const ownerSnap = await adminDb.collection("appointments").doc(appointmentId).get();
    const ownerAppt = ownerSnap.data();
    if (!ownerAppt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    if (gate.role !== "admin" && gate.uid !== ownerAppt.clientId) {
      return NextResponse.json({ error: "Not authorized for this appointment." }, { status: 403 });
    }

    // Server-authoritative price from doctor's services / legacy pricing / static map
    let amount = SESSION_PRICES[sessionType as string] ?? 400;
    try {
      const doctorId = ownerAppt.doctorId as string | undefined;
      if (doctorId) {
        const schedSnap = await adminDb.collection("schedules").doc(doctorId).get();
        const sched     = schedSnap.data();
        const svc = (sched?.services as { name?: string; price?: number }[] | undefined)
          ?.find(s => s?.name === sessionType);
        if (svc && typeof svc.price === "number") {
          amount = svc.price;
        } else {
          const p = (sched?.sessionPricing as Record<string, number> | undefined)?.[sessionType as string];
          if (typeof p === "number") amount = p;
        }
      }
    } catch (e) {
      console.error("[Initiate] doctor pricing lookup failed, using default:", e);
    }

    // Prefer amount already stored on the appointment when present
    if (typeof ownerAppt.amount === "number" && ownerAppt.amount >= 0) {
      amount = ownerAppt.amount;
    }

    if (amount === 0) {
      await adminDb.collection("appointments").doc(appointmentId).update({
        status:    "approved",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({
        free:     true,
        redirect: `${APP_URL}/client/appointments?success=true&free=true`,
      });
    }

    const cents = dollarsToCents(amount);
    if (!Number.isFinite(cents) || cents < 50) {
      // Stripe minimum is $0.50 USD
      return NextResponse.json({ error: "Invalid session price for checkout." }, { status: 400 });
    }

    const paymentRef = await adminDb.collection("payments").add({
      appointmentId,
      clientId,
      clientName:  clientName  ?? "Client",
      clientEmail: clientEmail ?? "",
      doctorId:    ownerAppt.doctorId ?? "",
      sessionType,
      amount,
      currency:  "USD",
      provider:  "stripe",
      gateway:   "stripe",
      status:    "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: clientEmail || undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: cents,
              product_data: {
                name: sessionType,
                description: `Session with ${ownerAppt.doctorName || "your therapist"}`,
              },
            },
          },
        ],
        success_url:
          `${APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}` +
          `&appointment_id=${encodeURIComponent(appointmentId)}` +
          `&order_id=${encodeURIComponent(paymentRef.id)}`,
        cancel_url:
          `${APP_URL}/payment/failed?appointment_id=${encodeURIComponent(appointmentId)}`,
        client_reference_id: appointmentId,
        metadata: {
          appointmentId,
          paymentId: paymentRef.id,
          clientId,
          sessionType,
        },
      },
      { idempotencyKey: `checkout_${paymentRef.id}` }
    );

    if (!session.url) {
      await paymentRef.update({ status: "failed", updatedAt: FieldValue.serverTimestamp() });
      return NextResponse.json({ error: "Could not create Stripe checkout session." }, { status: 502 });
    }

    await paymentRef.update({
      stripeCheckoutSessionId: session.id,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("appointments").doc(appointmentId).update({
      paymentId: paymentRef.id,
      amount,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      paymentId:   paymentRef.id,
      sessionId:   session.id,
    });
  } catch (err) {
    console.error("[Initiate] Exception:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
