import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, type DocumentData, type DocumentReference } from "firebase-admin/firestore";
import { requireAuth } from "@/lib/requireAuth";
import { dollarsToCents, getStripe } from "@/lib/stripe";
import { notifySessionConfirmed } from "@/lib/sessionEmails";
import { expireUnpaidPaymentHolds } from "@/lib/expirePaymentHolds";
import { holdExpiresAt, PAYMENT_HOLD_MINUTES } from "@/lib/paymentStatus";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.valeoexperience.com";

const SESSION_PRICES: Record<string, number> = {
  "Individual Therapy": 400,
  "Couples Therapy":    600,
  "Life Coaching":      350,
  "Workplace Wellness": 500,
  "Free Consultation":  0,
};

type ApptTarget = { id: string; ref: DocumentReference; data: DocumentData };

function priceForSession(
  sessionType: string,
  sched: DocumentData | undefined,
  fallbackAmount?: number,
): number {
  if (typeof fallbackAmount === "number" && fallbackAmount >= 0) return fallbackAmount;
  const svc = (sched?.services as { name?: string; price?: number }[] | undefined)
    ?.find(s => s?.name === sessionType);
  if (svc && typeof svc.price === "number") return svc.price;
  const p = (sched?.sessionPricing as Record<string, number> | undefined)?.[sessionType];
  if (typeof p === "number") return p;
  return SESSION_PRICES[sessionType] ?? 400;
}

// ── POST /api/payments/initiate ───────────────────────────────────────────────
// Creates a Firestore payment record + Stripe Checkout Session (hosted).
// Pay-in-full: slot stays pending/unpaid until Checkout succeeds (or free confirm).
// Returns { checkoutUrl } for a browser redirect. Free sessions skip Stripe.
export async function POST(req: NextRequest) {
  try {
    try { await expireUnpaidPaymentHolds(); } catch { /* non-blocking */ }

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

    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const ownerSnap = await adminDb.collection("appointments").doc(appointmentId).get();
    const ownerAppt = ownerSnap.data();
    if (!ownerAppt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    if (gate.role !== "admin" && gate.uid !== ownerAppt.clientId) {
      return NextResponse.json({ error: "Not authorized for this appointment." }, { status: 403 });
    }

    if (ownerAppt.status === "cancelled" || ownerAppt.status === "rejected") {
      return NextResponse.json({ error: "This booking is no longer available." }, { status: 409 });
    }
    if (ownerAppt.paymentStatus === "paid" || ownerAppt.paymentStatus === "free") {
      return NextResponse.json({
        free:     ownerAppt.paymentStatus === "free",
        redirect: `${APP_URL}/client/appointments?success=true`,
      });
    }

    let sched: DocumentData | undefined;
    try {
      const doctorId = ownerAppt.doctorId as string | undefined;
      if (doctorId) {
        const schedSnap = await adminDb.collection("schedules").doc(doctorId).get();
        sched = schedSnap.data();
      }
    } catch (e) {
      console.error("[Initiate] doctor pricing lookup failed:", e);
    }

    const seriesId = ownerAppt.seriesId as string | undefined;
    let targets: ApptTarget[] = [{
      id: ownerSnap.id,
      ref: ownerSnap.ref,
      data: ownerAppt,
    }];

    if (seriesId) {
      const seriesSnap = await adminDb.collection("appointments")
        .where("seriesId", "==", seriesId)
        .where("clientId", "==", ownerAppt.clientId)
        .get();
      const pending = seriesSnap.docs
        .filter(d => {
          const s = d.data().status;
          return s === "pending" || s === "payment_failed";
        })
        .map(d => ({ id: d.id, ref: d.ref, data: d.data() }));
      if (pending.length > 0) targets = pending;
    }

    let amount = 0;
    for (const t of targets) {
      amount += priceForSession(
        (t.data.type as string) || sessionType,
        sched,
        typeof t.data.amount === "number" ? t.data.amount : undefined,
      );
    }

    const newExpiry = holdExpiresAt();
    const batchHold = adminDb.batch();
    for (const t of targets) {
      const unit = priceForSession(
        (t.data.type as string) || sessionType,
        sched,
        typeof t.data.amount === "number" ? t.data.amount : undefined,
      );
      batchHold.update(t.ref, {
        paymentStatus:        "unpaid",
        paymentHoldExpiresAt: newExpiry,
        amount:               unit,
        updatedAt:            FieldValue.serverTimestamp(),
      });
    }
    await batchHold.commit();

    if (amount === 0) {
      const batch = adminDb.batch();
      for (const t of targets) {
        batch.update(t.ref, {
          status:        "approved",
          paymentStatus: "free",
          updatedAt:     FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      for (const t of targets) {
        try {
          await notifySessionConfirmed(t.id);
        } catch (err) {
          console.error("[Initiate] free confirm notify:", err);
        }
      }
      return NextResponse.json({
        free:     true,
        redirect: `${APP_URL}/client/appointments?success=true&free=true`,
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("[Initiate] STRIPE_SECRET_KEY not set");
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
    }

    const cents = dollarsToCents(amount);
    if (!Number.isFinite(cents) || cents < 50) {
      return NextResponse.json({ error: "Invalid session price for checkout." }, { status: 400 });
    }

    const paymentRef = await adminDb.collection("payments").add({
      appointmentId,
      seriesId:             seriesId || null,
      seriesAppointmentIds: targets.map(t => t.id),
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
    const expiresAt = Math.floor(Date.now() / 1000) + PAYMENT_HOLD_MINUTES * 60;
    const sessionCount = targets.length;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: clientEmail || undefined,
        expires_at: expiresAt,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: cents,
              product_data: {
                name: sessionCount > 1
                  ? `${sessionType} × ${sessionCount} sessions`
                  : sessionType,
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
          seriesId: seriesId || "",
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

    const batchPay = adminDb.batch();
    for (const t of targets) {
      batchPay.update(t.ref, {
        paymentId: paymentRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batchPay.commit();

    return NextResponse.json({
      checkoutUrl: session.url,
      paymentId:   paymentRef.id,
      sessionId:   session.id,
      holdMinutes: PAYMENT_HOLD_MINUTES,
    });
  } catch (err) {
    console.error("[Initiate] Exception:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
