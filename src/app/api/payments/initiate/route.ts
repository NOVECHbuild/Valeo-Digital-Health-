import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const WIPAY_ACCOUNT_NUMBER = process.env.WIPAY_ACCOUNT_NUMBER ?? "";
const WIPAY_API_KEY        = process.env.WIPAY_API_KEY        ?? "";
const WIPAY_ENVIRONMENT    = process.env.WIPAY_ENVIRONMENT    ?? "live";
const WIPAY_GATEWAY_URL    = process.env.WIPAY_GATEWAY_URL ?? "https://bb.wipayfinancial.com/v1/gateway";
const APP_URL              = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.valeoexperience.com";

const SESSION_PRICES: Record<string, number> = {
  "Individual Therapy": 400,
  "Couples Therapy":    600,
  "Life Coaching":      350,
  "Workplace Wellness": 500,
  "Free Consultation":  0,
};

// ── POST /api/payments/initiate ───────────────────────────────────────────────
// Creates a Firestore payment record, then returns WiPay form params so the
// CLIENT can POST a form directly to WiPay's gateway (browser redirect flow).
// WiPay does NOT return a JSON redirect URL — it returns the checkout page HTML.
// The correct integration is a direct browser form POST to their gateway.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[Initiate] Body:", JSON.stringify(body));

    const { appointmentId, clientId, clientName, clientEmail, sessionType } = body ?? {};

    const missing: string[] = [];
    if (!appointmentId) missing.push("appointmentId");
    if (!clientId)      missing.push("clientId");
    if (!sessionType)   missing.push("sessionType");

    if (missing.length > 0) {
      console.error("[Initiate] Missing fields:", missing);
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    if (!WIPAY_ACCOUNT_NUMBER || !WIPAY_API_KEY) {
      console.error("[Initiate] WiPay env vars not set");
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
    }

    // Resolve the charge from THIS doctor's own pricing (server-authoritative —
    // never trust a client-supplied amount). Falls back to the static map.
    // NOTE: only the amount *source* changed here; the WiPay form + hash below
    // are untouched.
    let amount = SESSION_PRICES[sessionType as string] ?? 400;
    try {
      const apptSnap = await adminDb.collection("appointments").doc(appointmentId).get();
      const doctorId = apptSnap.data()?.doctorId as string | undefined;
      if (doctorId) {
        const schedSnap = await adminDb.collection("schedules").doc(doctorId).get();
        const sched     = schedSnap.data();
        // Prefer the doctor's services list (matched by name), then legacy sessionPricing.
        const svc = (sched?.services as any[] | undefined)?.find(s => s?.name === sessionType);
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

    // ── Free consultation — approve directly, no payment needed ──────────────
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

    // ── Create pending Firestore payment record ───────────────────────────────
    const paymentRef = await adminDb.collection("payments").add({
      appointmentId,
      clientId,
      clientName:  clientName  ?? "Client",
      clientEmail: clientEmail ?? "",
      sessionType,
      amount,
      currency:  "TTD",
      status:    "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log("[Initiate] Payment record created:", paymentRef.id);

    // ── Return WiPay form params for client-side form POST ────────────────────
    // WiPay uses a browser form POST (not a server-to-server JSON API).
    // The client will build a hidden <form> and submit it directly to WiPay.
    return NextResponse.json({
      formAction: WIPAY_GATEWAY_URL,
      formFields: {
        account_number: WIPAY_ACCOUNT_NUMBER,
        ...(WIPAY_API_KEY ? { api_key: WIPAY_API_KEY } : {}),
        avs:            "0",
        data_override:  "0",
        environment:    WIPAY_ENVIRONMENT,
        fee_structure:  "merchant_absorb",
        method:         "credit_card",
        order_id:       paymentRef.id,
        origin:         "Valeo Experience",
        return_url:     `${APP_URL}/payment/callback`,
        total:          amount.toFixed(2),
        name:           clientName  ?? "Client",
        email:          clientEmail ?? "",
      },
    });

  } catch (err) {
    console.error("[Initiate] Exception:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
