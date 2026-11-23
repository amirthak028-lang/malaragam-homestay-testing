
(() => {
  'use strict';

  const CFG = window.MALARAGAM_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const loginView = $('loginView');
  const recoveryView = $('recoveryView');
  const dashboardView = $('dashboardView');
  const loginForm = $('loginForm');
  const recoveryForm = $('recoveryForm');
  const loginButton = $('loginButton');
  const resetPasswordButton = $('resetPasswordButton');
  const loginMessage = $('loginMessage');
  const recoveryMessage = $('recoveryMessage');
  const dashboardMessage = $('dashboardMessage');

  const recoveryMode =
    new URLSearchParams(window.location.search).get('mode') === 'recovery';

  if (!window.supabase || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
    loginMessage.textContent =
      'Admin login is not configured. Please contact the site administrator.';
    loginButton.disabled = true;
    return;
  }

  const client = window.supabase.createClient(
    CFG.SUPABASE_URL,
    CFG.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  let currentSection = 'overview';
  let reviewRows = [];
  let adminRows = [];
  let cancellationRows = [];

  const titles = {
    overview: 'Overview',
    bookings: 'Bookings',
    payments: 'Payments',
    guests: 'Guests',
    reviews: 'Reviews',
    cancellations: 'Cancellation requests',
    admins: 'Admin accounts'
  };

  const tableFor = {
    bookings: 'bookings',
    payments: 'payments',
    guests: 'guests',
    reviews: 'reviews',
    admins: 'admin_users'
  };

  function setLoginMessage(message, success = false) {
    loginMessage.textContent = message || '';
    loginMessage.classList.toggle('success', success);
  }

  function setRecoveryMessage(message, success = false) {
    recoveryMessage.textContent = message || '';
    recoveryMessage.classList.toggle('success', success);
  }

  function showLogin() {
    loginView.hidden = false;
    recoveryView.hidden = true;
    dashboardView.hidden = true;
  }

  function showRecovery() {
    loginView.hidden = true;
    recoveryView.hidden = false;
    dashboardView.hidden = true;
  }

  function showDashboard() {
    loginView.hidden = true;
    recoveryView.hidden = true;
    dashboardView.hidden = false;
  }

  function setDashboardMessage(message, error = false) {
    dashboardMessage.textContent = message || '';
    dashboardMessage.classList.toggle('error', error);
  }

  function safeText(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function displayValue(value, key) {
    const text = safeText(value);

    if (key === 'status') {
      return `<span class="status-pill ${String(value)
        .toLowerCase().replace(/[^a-z0-9_-]/g, '')}">${escapeHtml(text)}</span>`;
    }

    return escapeHtml(text);
  }

  function renderTable(container, rows) {
    if (!rows || !rows.length) {
      container.innerHTML =
        '<p class="muted">No records are available to display.</p>';
      return;
    }

    const keys = Object.keys(rows[0]);
    const shownKeys = keys.slice(0, 9);

    const head = shownKeys.map(key =>
      `<th>${escapeHtml(key.replaceAll('_', ' '))}</th>`
    ).join('');

    const body = rows.map(row =>
      `<tr>${shownKeys.map(key =>
        `<td>${displayValue(row[key], key)}</td>`
      ).join('')}</tr>`
    ).join('');

    container.innerHTML =
      `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  async function getAdmin(user) {
    const { data, error } = await client
      .from('admin_users')
      .select('user_id,full_name,role,is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new Error('Could not verify admin access. ' + error.message);
    }

    if (!data) {
      throw new Error(
        'This account is not registered as an active Malaragam administrator.'
      );
    }

    return data;
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }

  function statusLabel(status) {
    const labels = {
      pending_payment: 'Awaiting payment',
      pending_approval: 'Pending approval',
      confirmed: 'Confirmed',
      expired: 'Expired',
      cancelled: 'Cancelled',
      failed: 'Failed',
      refunded: 'Refunded'
    };
    return labels[status] || safeText(status);
  }

  function statusClass(status) {
    return String(status || 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
  }

  function renderRecentBookings(rows, guestNames) {
    const container = $('recentBookings');

    if (!rows.length) {
      container.innerHTML =
        '<p class="muted">No bookings have been recorded yet.</p>';
      return;
    }

    const body = rows.map(row => {
      const guest = guestNames.get(row.guest_id) || 'Guest';
      const guestCount =
        (Number(row.adults) || 0) + (Number(row.children) || 0);
      const amount = row.total_amount == null
        ? '—'
        : formatCurrency(row.total_amount);
      const status = row.status || 'unknown';

      return `<tr>
        <td><strong class="booking-reference">${escapeHtml(row.booking_reference || '—')}</strong></td>
        <td>${escapeHtml(guest)}</td>
        <td>${escapeHtml(formatDate(row.check_in))}</td>
        <td>${escapeHtml(formatDate(row.check_out))}</td>
        <td>${guestCount}</td>
        <td>${escapeHtml(row.package_type || '—')}</td>
        <td>${escapeHtml(amount)}</td>
        <td><span class="status-pill ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span></td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <table class="overview-table">
        <thead><tr>
          <th>Booking</th><th>Guest</th><th>Check-in</th><th>Check-out</th>
          <th>Guests</th><th>Package</th><th>Total</th><th>Status</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  async function loadOverview() {
    setDashboardMessage('Loading dashboard information…');

    const [bookingResult, guestCountResult, guestResult, paymentResult] =
      await Promise.all([
        client.from('bookings')
          .select('id,booking_reference,guest_id,check_in,check_out,adults,children,extra_beds,package_type,total_amount,advance_amount,balance_amount,status,created_at')
          .order('created_at', { ascending: false })
          .limit(1000),

        client.from('guests')
          .select('id', { count: 'exact', head: true }),

        client.from('guests')
          .select('id,full_name')
          .limit(1000),

        client.from('payments')
          .select('amount,status,payment_type,created_at')
          .limit(2000)
      ]);

    if (bookingResult.error) {
      throw new Error('Could not load bookings: ' + bookingResult.error.message);
    }
    if (guestCountResult.error) {
      throw new Error('Could not load guest records: ' + guestCountResult.error.message);
    }
    if (guestResult.error) {
      throw new Error('Could not load guest names: ' + guestResult.error.message);
    }
    if (paymentResult.error) {
      throw new Error('Could not load payment summary: ' + paymentResult.error.message);
    }

    const bookings = bookingResult.data || [];
    const guests = guestResult.data || [];
    const payments = paymentResult.data || [];
    const guestNames = new Map(
      guests.map(guest => [guest.id, guest.full_name])
    );

    const awaitingPayment = bookings.filter(row =>
      row.status === 'pending_payment'
    ).length;
    const confirmed = bookings.filter(row =>
      row.status === 'confirmed'
    ).length;
    const expired = bookings.filter(row =>
      row.status === 'expired'
    ).length;

    const successfulPayments = payments.filter(row =>
      row.status === 'success'
    );
    const successfulAdvanceTotal = successfulPayments.reduce(
      (sum, row) => sum + (Number(row.amount) || 0), 0
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const successfulThisMonth = successfulPayments.filter(row => {
      const createdAt = new Date(row.created_at);
      return !Number.isNaN(createdAt.getTime()) &&
        createdAt >= monthStart && createdAt < nextMonthStart;
    });
    const monthlyTotal = successfulThisMonth.reduce(
      (sum, row) => sum + (Number(row.amount) || 0), 0
    );

    $('statBookings').textContent = bookings.length >= 1000
      ? '1,000+' : bookings.length;
    $('statPending').textContent = awaitingPayment;
    $('statConfirmed').textContent = confirmed;
    $('statExpired').textContent = expired;
    $('statGuests').textContent = guestCountResult.count ?? '—';
    $('statAdvance').textContent = formatCurrency(successfulAdvanceTotal);
    $('statMonthPayments').textContent = formatCurrency(monthlyTotal);
    $('monthlyPaymentNote').textContent =
      `${successfulThisMonth.length} successful test payment${successfulThisMonth.length === 1 ? '' : 's'} recorded this month.`;

    renderRecentBookings(bookings.slice(0, 8), guestNames);

    setDashboardMessage('Dashboard data loaded from Supabase.');
  }


  let bookingRows = [];
  let guestById = new Map();
  let paymentByBookingId = new Map();
  let guestRows = [];
  let guestBookingsById = new Map();
  let guestPaymentsByBookingId = new Map();
  let paymentRows = [];
  let bookingById = new Map();

  function bookingStatusText(status) {
    return statusLabel(status);
  }

  function renderBookingManagement() {
    const search = ($('bookingSearch')?.value || '').trim().toLowerCase();
    const status = $('bookingStatusFilter')?.value || 'all';

    const filtered = bookingRows.filter(row => {
      const guest = guestById.get(row.guest_id) || {};
      const haystack = [
        row.booking_reference, guest.full_name, guest.mobile, guest.email
      ].join(' ').toLowerCase();

      return (!search || haystack.includes(search)) &&
        (status === 'all' || row.status === status);
    });

    $('bookingResultCount').textContent =
      `${filtered.length} of ${bookingRows.length} bookings`;

    if (!filtered.length) {
      $('tableContent').innerHTML =
        '<p class="muted booking-empty">No bookings match your search or filter.</p>';
      return;
    }

    const rows = filtered.map(row => {
      const guest = guestById.get(row.guest_id) || {};
      const guestCount = (Number(row.adults) || 0) + (Number(row.children) || 0);
      const payment = paymentByBookingId.get(row.id) || [];
      const paid = payment.filter(p => p.status === 'success')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const statusClassName = statusClass(row.status);
      return `<tr>
        <td><strong class="booking-reference">${escapeHtml(row.booking_reference || '—')}</strong></td>
        <td><strong>${escapeHtml(guest.full_name || 'Guest')}</strong><small class="booking-subline">${escapeHtml(guest.mobile || guest.email || 'Contact not available')}</small></td>
        <td>${escapeHtml(formatDate(row.check_in))}</td>
        <td>${escapeHtml(formatDate(row.check_out))}</td>
        <td>${guestCount}${Number(row.extra_beds) ? ` <small>+ ${Number(row.extra_beds)} bed${Number(row.extra_beds) === 1 ? '' : 's'}</small>` : ''}</td>
        <td>${escapeHtml(row.package_type || '—')}</td>
        <td>${escapeHtml(formatCurrency(row.total_amount))}</td>
        <td><span class="status-pill ${statusClassName}">${escapeHtml(bookingStatusText(row.status))}</span></td>
        <td><button type="button" class="text-button booking-view-button" data-booking-id="${escapeHtml(row.id)}">View details</button></td>
      </tr>`;
    }).join('');

    $('tableContent').innerHTML = `
      <table class="booking-management-table">
        <thead><tr>
          <th>Booking</th><th>Guest</th><th>Check-in</th><th>Check-out</th>
          <th>Guests</th><th>Package</th><th>Total</th><th>Status</th><th></th>
        </tr></thead><tbody>${rows}</tbody></table>`;
  }

  function detailRow(label, value) {
    return `<div class="booking-detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(safeText(value))}</strong></div>`;
  }

  function openBookingDetails(bookingId) {
    const row = bookingRows.find(item => item.id === bookingId);
    if (!row) return;
    const guest = guestById.get(row.guest_id) || {};
    const payments = paymentByBookingId.get(row.id) || [];
    const paid = payments.filter(p => p.status === 'success')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const successful = payments.filter(p => p.status === 'success').length;
    const pending = payments.filter(p => p.status === 'pending').length;
    const guestCount = (Number(row.adults) || 0) + (Number(row.children) || 0);

    $('bookingDetailTitle').textContent = row.booking_reference || 'Booking details';
    $('bookingDetailContent').innerHTML = `
      <div class="booking-detail-status"><span class="status-pill ${statusClass(row.status)}">${escapeHtml(bookingStatusText(row.status))}</span></div>
      <h3 class="booking-detail-section-title">Guest information</h3>
      <div class="booking-detail-grid">
        ${detailRow('Full name', guest.full_name)}
        ${detailRow('Mobile', guest.mobile)}
        ${detailRow('Email', guest.email)}
      </div>
      <h3 class="booking-detail-section-title">Stay details</h3>
      <div class="booking-detail-grid">
        ${detailRow('Check-in', formatDate(row.check_in))}
        ${detailRow('Check-out', formatDate(row.check_out))}
        ${detailRow('Adults', row.adults)}
        ${detailRow('Children', row.children)}
        ${detailRow('Extra beds', row.extra_beds)}
        ${detailRow('Total guests', guestCount)}
        ${detailRow('Package', row.package_type)}
        ${detailRow('Booking created', formatDate(row.created_at))}
      </div>
      <h3 class="booking-detail-section-title">Payment summary</h3>
      <div class="booking-detail-grid">
        ${detailRow('Total amount', formatCurrency(row.total_amount))}
        ${detailRow('Advance required', formatCurrency(row.advance_amount))}
        ${detailRow('Balance amount', formatCurrency(row.balance_amount))}
        ${detailRow('Successfully recorded', formatCurrency(paid))}
        ${detailRow('Successful payment records', successful)}
        ${detailRow('Pending payment attempts', pending)}
      </div>
      <h3 class="booking-detail-section-title">Special requests</h3>
      <p class="booking-special-requests">${escapeHtml(row.special_requests || 'No special requests recorded.')}</p>
      <p class="booking-internal-id">Booking ID: ${escapeHtml(row.id)}</p>`;
    $('bookingDetailModal').hidden = false;
    document.body.classList.add('modal-open');
  }

  function renderPaymentManagement() {
    const search = ($('paymentSearch')?.value || '').trim().toLowerCase();
    const status = $('paymentStatusFilter')?.value || 'all';
    const filtered = paymentRows.filter(payment => {
      const booking = bookingById.get(payment.booking_id) || {};
      const guest = guestById.get(booking.guest_id) || {};
      const haystack = [booking.booking_reference, guest.full_name, guest.mobile,
        guest.email, payment.razorpay_order_id, payment.razorpay_payment_id,
        payment.payment_type, payment.status].join(' ').toLowerCase();
      return (!search || haystack.includes(search)) &&
        (status === 'all' || payment.status === status);
    });
    $('paymentResultCount').textContent = `${filtered.length} of ${paymentRows.length} payments`;
    if (!filtered.length) {
      $('tableContent').innerHTML = '<p class="muted booking-empty">No payments match your search or filter.</p>';
      return;
    }
    const rows = filtered.map(payment => {
      const booking = bookingById.get(payment.booking_id) || {};
      const guest = guestById.get(booking.guest_id) || {};
      const statusClassName = statusClass(payment.status);
      const statusText = payment.status ? payment.status.charAt(0).toUpperCase() + payment.status.slice(1) : 'Unknown';
      return `<tr>
        <td><strong class="booking-reference">${escapeHtml(booking.booking_reference || 'Booking')}</strong></td>
        <td><strong>${escapeHtml(guest.full_name || 'Guest')}</strong><small class="booking-subline">${escapeHtml(guest.mobile || guest.email || 'Contact not available')}</small></td>
        <td>${escapeHtml(String(payment.payment_type || '—').replaceAll('_',' '))}</td>
        <td>${escapeHtml(formatCurrency(payment.amount))}</td>
        <td><span class="status-pill ${escapeHtml(statusClassName)}">${escapeHtml(statusText)}</span></td>
        <td>${escapeHtml(formatDate(payment.created_at))}</td>
        <td><button type="button" class="text-button booking-view-button" data-payment-id="${escapeHtml(payment.id)}">View details</button></td>
      </tr>`;
    }).join('');
    $('tableContent').innerHTML = `<table class="booking-management-table payment-management-table"><thead><tr>
      <th>Booking</th><th>Guest</th><th>Payment type</th><th>Amount</th><th>Status</th><th>Payment date</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }

  function openPaymentDetails(paymentId) {
    const payment = paymentRows.find(item => item.id === paymentId);
    if (!payment) return;
    const booking = bookingById.get(payment.booking_id) || {};
    const guest = guestById.get(booking.guest_id) || {};
    $('paymentDetailTitle').textContent = booking.booking_reference || 'Payment details';
    $('paymentDetailContent').innerHTML = `
      <div class="booking-detail-status"><span class="status-pill ${statusClass(payment.status)}">${escapeHtml(payment.status || 'Unknown')}</span></div>
      <h3 class="booking-detail-section-title">Guest and booking</h3>
      <div class="booking-detail-grid">
        ${detailRow('Guest name', guest.full_name)}
        ${detailRow('Mobile', guest.mobile)}
        ${detailRow('Email', guest.email)}
        ${detailRow('Booking reference', booking.booking_reference)}
      </div>
      <h3 class="booking-detail-section-title">Payment summary</h3>
      <div class="booking-detail-grid">
        ${detailRow('Amount', formatCurrency(payment.amount))}
        ${detailRow('Currency', payment.currency)}
        ${detailRow('Payment type', payment.payment_type)}
        ${detailRow('Status', payment.status)}
        ${detailRow('Payment date', payment.created_at ? new Date(payment.created_at).toLocaleString('en-IN') : '—')}
      </div>
      <h3 class="booking-detail-section-title">Razorpay references</h3>
      <div class="booking-detail-grid">
        ${detailRow('Razorpay order ID', payment.razorpay_order_id)}
        ${detailRow('Razorpay payment ID', payment.razorpay_payment_id)}
      </div>
      <p class="booking-internal-id">Payment record ID: ${escapeHtml(payment.id)}</p>`;
    $('paymentDetailModal').hidden = false;
    document.body.classList.add('modal-open');
  }

  function closePaymentDetails() {
    $('paymentDetailModal').hidden = true;
    document.body.classList.remove('modal-open');
  }

  async function loadPaymentsManagement() {
    $('tableHeading').textContent = 'Payment management';
    $('tableContent').innerHTML = '<p class="muted">Loading payment and booking details…</p>';
    $('paymentTools').hidden = false;
    const [paymentResult, bookingResult, guestResult] = await Promise.all([
      client.from('payments').select('id,booking_id,razorpay_order_id,razorpay_payment_id,amount,currency,payment_type,status,created_at').order('created_at', {ascending:false}).limit(1000),
      client.from('bookings').select('id,booking_reference,guest_id').limit(2000),
      client.from('guests').select('id,full_name,mobile,email').limit(3000)
    ]);
    if (paymentResult.error) throw new Error('Could not load payments: ' + paymentResult.error.message);
    if (bookingResult.error) throw new Error('Could not load related bookings: ' + bookingResult.error.message);
    if (guestResult.error) throw new Error('Could not load guest details: ' + guestResult.error.message);
    paymentRows = paymentResult.data || [];
    bookingById = new Map((bookingResult.data || []).map(row => [row.id,row]));
    guestById = new Map((guestResult.data || []).map(row => [row.id,row]));
    renderPaymentManagement();
    setDashboardMessage('Payment records and related booking details loaded.');
  }

  function renderGuestManagement() {
    const search = ($('guestSearch')?.value || '').trim().toLowerCase();
    const filtered = guestRows.filter(guest => {
      const bookings = guestBookingsById.get(guest.id) || [];
      const bookingRefs = bookings.map(row => row.booking_reference || '').join(' ');
      const haystack = [guest.full_name, guest.mobile, guest.email, bookingRefs].join(' ').toLowerCase();
      return !search || haystack.includes(search);
    });
    $('guestResultCount').textContent = `${filtered.length} of ${guestRows.length} guest records`;
    if (!filtered.length) {
      $('tableContent').innerHTML = '<p class="muted booking-empty">No guests match your search.</p>';
      return;
    }
    const rows = filtered.map(guest => {
      const bookings = guestBookingsById.get(guest.id) || [];
      const latest = bookings.slice().sort((a,b) => new Date(b.check_in) - new Date(a.check_in))[0];
      return `<tr>
        <td><strong>${escapeHtml(guest.full_name || 'Guest')}</strong></td>
        <td>${escapeHtml(guest.mobile || '—')}</td>
        <td>${escapeHtml(guest.email || '—')}</td>
        <td>${bookings.length}</td>
        <td>${escapeHtml(latest ? formatDate(latest.check_in) : '—')}</td>
        <td><button type="button" class="text-button booking-view-button" data-guest-id="${escapeHtml(guest.id)}">View details</button></td>
      </tr>`;
    }).join('');
    $('tableContent').innerHTML = `<table class="booking-management-table guest-management-table"><thead><tr>
      <th>Guest</th><th>Mobile</th><th>Email</th><th>Total bookings</th><th>Last check-in</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }

  function openGuestDetails(guestId) {
    const guest = guestRows.find(item => item.id === guestId);
    if (!guest) return;
    const bookings = (guestBookingsById.get(guestId) || []).slice()
      .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const bookingHistory = bookings.length ? `<div class="guest-history-list">${bookings.map(booking => {
      const payments = guestPaymentsByBookingId.get(booking.id) || [];
      const successful = payments.filter(payment => payment.status === 'success');
      const pending = payments.filter(payment => payment.status === 'pending');
      const paymentStatus = successful.length ? 'Payment successful' : pending.length ? 'Payment pending' : 'No successful payment';
      const paymentClass = successful.length ? 'success' : pending.length ? 'pending' : 'expired';
      return `<article class="guest-history-item">
        <div class="guest-history-heading"><strong>${escapeHtml(booking.booking_reference || 'Booking')}</strong><span class="status-pill ${statusClass(booking.status)}">${escapeHtml(statusLabel(booking.status))}</span></div>
        <p>${escapeHtml(formatDate(booking.check_in))} – ${escapeHtml(formatDate(booking.check_out))}</p>
        <div class="guest-history-meta"><span>${escapeHtml(booking.package_type || '—')}</span><strong>${escapeHtml(formatCurrency(booking.total_amount))}</strong></div>
        <small class="guest-payment-state ${paymentClass}">${escapeHtml(paymentStatus)}</small>
      </article>`;
    }).join('')}</div>` : '<p class="booking-special-requests">No booking history recorded for this guest.</p>';
    $('guestDetailTitle').textContent = guest.full_name || 'Guest details';
    $('guestDetailContent').innerHTML = `
      <h3 class="booking-detail-section-title">Contact information</h3>
      <div class="booking-detail-grid">
        ${detailRow('Full name', guest.full_name)}
        ${detailRow('Mobile', guest.mobile)}
        ${detailRow('Email', guest.email)}
        ${detailRow('Guest profile created', formatDate(guest.created_at))}
        ${detailRow('Total bookings', bookings.length)}
      </div>
      <h3 class="booking-detail-section-title">Booking history</h3>
      ${bookingHistory}
      <p class="booking-internal-id">Guest profile ID: ${escapeHtml(guest.id)}</p>`;
    $('guestDetailModal').hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeGuestDetails() {
    $('guestDetailModal').hidden = true;
    document.body.classList.remove('modal-open');
  }

  async function loadGuestsManagement() {
    $('tableHeading').textContent = 'Guest management';
    $('tableContent').innerHTML = '<p class="muted">Loading guest profiles and booking history…</p>';
    $('guestTools').hidden = false;
    const [guestResult, bookingResult, paymentResult] = await Promise.all([
      client.from('guests').select('id,full_name,mobile,email,created_at').order('created_at', {ascending:false}).limit(2000),
      client.from('bookings').select('id,booking_reference,guest_id,check_in,check_out,package_type,total_amount,status,created_at').order('created_at', {ascending:false}).limit(3000),
      client.from('payments').select('booking_id,status,amount,payment_type,created_at').limit(5000)
    ]);
    if (guestResult.error) throw new Error('Could not load guest profiles: ' + guestResult.error.message);
    if (bookingResult.error) throw new Error('Could not load guest booking history: ' + bookingResult.error.message);
    if (paymentResult.error) throw new Error('Could not load guest payment history: ' + paymentResult.error.message);
    guestRows = guestResult.data || [];
    guestBookingsById = new Map();
    (bookingResult.data || []).forEach(booking => {
      const list = guestBookingsById.get(booking.guest_id) || [];
      list.push(booking);
      guestBookingsById.set(booking.guest_id, list);
    });
    guestPaymentsByBookingId = new Map();
    (paymentResult.data || []).forEach(payment => {
      const list = guestPaymentsByBookingId.get(payment.booking_id) || [];
      list.push(payment);
      guestPaymentsByBookingId.set(payment.booking_id, list);
    });
    renderGuestManagement();
    setDashboardMessage('Guest profiles and related booking history loaded. Records are read-only.');
  }

  function closeBookingDetails() {
    $('bookingDetailModal').hidden = true;
    document.body.classList.remove('modal-open');
  }

  async function loadBookingsManagement() {
    $('tableHeading').textContent = 'Reservation management';
    $('tableContent').innerHTML = '<p class="muted">Loading bookings and guest details…</p>';
    $('bookingTools').hidden = false;

    const [bookingResult, guestResult, paymentResult] = await Promise.all([
      client.from('bookings')
        .select('id,booking_reference,guest_id,check_in,check_out,adults,children,extra_beds,package_type,total_amount,advance_amount,balance_amount,special_requests,status,created_at,payment_hold_expires_at')
        .order('created_at', { ascending: false }).limit(1000),
      client.from('guests')
        .select('id,full_name,mobile,email').limit(2000),
      client.from('payments')
        .select('booking_id,amount,status,payment_type,created_at').limit(3000)
    ]);

    if (bookingResult.error) throw new Error('Could not load bookings: ' + bookingResult.error.message);
    if (guestResult.error) throw new Error('Could not load guest details: ' + guestResult.error.message);
    if (paymentResult.error) throw new Error('Could not load payment details: ' + paymentResult.error.message);

    bookingRows = bookingResult.data || [];
    guestById = new Map((guestResult.data || []).map(g => [g.id, g]));
    paymentByBookingId = new Map();
    (paymentResult.data || []).forEach(payment => {
      const list = paymentByBookingId.get(payment.booking_id) || [];
      list.push(payment);
      paymentByBookingId.set(payment.booking_id, list);
    });

    renderBookingManagement();
    setDashboardMessage('Bookings and related guest/payment information loaded.');
  }

  function renderReviewManagement() {
    const query = $('reviewSearch').value.trim().toLowerCase();
    const status = $('reviewStatusFilter').value;
    const rows = reviewRows.filter(review => {
      const matchesStatus = status === 'all' || review.status === status;
      const haystack = `${review.guest_name || ''} ${review.review_text || ''}`.toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
    $('reviewResultCount').textContent = `${rows.length} review${rows.length === 1 ? '' : 's'}`;
    if (!rows.length) {
      $('tableContent').innerHTML = '<p class="muted booking-empty">No reviews match this filter.</p>';
      return;
    }
    $('tableContent').innerHTML = `<div class="review-admin-list">${rows.map(review => {
      const statusClass = ['pending','approved','rejected'].includes(review.status) ? review.status : 'unknown';
      const stars = '★'.repeat(Math.max(0, Math.min(5, Number(review.rating) || 0))) + '☆'.repeat(5 - Math.max(0, Math.min(5, Number(review.rating) || 0)));
      const actions = review.status === 'pending' ? `
        <div class="review-admin-actions">
          <button class="review-action approve" type="button" data-review-action="approved" data-review-id="${escapeHtml(review.id)}">Approve</button>
          <button class="review-action reject" type="button" data-review-action="rejected" data-review-id="${escapeHtml(review.id)}">Reject</button>
        </div>` : '<p class="review-admin-readonly">This review has already been moderated.</p>';
      return `<article class="review-admin-card">
        <div class="review-admin-top"><div><strong>${escapeHtml(review.guest_name || 'Guest')}</strong><span class="review-admin-date">${escapeHtml(formatDate(review.created_at))}</span></div>
        <span class="status-pill ${statusClass}">${escapeHtml(review.status || 'unknown')}</span></div>
        <div class="review-admin-rating" aria-label="${Number(review.rating) || 0} out of 5">${stars}</div>
        <p class="review-admin-text">${escapeHtml(review.review_text || '')}</p>
        <div class="review-admin-meta">${review.is_verified_guest ? '<span class="verified-label">✓ Verified guest</span>' : '<span>Not verified</span>'}
          <span>Review ID: ${escapeHtml(review.id)}</span></div>
        ${actions}
      </article>`;
    }).join('')}</div>`;
  }

  async function loadReviewManagement() {
    $('tableHeading').textContent = 'Guest review moderation';
    $('tableContent').innerHTML = '<p class="muted">Loading guest reviews…</p>';
    $('reviewTools').hidden = false;
    const { data, error } = await client.from('reviews')
      .select('id,booking_id,guest_name,rating,review_text,is_verified_guest,status,created_at')
      .order('created_at', { ascending: false }).limit(500);
    if (error) throw new Error('Could not load reviews: ' + error.message);
    reviewRows = data || [];
    renderReviewManagement();
    const pending = reviewRows.filter(row => row.status === 'pending').length;
    setDashboardMessage(`${reviewRows.length} review(s) loaded · ${pending} awaiting moderation. Changes are recorded through the secure review moderation function.`);
  }

  async function moderateReview(reviewId, action, button) {
    if (!['approved', 'rejected'].includes(action)) return;
    const label = action === 'approved' ? 'approve' : 'reject';
    if (!window.confirm(`Are you sure you want to ${label} this review?`)) return;
    button.disabled = true;
    button.textContent = action === 'approved' ? 'Approving…' : 'Rejecting…';
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your admin session has expired. Please sign in again.');
      const response = await fetch(`${CFG.SUPABASE_URL}/functions/v1/moderate-guest-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CFG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ review_id: reviewId, action })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not update this review.');
      setDashboardMessage(action === 'approved' ? 'Review approved. It can now appear on the public reviews page.' : 'Review rejected. It will remain hidden from the public reviews page.');
      await loadReviewManagement();
    } catch (error) {
      setDashboardMessage(error.message || 'Review moderation failed.', true);
      button.disabled = false;
      button.textContent = action === 'approved' ? 'Approve' : 'Reject';
    }
  }

  async function callAdminFunction(functionName, payload = {}) {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Your admin session has expired. Please sign in again.');

    const response = await fetch(`${CFG.SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CFG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `The ${functionName} request failed.`);
    return result;
  }

  function renderAdminManagement() {
    if (!adminRows.length) {
      $('tableContent').innerHTML = '<p class="muted booking-empty">No administrator accounts were returned.</p>';
      return;
    }

    const rows = adminRows.map(admin => {
      const isPrimary = admin.role === 'primary_admin';
      const active = admin.is_active === true;
      const actionButtons = isPrimary
        ? '<span class="admin-protected-label">Protected account</span>'
        : `<div class="admin-row-actions">
            <button type="button" class="secondary-button" data-admin-action="${active ? 'deactivate' : 'activate'}" data-admin-id="${escapeHtml(admin.user_id)}">${active ? 'Deactivate' : 'Activate'}</button>
            <button type="button" class="admin-delete-button" data-admin-action="delete" data-admin-id="${escapeHtml(admin.user_id)}">Delete</button>
          </div>`;
      return `<tr>
        <td><strong>${escapeHtml(admin.full_name || '—')}</strong></td>
        <td>${escapeHtml(admin.email || 'Email unavailable')}</td>
        <td>${isPrimary ? 'Primary Admin' : 'Manager'}</td>
        <td><span class="status-pill ${active ? 'approved' : 'rejected'}">${active ? 'Active' : 'Inactive'}</span></td>
        <td>${escapeHtml(formatDate(admin.created_at))}</td>
        <td>${actionButtons}</td>
      </tr>`;
    }).join('');

    $('tableContent').innerHTML = `<div class="table-wrap"><table class="admin-management-table">
      <thead><tr><th>Full name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  async function loadAdminManagement() {
    $('tableHeading').textContent = 'Admin accounts';
    $('adminTools').hidden = false;
    $('tableContent').innerHTML = '<p class="muted">Loading administrator accounts…</p>';
    const result = await callAdminFunction('list-admins');
    adminRows = Array.isArray(result.admins) ? result.admins : [];
    renderAdminManagement();
    setDashboardMessage(`${adminRows.length} administrator account(s) loaded. Only the Primary Admin can manage accounts.`);
  }

  async function submitManagerInvitation(event) {
    event.preventDefault();
    const button = $('adminInviteButton');
    const message = $('adminInviteMessage');
    const fullName = $('adminFullName').value.trim();
    const email = $('adminEmail').value.trim();
    message.textContent = '';
    message.classList.remove('error', 'success');
    button.disabled = true;
    button.textContent = 'Sending invitation…';

    try {
      const result = await callAdminFunction('create-admin', {
        full_name: fullName,
        email
      });
      message.textContent = result.message || 'Manager invitation sent.';
      message.classList.add('success');
      $('adminInviteForm').reset();
      await loadAdminManagement();
    } catch (error) {
      message.textContent = error.message || 'Could not invite this manager.';
      message.classList.add('error');
    } finally {
      button.disabled = false;
      button.textContent = 'Send manager invitation';
    }
  }

  async function manageManagerAccount(userId, action, button) {
    const labels = { activate: 'activate', deactivate: 'deactivate', delete: 'permanently delete' };
    if (!labels[action]) return;
    const warning = action === 'delete'
      ? 'This permanently removes the manager from the admin registry and Supabase Authentication. Continue?'
      : `Are you sure you want to ${labels[action]} this manager?`;
    if (!window.confirm(warning)) return;

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Please wait…';
    try {
      const result = await callAdminFunction('manage-admin', {
        user_id: userId,
        action
      });
      setDashboardMessage(result.message || 'Manager account updated.');
      await loadAdminManagement();
    } catch (error) {
      setDashboardMessage(error.message || 'Could not update this manager.', true);
      button.disabled = false;
      button.textContent = originalText;
    }
  }


  function renderCancellationManagement() {
    const search = ($('cancellationSearch')?.value || '').trim().toLowerCase();
    const status = $('cancellationStatusFilter')?.value || 'all';
    const filtered = cancellationRows.filter(item => {
      const booking = item.booking || {};
      const guest = item.guest || {};
      const haystack = [
        item.id, booking.booking_reference, guest.full_name,
        guest.email, guest.mobile, item.reason
      ].join(' ').toLowerCase();
      return (!search || haystack.includes(search)) &&
        (status === 'all' || item.status === status);
    });

    $('cancellationResultCount').textContent =
      `${filtered.length} of ${cancellationRows.length} requests`;

    if (!filtered.length) {
      $('tableContent').innerHTML =
        '<p class="muted booking-empty">No cancellation requests match your search or filter.</p>';
      return;
    }

    const rows = filtered.map(item => {
      const booking = item.booking || {};
      const guest = item.guest || {};
      const eligible = item.eligible_for_refund === true;
      return `<tr>
        <td><strong class="booking-reference">${escapeHtml(booking.booking_reference || '—')}</strong>
          <small class="booking-subline">${escapeHtml(item.id)}</small></td>
        <td><strong>${escapeHtml(guest.full_name || 'Guest')}</strong>
          <small class="booking-subline">${escapeHtml(guest.email || guest.mobile || 'Contact unavailable')}</small></td>
        <td>${escapeHtml(formatDate(booking.check_in))}</td>
        <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status || 'unknown')}</span></td>
        <td><span class="status-pill ${eligible ? 'approved' : 'rejected'}">${eligible ? 'Eligible' : 'Not eligible'}</span></td>
        <td><strong>${escapeHtml(formatCurrency(item.refund_amount))}</strong></td>
        <td>${escapeHtml(formatDate(item.requested_at))}</td>
      </tr>`;
    }).join('');

    $('tableContent').innerHTML = `
      <div class="cancellation-readonly-note">
        Requests are displayed for review. Approval, rejection and refunds must be performed by a secure server-side admin function.
      </div>
      <table class="booking-management-table cancellation-management-table">
        <thead><tr>
          <th>Booking / Request</th><th>Guest</th><th>Check-in</th>
          <th>Request status</th><th>Refund eligibility</th><th>Refund amount</th><th>Requested</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
  }

  async function loadCancellationManagement() {
    $('tableHeading').textContent = 'Cancellation requests';
    $('cancellationTools').hidden = false;
    $('tableContent').innerHTML = '<p class="muted">Loading cancellation requests…</p>';

    const { data: requests, error } = await client
      .from('booking_cancellation_requests')
      .select('id,booking_id,reason,status,requested_at,eligible_for_refund,refund_amount,policy_rule,admin_note,decision_at,refund_status')
      .order('requested_at', { ascending: false })
      .limit(500);

    if (error) throw new Error('Could not load cancellation requests: ' + error.message);

    const bookingIds = [...new Set((requests || []).map(row => row.booking_id).filter(Boolean))];
    let bookings = [];
    if (bookingIds.length) {
      const result = await client.from('bookings')
        .select('id,booking_reference,guest_id,check_in,check_out,status,advance_amount,total_amount')
        .in('id', bookingIds);
      if (result.error) throw new Error('Could not load cancellation booking details: ' + result.error.message);
      bookings = result.data || [];
    }

    const guestIds = [...new Set(bookings.map(row => row.guest_id).filter(Boolean))];
    let guests = [];
    if (guestIds.length) {
      const result = await client.from('guests')
        .select('id,full_name,email,mobile')
        .in('id', guestIds);
      if (result.error) throw new Error('Could not load cancellation guest details: ' + result.error.message);
      guests = result.data || [];
    }

    const bookingMap = new Map(bookings.map(row => [row.id, row]));
    const guestMap = new Map(guests.map(row => [row.id, row]));
    cancellationRows = (requests || []).map(row => {
      const booking = bookingMap.get(row.booking_id) || {};
      return { ...row, booking, guest: guestMap.get(booking.guest_id) || {} };
    });

    renderCancellationManagement();
    const pending = cancellationRows.filter(row => row.status === 'pending').length;
    setDashboardMessage(`${cancellationRows.length} cancellation request(s) loaded · ${pending} awaiting review.`);
  }

  async function loadTable(section) {
    if (section !== 'admins') $('adminTools').hidden = true;
    if (section !== 'cancellations') $('cancellationTools').hidden = true;
    if (section === 'cancellations') {
      $('bookingTools').hidden = true;
      $('paymentTools').hidden = true;
      $('guestTools').hidden = true;
      $('reviewTools').hidden = true;
      await loadCancellationManagement();
      return;
    }
    if (section === 'admins') {
      $('bookingTools').hidden = true;
      $('paymentTools').hidden = true;
      $('guestTools').hidden = true;
      $('reviewTools').hidden = true;
      await loadAdminManagement();
      return;
    }
    if (section === 'reviews') {
      $('bookingTools').hidden = true;
      $('paymentTools').hidden = true;
      $('guestTools').hidden = true;
      await loadReviewManagement();
      return;
    }
    $('reviewTools').hidden = true;
    if (section === 'bookings') {
      $('paymentTools').hidden = true;
      $('guestTools').hidden = true;
      await loadBookingsManagement();
      return;
    }
    if (section === 'payments') {
      $('bookingTools').hidden = true;
      $('guestTools').hidden = true;
      $('guestTools').hidden = true;
      await loadPaymentsManagement();
      return;
    }
    if (section === 'guests') {
      $('bookingTools').hidden = true;
      $('paymentTools').hidden = true;
      await loadGuestsManagement();
      return;
    }

    $('bookingTools').hidden = true;
    $('paymentTools').hidden = true;
    $('guestTools').hidden = true;
    const table = tableFor[section];

    $('tableHeading').textContent = titles[section];
    $('tableContent').innerHTML =
      '<p class="muted">Loading records…</p>';

    setDashboardMessage('');

    let query = client.from(table).select('*').limit(100);

    if (section === 'bookings' ||
        section === 'payments' ||
        section === 'guests' ||
        section === 'reviews') {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Could not load ${table}: ${error.message}`);
    }

    renderTable($('tableContent'), data || []);
  }

  async function openSection(section) {
    if (!titles[section]) return;

    currentSection = section;
    $('sectionTitle').textContent = titles[section];

    document.querySelectorAll('.nav-item').forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.section === section
      );
    });

    $('overviewSection').hidden = section !== 'overview';
    $('tableSection').hidden = section === 'overview';

    try {
      if (section === 'overview') {
        await loadOverview();
      } else {
        await loadTable(section);
      }
    } catch (error) {
      setDashboardMessage(error.message, true);

      if (section !== 'overview') {
        $('tableContent').innerHTML =
          `<p class="muted">${escapeHtml(error.message)}</p>`;
      }
    }
  }

  async function establishSession(session) {
    if (!session?.user) {
      showLogin();
      return;
    }

    try {
      const admin = await getAdmin(session.user);

      $('adminName').textContent =
        admin.full_name || session.user.email || 'Administrator';

      $('adminRole').textContent =
        admin.role === 'primary_admin'
          ? 'Primary Admin'
          : 'Administrator';

      $('adminsNav').hidden = admin.role !== 'primary_admin';

      showDashboard();
      await openSection('overview');

    } catch (error) {
      await client.auth.signOut();
      showLogin();
      setLoginMessage(error.message);
    }
  }

  // NORMAL ADMIN LOGIN
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    loginButton.disabled = true;
    loginButton.textContent = 'Signing in…';
    setLoginMessage('');

    try {
      const email = $('email').value.trim();
      const password = $('password').value;

      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await establishSession(data.session);

    } catch (error) {
      setLoginMessage(
        error.message || 'Unable to sign in. Please check your details.'
      );
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Sign in securely';
    }
  });

  // REQUEST PASSWORD RESET EMAIL
  $('forgotPasswordButton').addEventListener('click', async () => {
    const email = $('email').value.trim();

    if (!email) {
      setLoginMessage('Please enter your administrator email address first.');
      $('email').focus();
      return;
    }

    const button = $('forgotPasswordButton');
    button.disabled = true;
    button.textContent = 'Sending reset email…';
    setLoginMessage('');

    try {
      const redirectUrl = new URL(window.location.href);
      redirectUrl.search = '?mode=recovery';
      redirectUrl.hash = '';

      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl.toString()
      });

      if (error) throw error;

      setLoginMessage(
        'If an account exists for this email, a password reset link has been sent. Please check your inbox.',
        true
      );

    } catch (error) {
      setLoginMessage(
        error.message || 'Unable to send the password reset email.'
      );
    } finally {
      button.disabled = false;
      button.textContent = 'Forgot password?';
    }
  });

  // SAVE NEW PASSWORD AFTER OPENING RECOVERY LINK
  recoveryForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const password = $('newPassword').value;
    const confirmation = $('confirmPassword').value;

    if (password.length < 8) {
      setRecoveryMessage('Your password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmation) {
      setRecoveryMessage('The passwords do not match.');
      return;
    }

    resetPasswordButton.disabled = true;
    resetPasswordButton.textContent = 'Saving password…';
    setRecoveryMessage('');

    try {
      const { error } = await client.auth.updateUser({
        password: password
      });

      if (error) throw error;

      // Password updated. Sign out so the user can sign in normally.
      await client.auth.signOut();

      $('newPassword').value = '';
      $('confirmPassword').value = '';
      $('password').value = '';

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

      showLogin();

      setLoginMessage(
        'Your password has been updated successfully. Please sign in with your new password.',
        true
      );

    } catch (error) {
      setRecoveryMessage(
        error.message || 'Unable to update your password. Request a new reset link if it has expired.'
      );
    } finally {
      resetPasswordButton.disabled = false;
      resetPasswordButton.textContent = 'Save new password';
    }
  });

  // SHOW / HIDE PASSWORD
  $('togglePassword').addEventListener('click', () => {
    const field = $('password');
    const visible = field.type === 'password';

    field.type = visible ? 'text' : 'password';
    $('togglePassword').textContent = visible ? 'Hide' : 'Show';
    $('togglePassword').setAttribute(
      'aria-label',
      visible ? 'Hide password' : 'Show password'
    );
  });

  $('toggleNewPassword').addEventListener('click', () => {
    const field = $('newPassword');
    const visible = field.type === 'password';

    field.type = visible ? 'text' : 'password';
    $('toggleNewPassword').textContent = visible ? 'Hide' : 'Show';
  });

  // DASHBOARD NAVIGATION
  $('adminNav').addEventListener('click', event => {
    const button = event.target.closest('[data-section]');
    if (button) openSection(button.dataset.section);
  });

  document.querySelectorAll('[data-goto]').forEach(button => {
    button.addEventListener('click', () => {
      openSection(button.dataset.goto);
    });
  });

  $('refreshButton').addEventListener('click', () => {
    openSection(currentSection);
  });


  $('paymentSearch').addEventListener('input', renderPaymentManagement);
  $('paymentStatusFilter').addEventListener('change', renderPaymentManagement);
  $('guestSearch').addEventListener('input', renderGuestManagement);
  $('reviewSearch').addEventListener('input', renderReviewManagement);
  $('reviewStatusFilter').addEventListener('change', renderReviewManagement);
  $('cancellationSearch').addEventListener('input', renderCancellationManagement);
  $('cancellationStatusFilter').addEventListener('change', renderCancellationManagement);
  $('adminInviteForm').addEventListener('submit', submitManagerInvitation);
  $('bookingSearch').addEventListener('input', renderBookingManagement);
  $('bookingStatusFilter').addEventListener('change', renderBookingManagement);

  $('tableContent').addEventListener('click', event => {
    const reviewButton = event.target.closest('[data-review-action][data-review-id]');
    if (reviewButton) { moderateReview(reviewButton.dataset.reviewId, reviewButton.dataset.reviewAction, reviewButton); return; }
    const adminButton = event.target.closest('[data-admin-action][data-admin-id]');
    if (adminButton) { manageManagerAccount(adminButton.dataset.adminId, adminButton.dataset.adminAction, adminButton); return; }
    const paymentButton = event.target.closest('[data-payment-id]');
    if (paymentButton) { openPaymentDetails(paymentButton.dataset.paymentId); return; }
    const guestButton = event.target.closest('[data-guest-id]');
    if (guestButton) { openGuestDetails(guestButton.dataset.guestId); return; }
    const button = event.target.closest('[data-booking-id]');
    if (button) openBookingDetails(button.dataset.bookingId);
  });

  $('guestDetailModal').addEventListener('click', event => {
    if (event.target.closest('[data-close-guest]')) closeGuestDetails();
  });

  $('paymentDetailModal').addEventListener('click', event => {
    if (event.target.closest('[data-close-payment]')) closePaymentDetails();
  });

  $('bookingDetailModal').addEventListener('click', event => {
    if (event.target.closest('[data-close-booking]')) closeBookingDetails();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('bookingDetailModal').hidden) closeBookingDetails();
    if (event.key === 'Escape' && !$('paymentDetailModal').hidden) closePaymentDetails();
    if (event.key === 'Escape' && !$('guestDetailModal').hidden) closeGuestDetails();
  });

  // SIGN OUT
  $('signOutButton').addEventListener('click', async () => {
    await client.auth.signOut();

    $('password').value = '';
    showLogin();

    setLoginMessage('You have signed out.', true);
  });

  // AUTHENTICATION EVENTS
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showRecovery();
      setRecoveryMessage(
        'Reset link verified. You can now choose a new password.',
        true
      );
      return;
    }

    if (event === 'SIGNED_OUT') {
      showLogin();
    }
  });

  // RESTORE SESSION OR SHOW PASSWORD RECOVERY FORM
  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      showLogin();
      setLoginMessage('Unable to check your login session. Please sign in again.');
      return;
    }

    if (recoveryMode && data.session) {
      showRecovery();
      return;
    }

    if (recoveryMode && !data.session) {
      showLogin();
      setLoginMessage(
        'The password reset link could not be verified. It may have expired. Request a fresh reset email.'
      );
      return;
    }

    establishSession(data.session);
  });

})();

