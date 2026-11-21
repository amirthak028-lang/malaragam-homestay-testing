// Supabase Edge Function: verify-razorpay-payment
// Confirms a booking ONLY after the Razorpay signature checks out on the server.
//
// Secrets needed (Project Settings > Edge Functions > Secrets):
//   RAZORPAY_KEY_SECRET        (test secret now, live secret later)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
//
// ASSUMED table/column names (adjust to match your schema, see supabase/README.md):
//   payments: id, booking_id, razorpay_order_id, razorpay_payment_id, status
//   bookings: id, status ('pending_payment' | 'confirmed' | 'expired'), hold_expires_at
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*", // tighten to your domain(s) before going live
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function hmacHex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
  if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ error: "Missing payment details" }, 400);
  }

  const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!secret) return json({ error: "Server is not configured" }, 500);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // The order must belong to this booking (created earlier by create-razorpay-order).
  const { data: pay, error: payErr } = await db
    .from("payments").select("id, booking_id, status")
    .eq("razorpay_order_id", razorpay_order_id).eq("booking_id", booking_id).maybeSingle();
  if (payErr || !pay) return json({ error: "Order not found for this booking" }, 404);
  if (pay.status === "success") return json({ ok: true, already_confirmed: true });

  // Razorpay signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
  const expected = await hmacHex(secret, `${razorpay_order_id}|${razorpay_payment_id}`);
  if (!safeEqual(expected, razorpay_signature)) {
    await db.from("payments").update({ status: "failed", razorpay_payment_id }).eq("id", pay.id);
    return json({ error: "Payment signature could not be verified" }, 400);
  }

  const { data: bk } = await db.from("bookings").select("id, status, hold_expires_at").eq("id", booking_id).maybeSingle();
  if (!bk) return json({ error: "Booking not found" }, 404);

  // Money was taken but the 15-minute hold had already lapsed and been released.
  // Record the payment and flag it for manual handling (confirm if dates are still free, else refund).
  if (bk.status === "expired") {
    await db.from("payments").update({ status: "success", razorpay_payment_id }).eq("id", pay.id);
    return json({ error: "Your hold expired before payment completed. We will contact you or refund you." }, 409);
  }

  const { error: pErr } = await db.from("payments")
    .update({ status: "success", razorpay_payment_id }).eq("id", pay.id);
  if (pErr) return json({ error: "Could not record payment" }, 500);

  const { error: bErr } = await db.from("bookings")
    .update({ status: "confirmed" }).eq("id", booking_id).eq("status", "pending_payment");
  if (bErr) return json({ error: "Could not confirm booking" }, 500);

  return json({ ok: true, status: "confirmed" });
});
