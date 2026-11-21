/* Malaragam site settings.
   Nothing here is secret: the Supabase anon key and the Razorpay KEY ID are meant
   to be public. NEVER put the Razorpay key secret or the Supabase service-role key here.
   Those stay in Supabase Edge Function secrets. */
window.MALARAGAM_CONFIG = {
  // Keep false until Supabase and the three Edge Functions are connected and tested.
  // While false, the booking form works as a WhatsApp enquiry and nothing is charged.
  ONLINE_BOOKING: true,

  SUPABASE_URL: "https://kpbwndpgodcqcgudmike.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwYnduZHBnb2RjcWNndWRtaWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0OTk3MDQsImV4cCI6MjExMDA3NTcwNH0.RvPzNgJk5lml4zifKzn24Xogu_5PBM_B-zpqZcN6taM",

  // Shows a "Test mode" banner above the booking form. Set to false when Razorpay goes live.
  RAZORPAY_TEST_MODE: true,

  WHATSAPP_NUMBER: "917708896936",
  HOLD_MINUTES: 15,

  // Pricing (the server must recalculate these; the page only previews them).
  PRICE: { standard: 4000, kitchen: 5000, extraBed: 500 },
  EXTRA_BED_PER_NIGHT: true,   // assumption: ₹500 per bed for each 24 hours. Set false for once per stay.
  ADVANCE_PERCENT: 50,
  MAX_GUESTS: 6                // adults + children
};
