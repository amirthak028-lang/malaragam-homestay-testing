# Malaragam Homestay: updated website

Static site (HTML, CSS, JS). Open `index.html` to preview. Nothing here touches your live site or DNS.

## Files
- `index.html`: home page (hero door, home, rates, gallery, nearby, booking, contact)
- `reviews.html` + `reviews.js`: genuine, moderated guest reviews
- `config.js`: the only file you edit to connect Supabase and Razorpay
- `i18n.js`: Tamil translation (have a native speaker read it before launch)
- `app.js`: navigation, language, gallery, booking and payment flow
- `supabase/additions.sql`: availability function, hold expiry, reviews table
- `supabase/functions/verify-razorpay-payment/index.ts`: server-side signature check

## Safe publishing (existing site and domain stay untouched)
1. In Netlify, create a NEW site (drag this folder in, or deploy a new GitHub branch). Do not edit the existing site.
2. Test on the temporary `*.netlify.app` address.
3. Only when you are happy, move the custom domain to the new site yourself. Until then, do not change DNS.

## Turning on online booking (in this order)
1. Run `supabase/additions.sql` after checking the column names at the top.
2. Deploy `verify-razorpay-payment` (needs the secret `RAZORPAY_KEY_SECRET`).
3. Check that `create-booking` and `create-razorpay-order` match the contract below.
4. Fill `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `config.js`, set `ONLINE_BOOKING: true`.
5. Test with Razorpay test cards. A "Test mode" banner shows above the form. Set `RAZORPAY_TEST_MODE: false` when live.

Until step 4, the booking form is a WhatsApp enquiry and nothing is charged.

## Function contract the page expects
- `create-booking` ← `{check_in, check_out, adults, children, package: "standard"|"kitchen", extra_beds, guest_name, guest_phone, guest_email, notes}`
  → `{booking_id, booking_reference, total_amount, advance_amount, hold_expires_at}`. Must recalculate price, check capacity and dates, and return 409 if dates are taken.
- `create-razorpay-order` ← `{booking_id}` → `{order_id, amount, currency, key_id}` (amount in paise, from the stored advance).
- `verify-razorpay-payment` ← `{booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature}`

If your existing functions use different names, only `startPayment()` in `app.js` needs changing.

## Decisions I made that you should confirm
- Extra bed ₹500 is charged per bed for each night (`EXTRA_BED_PER_NIGHT` in `config.js`).
- Children count toward the 6-guest limit.
- Meals: the site says "Meals are not included in the tariff" (the old site said food on request).
- CCTV is not mentioned, as it was still unconfirmed.
- Balance 50% is paid directly to Malaragam (no time stated).

## Still to do
- Nearby place pop-ups show a Google map, a link to Google photos, and the place photo if you add one at `assets/places/<name>.jpg` (names: mayuranathar, parimala-ranganathar, vaitheeswaran, thiruvengadu, keezhaperumpallam, thirumanancheri, tharangambadi).
- Admin screen: bookings and reviews are managed in the Supabase dashboard for now.
- Add check-in and check-out times when decided.
