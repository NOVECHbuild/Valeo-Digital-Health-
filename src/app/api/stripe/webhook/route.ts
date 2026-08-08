// Stripe webhook — marks payments completed and appointments approved.
// Configure in Stripe Dashboard (Test) on the SAME account as STRIPE_SECRET_KEY:
//   URL: https://www.valeoexperience.com/api/stripe/webhook
//   Events: checkout.session.completed, checkout.session.async_payment_succeeded,
//           checkout.session.async_payment_failed, checkout.session.expired
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { fulfillCheckout, markCheckoutFailed } from "@/lib/stripeFulfill";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Stripe webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[Stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (
          session.payment_status === "paid" ||
          session.payment_status === "no_payment_required"
        ) {
          await fulfillCheckout(session);
        }
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        await fulfillCheckout(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        await markCheckoutFailed(
          event.data.object as Stripe.Checkout.Session,
          event.type
        );
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[Stripe webhook] Handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
