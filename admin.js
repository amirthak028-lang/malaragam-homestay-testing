
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

  async function loadTable(section) {
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

