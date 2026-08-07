// Stripe server client (SERVER ONLY).
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!_stripe) {
    // Uses the SDK's pinned API version for this package release.
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export function dollarsToCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}
