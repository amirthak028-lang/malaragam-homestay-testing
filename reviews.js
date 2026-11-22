(function(){
'use strict';
const CFG = window.MALARAGAM_CONFIG;
const t = window.MALARAGAM_T;
const live = window.MALARAGAM_LIVE;
const list = document.getElementById('reviewList');
const form = document.getElementById('reviewForm');
const msg = document.getElementById('reviewMsg');
if (!list) return;

const headers = {
  apikey: CFG.SUPABASE_ANON_KEY,
  Authorization: 'Bearer ' + CFG.SUPABASE_ANON_KEY
};

function empty(text) {
  list.textContent = '';
  const d = document.createElement('div');
  d.className = 'empty-state';
  d.textContent = text;
  list.appendChild(d);
}

function card(r) {
  const article = document.createElement('article');
  article.className = 'review';

  const meta = document.createElement('div');
  meta.className = 'review-meta';

  const name = document.createElement('strong');
  name.textContent = r.guest_name || '';
  const stars = document.createElement('span');
  stars.className = 'stars';
  const rating = Math.max(1, Math.min(5, Number(r.rating) || 5));
  stars.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  stars.setAttribute('aria-label', rating + ' out of 5');
  meta.append(name, stars);

  if (r.is_verified_guest) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = t('verified');
    meta.appendChild(badge);
  }

  if (r.created_at) {
    const date = document.createElement('span');
    date.className = 'review-date';
    date.textContent = new Date(r.created_at).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric'
    });
    meta.appendChild(date);
  }

  const paragraph = document.createElement('p');
  paragraph.textContent = r.review_text || '';
  article.append(meta, paragraph);
  return article;
}

let all = [];
const tools = document.getElementById('reviewTools');
const filter = document.getElementById('rvFilter');
const sort = document.getElementById('rvSort');

function render() {
  const min = Number(filter.value);
  let rows = all.filter(r => Number(r.rating) >= min);
  if (sort.value === 'high') {
    rows = rows.slice().sort((a, b) =>
      Number(b.rating) - Number(a.rating) ||
      new Date(b.created_at) - new Date(a.created_at)
    );
  }
  list.textContent = '';
  if (!rows.length) {
    empty(t('noReviews'));
    return;
  }
  rows.forEach(row => list.appendChild(card(row)));
}

filter.addEventListener('change', render);
sort.addEventListener('change', render);

async function load() {
  if (!live) {
    empty(t('noReviews'));
    return;
  }
  try {
    const url = `${CFG.SUPABASE_URL}/rest/v1/reviews?status=eq.approved&select=id,guest_name,rating,review_text,is_verified_guest,created_at&order=created_at.desc&limit=50`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Review list request failed: ${response.status}`);
    all = await response.json();
    tools.hidden = !all.length;
    render();
  } catch (error) {
    console.error('Could not load approved reviews:', error);
    empty(t('loadFail'));
  }
}

load();
document.addEventListener('malaragam:lang', () => {
  if (list.firstChild && list.firstChild.className === 'empty-state') load();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  msg.className = 'inline-msg';
  msg.textContent = '';

  if (!live) {
    msg.className = 'inline-msg err';
    msg.textContent = t('notLive');
    return;
  }

  const fields = new FormData(form);
  const payload = {
    booking_reference: String(fields.get('booking_reference') || '').trim().toUpperCase(),
    mobile: String(fields.get('mobile') || '').trim(),
    rating: Number(fields.get('rating')),
    review_text: String(fields.get('review_text') || '').trim()
  };

  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const response = await fetch(`${CFG.SUPABASE_URL}/functions/v1/submit-guest-review`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || t('failGeneric'));
    }
    form.reset();
    const count = document.getElementById('charCount');
    if (count) count.textContent = '0 / 1200';
    const ratingLabel = document.getElementById('ratingLabel');
    if (ratingLabel) ratingLabel.textContent = '';
    msg.className = 'inline-msg ok';
    msg.textContent = t('sent');
  } catch (error) {
    msg.className = 'inline-msg err';
    msg.textContent = error.message || t('failGeneric');
  } finally {
    submit.disabled = false;
  }
});
})();

/* Rating words and character counter. */
(function(){
  const t = window.MALARAGAM_T;
  const label = document.getElementById('ratingLabel');
  const body = document.getElementById('rvBody');
  const count = document.getElementById('charCount');
  if (!label || !body || !count) return;

  const show = n => { label.textContent = n ? n + ' / 5: ' + t('r' + n) : ''; };
  const radios = [...document.querySelectorAll('input[name=rating]')];
  radios.forEach(radio => {
    radio.addEventListener('change', () => show(radio.value));
    radio.parentElement.addEventListener('mouseenter', () => show(radio.value));
    radio.parentElement.addEventListener('mouseleave', () => {
      const checked = radios.find(item => item.checked);
      show(checked ? checked.value : '');
    });
  });
  show(5);
  document.addEventListener('malaragam:lang', () => {
    const checked = radios.find(item => item.checked);
    show(checked ? checked.value : '');
  });
  body.addEventListener('input', () => {
    count.textContent = body.value.length + ' / 1200';
  });
})();

