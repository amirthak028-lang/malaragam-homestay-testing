
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

  const titles = {
    overview: 'Overview',
    bookings: 'Bookings',
    payments: 'Payments',
    guests: 'Guests',
    reviews: 'Reviews',
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

  async function loadTable(section) {
    if (section === 'bookings') {
      $('paymentTools').hidden = true;
      await loadBookingsManagement();
      return;
    }
    if (section === 'payments') {
      $('bookingTools').hidden = true;
      await loadPaymentsManagement();
      return;
    }

    $('bookingTools').hidden = true;
    $('paymentTools').hidden = true;
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
  $('bookingSearch').addEventListener('input', renderBookingManagement);
  $('bookingStatusFilter').addEventListener('change', renderBookingManagement);

  $('tableContent').addEventListener('click', event => {
    const paymentButton = event.target.closest('[data-payment-id]');
    if (paymentButton) { openPaymentDetails(paymentButton.dataset.paymentId); return; }
    const button = event.target.closest('[data-booking-id]');
    if (button) openBookingDetails(button.dataset.bookingId);
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

