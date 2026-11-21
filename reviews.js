(function(){
'use strict';
const CFG = window.MALARAGAM_CONFIG, t = window.MALARAGAM_T, live = window.MALARAGAM_LIVE;
const list = document.getElementById('reviewList');
const form = document.getElementById('reviewForm');
const msg = document.getElementById('reviewMsg');
if(!list) return;
const H = {apikey:CFG.SUPABASE_ANON_KEY, Authorization:'Bearer '+CFG.SUPABASE_ANON_KEY};

function empty(text){
  list.textContent = '';
  const d = document.createElement('div'); d.className = 'empty-state'; d.textContent = text; list.appendChild(d);
}
function card(r){
  const a = document.createElement('article'); a.className = 'review';
  const meta = document.createElement('div'); meta.className = 'review-meta';
  const n = document.createElement('strong'); n.textContent = r.guest_name;
  const s = document.createElement('span'); s.className = 'stars';
  const rating = Math.max(1,Math.min(5,+r.rating||5)); s.textContent = '★'.repeat(rating)+'☆'.repeat(5-rating); s.setAttribute('aria-label', rating+' out of 5');
  meta.append(n,s);
  if(r.verified){ const b = document.createElement('span'); b.className='badge'; b.textContent = t('verified'); meta.appendChild(b); }
  const when = r.stay_month || (r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN',{month:'long',year:'numeric'}) : '');
  if(when){ const d = document.createElement('span'); d.className='review-date'; d.textContent = when; meta.appendChild(d); }
  const p = document.createElement('p'); p.textContent = r.body;   // textContent only: reviews are user text
  a.append(meta,p); return a;
}
let all = [];
const tools = document.getElementById('reviewTools'), fSel = document.getElementById('rvFilter'), sSel = document.getElementById('rvSort');
function render(){
  const min = +fSel.value;
  let rows = all.filter(r=>r.rating>=min);
  if(sSel.value==='high') rows = rows.slice().sort((a,b)=>b.rating-a.rating || new Date(b.created_at)-new Date(a.created_at));
  list.textContent='';
  if(!rows.length){ empty(t('noReviews')); return; }
  rows.forEach(x=>list.appendChild(card(x)));
}
fSel.addEventListener('change',render); sSel.addEventListener('change',render);
async function load(){
  if(!live){ empty(t('noReviews')); return; }
  try{
    const r = await fetch(`${CFG.SUPABASE_URL}/rest/v1/reviews?status=eq.approved&select=id,guest_name,rating,body,stay_month,verified,created_at&order=created_at.desc&limit=50`,{headers:H});
    if(!r.ok) throw new Error(r.status);
    const rows = await r.json();
    if(!rows.length){ empty(t('noReviews')); return; }
    all = rows; tools.hidden = false; render();
  }catch(e){ empty(t('loadFail')); }
}
load();
document.addEventListener('malaragam:lang',()=>{ if(list.firstChild && list.firstChild.className==='empty-state') load(); });

form.addEventListener('submit', async e=>{
  e.preventDefault();
  msg.className='inline-msg';
  if(!live){ msg.className='inline-msg err'; msg.textContent = t('notLive'); return; }
  const f = new FormData(form);
  const row = {
    guest_name:(f.get('guest_name')||'').trim(), stay_month:(f.get('stay_month')||'').trim()||null,
    rating:+f.get('rating'), body:(f.get('body')||'').trim(),
    booking_reference:(f.get('booking_reference')||'').trim().toUpperCase()||null,
    status:'pending'        // the database policy also forces this; guests can never self-approve
  };
  try{
    const r = await fetch(`${CFG.SUPABASE_URL}/rest/v1/reviews`,{method:'POST',headers:{...H,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(row)});
    if(!r.ok) throw new Error(r.status);
    form.reset(); msg.className='inline-msg ok'; msg.textContent = t('sent');
  }catch(err){ msg.className='inline-msg err'; msg.textContent = t('failGeneric'); }
});
})();

/* rating words and character counter */
(function(){
  const t = window.MALARAGAM_T;
  const lbl = document.getElementById('ratingLabel'), body = document.getElementById('rvBody'), cnt = document.getElementById('charCount');
  const show = n => { lbl.textContent = n ? n+' / 5: '+t('r'+n) : ''; };
  const radios = [...document.querySelectorAll('input[name=rating]')];
  radios.forEach(r=>{
    r.addEventListener('change',()=>show(r.value));
    r.parentElement.addEventListener('mouseenter',()=>show(r.value));
    r.parentElement.addEventListener('mouseleave',()=>{ const c = radios.find(x=>x.checked); show(c?c.value:''); });
  });
  show(5);
  document.addEventListener('malaragam:lang',()=>{ const c = radios.find(x=>x.checked); show(c?c.value:''); });
  body.addEventListener('input',()=>{ cnt.textContent = body.value.length+' / 1200'; });
})();
