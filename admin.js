(() => {
  'use strict';
  const CFG = window.MALARAGAM_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const loginView = $('loginView');
  const dashboardView = $('dashboardView');
  const loginForm = $('loginForm');
  const loginButton = $('loginButton');
  const loginMessage = $('loginMessage');
  const dashboardMessage = $('dashboardMessage');

  if (!window.supabase || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
    loginMessage.textContent = 'Admin login is not configured. Please contact the site administrator.';
    loginButton.disabled = true;
    return;
  }

  const client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let currentSection = 'overview';
  const titles = {overview:'Overview',bookings:'Bookings',payments:'Payments',guests:'Guests',reviews:'Reviews',admins:'Admin accounts'};
  const tableFor = {bookings:'bookings',payments:'payments',guests:'guests',reviews:'reviews',admins:'admin_users'};

  function setLoginMessage(message, success = false) {
    loginMessage.textContent = message || '';
    loginMessage.classList.toggle('success', success);
  }
  function showLogin() { dashboardView.hidden = true; loginView.hidden = false; }
  function showDashboard() { loginView.hidden = true; dashboardView.hidden = false; }
  function setDashboardMessage(message, error = false) {
    dashboardMessage.textContent = message || '';
    dashboardMessage.classList.toggle('error', error);
  }
  function safeText(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
  function displayValue(value, key) {
    const text = safeText(value);
    if (key === 'status') return `<span class="status-pill ${String(value).toLowerCase().replace(/[^a-z0-9_-]/g,'')}">${escapeHtml(text)}</span>`;
    return escapeHtml(text);
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function renderTable(container, rows) {
    if (!rows || !rows.length) { container.innerHTML = '<p class="muted">No records are available to display.</p>'; return; }
    const keys = Object.keys(rows[0]);
    const shownKeys = keys.slice(0, 9);
    const head = shownKeys.map(k => `<th>${escapeHtml(k.replaceAll('_',' '))}</th>`).join('');
    const body = rows.map(row => `<tr>${shownKeys.map(k => `<td>${displayValue(row[k], k)}</td>`).join('')}</tr>`).join('');
    container.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }
  async function getAdmin(user) {
    const { data, error } = await client.from('admin_users')
      .select('user_id,full_name,role,is_active')
      .eq('user_id', user.id).eq('is_active', true).maybeSingle();
    if (error) throw new Error('Could not verify admin access. ' + error.message);
    if (!data) throw new Error('This account is not registered as an active Malaragam administrator.');
    return data;
  }
  async function loadOverview() {
    setDashboardMessage('Loading dashboard information…');
    const [bookings, guests] = await Promise.all([
      client.from('bookings').select('*').order('created_at', {ascending:false}).limit(100),
      client.from('guests').select('*', {count:'exact',head:true})
    ]);
    if (bookings.error) throw new Error('Could not load bookings: ' + bookings.error.message);
    if (guests.error) throw new Error('Could not load guest records: ' + guests.error.message);
    const rows = bookings.data || [];
    $('statBookings').textContent = rows.length >= 100 ? '100+' : rows.length;
    $('statPending').textContent = rows.filter(r => r.status === 'pending_payment' || r.status === 'pending_approval').length;
    $('statConfirmed').textContent = rows.filter(r => r.status === 'confirmed').length;
    $('statGuests').textContent = guests.count ?? '—';
    renderTable($('recentBookings'), rows.slice(0, 8));
    setDashboardMessage('Dashboard data loaded.');
  }
  async function loadTable(section) {
    const table = tableFor[section];
    $('tableHeading').textContent = titles[section];
    $('tableContent').innerHTML = '<p class="muted">Loading records…</p>';
    setDashboardMessage('');
    let query = client.from(table).select('*').limit(100);
    if (section === 'bookings' || section === 'payments' || section === 'guests' || section === 'reviews') {
      query = query.order('created_at', {ascending:false});
    }
    const {data,error} = await query;
    if (error) throw new Error(`Could not load ${table}: ${error.message}`);
    renderTable($('tableContent'), data || []);
  }
  async function openSection(section) {
    if (!titles[section]) return;
    currentSection = section;
    $('sectionTitle').textContent = titles[section];
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.section === section));
    $('overviewSection').hidden = section !== 'overview';
    $('tableSection').hidden = section === 'overview';
    try {
      if (section === 'overview') await loadOverview();
      else await loadTable(section);
    } catch (error) { setDashboardMessage(error.message, true); if (section !== 'overview') $('tableContent').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`; }
  }
  async function establishSession(session) {
    if (!session?.user) { showLogin(); return; }
    try {
      const admin = await getAdmin(session.user);
      $('adminName').textContent = admin.full_name || session.user.email || 'Administrator';
      $('adminRole').textContent = admin.role === 'primary_admin' ? 'Primary Admin' : 'Administrator';
      $('adminsNav').hidden = admin.role !== 'primary_admin';
      showDashboard();
      await openSection('overview');
    } catch (error) {
      await client.auth.signOut();
      showLogin();
      setLoginMessage(error.message);
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in…';
    setLoginMessage('');
    try {
      const email = $('email').value.trim();
      const password = $('password').value;
      const {data,error} = await client.auth.signInWithPassword({email,password});
      if (error) throw error;
      await establishSession(data.session);
    } catch (error) {
      setLoginMessage(error.message || 'Unable to sign in. Please check your details.');
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Sign in securely';
    }
  });
  $('togglePassword').addEventListener('click', () => {
    const field = $('password');
    const visible = field.type === 'password';
    field.type = visible ? 'text' : 'password';
    $('togglePassword').textContent = visible ? 'Hide' : 'Show';
    $('togglePassword').setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  });
  $('adminNav').addEventListener('click', event => {
    const button = event.target.closest('[data-section]');
    if (button) openSection(button.dataset.section);
  });
  document.querySelectorAll('[data-goto]').forEach(button => button.addEventListener('click', () => openSection(button.dataset.goto)));
  $('refreshButton').addEventListener('click', () => openSection(currentSection));
  $('signOutButton').addEventListener('click', async () => {
    await client.auth.signOut();
    $('password').value = '';
    showLogin();
    setLoginMessage('You have signed out.', true);
  });

  client.auth.getSession().then(({data}) => establishSession(data.session));
  client.auth.onAuthStateChange((_event, session) => {
    if (!session) showLogin();
  });
})();
