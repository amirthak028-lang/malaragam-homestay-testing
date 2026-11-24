(function(){
'use strict';
const CFG = window.MALARAGAM_CONFIG;
const TA = window.MALARAGAM_TA, DYN = window.MALARAGAM_DYN;
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

/* ---------- opening welcome box ---------- */
const welcomeBox = $('#welcomeBox'), welcomeSkip = $('#welcomeSkip');
if(welcomeBox){
  document.body.classList.add('welcome-active');
  let welcomeTimer;
  const closeWelcome = ()=>{
    if(!welcomeBox || welcomeBox.classList.contains('is-leaving')) return;
    clearTimeout(welcomeTimer);
    welcomeBox.classList.add('is-leaving');
    document.body.classList.remove('welcome-active');
    setTimeout(()=>welcomeBox.remove(),750);
  };
  if(welcomeSkip) welcomeSkip.addEventListener('click',closeWelcome);
  welcomeTimer = setTimeout(closeWelcome,3600);
  document.addEventListener('keydown',e=>{if(e.key==='Escape') closeWelcome();},{once:true});
}

const live = CFG.ONLINE_BOOKING && CFG.SUPABASE_URL && !/YOUR-/.test(CFG.SUPABASE_URL) && !/YOUR-/.test(CFG.SUPABASE_ANON_KEY);
window.MALARAGAM_LIVE = live;

/* ---------- language ---------- */
let bookingReady = false;
let lang = 'en';
try{ lang = localStorage.getItem('malaragam-lang') || 'en'; }catch(e){}

const t = (k,vars)=>{
  let s=(DYN[lang]&&DYN[lang][k])||DYN.en[k]||k;
  if(vars) for(const v in vars) s=s.replace('{'+v+'}',vars[v]);
  return s;
};

window.MALARAGAM_T = t;
window.MALARAGAM_LANG = ()=>lang;

$$('[data-i18n]').forEach(el=>{ el.dataset.en = el.innerHTML; });
$$('[data-i18n-ph]').forEach(el=>{ el.dataset.enPh = el.placeholder; });

function applyLang(){
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach(el=>{
    const k = el.dataset.i18n;
    el.innerHTML = (lang==='ta' && TA[k]) ? TA[k] : el.dataset.en;
  });
  const lt = $('#langToggle');
  if(lt){
    lt.textContent = lang==='ta' ? 'English' : 'தமிழ்';
    lt.setAttribute('aria-label', lang==='ta' ? 'Switch language to English' : 'Switch language to Tamil');
  }
  updateDoorLabel();
  if(bookingReady){
    renderSummary();
    updatePayLabel();
    renderEst();
  }
  document.dispatchEvent(new CustomEvent('malaragam:lang'));
}

const langBtn = $('#langToggle');
if(langBtn) langBtn.addEventListener('click',()=>{
  lang = lang==='ta' ? 'en' : 'ta';
  try{ localStorage.setItem('malaragam-lang', lang); }catch(e){}
  applyLang();
});


function initCreativeMotion(){
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce || !('IntersectionObserver' in window)) return;
  const targets = $$('.section-head, .about-head, .about-body, .room, .amenities, .tariff-row, .estimator, .g-item, .place-btn, .contact-info, .map-frame, .review-form, .review-list, .booking-card');
  targets.forEach((el,i)=>{
    el.classList.add('motion-reveal');
    if(el.matches('.place-btn,.room,.tariff-row,.g-item')) el.style.setProperty('--reveal-delay', (i%4)*75+'ms');
  });
  const io = new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    }
  }),{threshold:.12,rootMargin:'0px 0px -35px 0px'});
  targets.forEach(el=>io.observe(el));
}

function initProgress(){
  const bar = $('#progress');
  const upd = ()=>{
    const h = document.documentElement.scrollHeight - innerHeight;
    if(bar) bar.style.transform = 'scaleX('+(h>0?Math.min(1,scrollY/h):0)+')';
  };
  addEventListener('scroll',upd,{passive:true});
  upd();

  const links = $$('.nav a[href^="#"]');
  if(links.length && 'IntersectionObserver' in window){
    const map = new Map(links.map(a=>[a.getAttribute('href').slice(1),a]));
    const io = new IntersectionObserver(es=>{
      es.forEach(e=>{
        if(e.isIntersecting){
          links.forEach(a=>a.removeAttribute('aria-current'));
          const a = map.get(e.target.id);
          if(a) a.setAttribute('aria-current','true');
        }
      });
    },{rootMargin:'-45% 0px -50% 0px'});
    map.forEach((a,id)=>{
      const s = document.getElementById(id);
      if(s) io.observe(s);
    });
  }
}

/* ---------- nav ---------- */
const menuBtn = $('#menuToggle'), nav = $('#nav');
if(menuBtn){
  menuBtn.addEventListener('click',()=>{
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  $$('a',nav).forEach(a=>a.addEventListener('click',()=>{
    nav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded','false');
  }));
}

const yr = $('#year');
if(yr) yr.textContent = new Date().getFullYear();

/* ---------- hero door ---------- */
const stage = $('#doorStage'), doorBtn = $('#doorToggle');

function updateDoorLabel(){
  if(!doorBtn||!stage) return;
  const open = stage.classList.contains('is-open');
  doorBtn.textContent = open ? t('closeDoor') : t('openDoor');
  doorBtn.setAttribute('aria-pressed', String(!open));
}

if(stage){
  updateDoorLabel();
  if(doorBtn) doorBtn.addEventListener('click',()=>{
    stage.classList.toggle('is-open');
    updateDoorLabel();
  });
}

/* ---------- immersive home walkthrough ---------- */
const walkthrough = $('#walkthrough');
const bookLinks = $$('a[href="#booking"]');
let walkthroughStarted = false;

function beginWalkthrough(event){
  if(!stage || !walkthrough) return;
  event.preventDefault();

  if(!walkthroughStarted){
    walkthroughStarted = true;
    stage.classList.add('is-open');
    updateDoorLabel();
    stage.scrollIntoView({
      behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
      block:'center'
    });
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2050;
    setTimeout(()=>walkthrough.scrollIntoView({
      behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
      block:'start'
    }),delay);
  }else{
    document.querySelector('#booking')?.scrollIntoView({
      behavior:'smooth',
      block:'start'
    });
  }
}

bookLinks.forEach(a=>a.addEventListener('click',beginWalkthrough));

/* ---------- gallery lightbox ---------- */
const lb = $('#lightbox');

if(lb){
  const all = $$('.g-item');
  const vis = ()=>all.filter(x=>!x.hidden);
  const img = $('#lbImg'), cap = $('#lbCap');
  let idx = 0, opener = null, touchX = null;

  const show = i=>{
    const items = vis();
    idx = (i+items.length)%items.length;
    const it = items[idx], im = $('img',it);
    img.src = im.currentSrc || im.src;
    img.alt = im.alt;
    cap.textContent = $('span',it).textContent;
  };

  const open = i=>{
    opener = document.activeElement;
    show(i);
    lb.hidden = false;
    document.body.style.overflow='hidden';
    $('.lb-close',lb).focus();
  };

  const close = ()=>{
    lb.hidden = true;
    document.body.style.overflow='';
    if(opener) opener.focus();
  };

  all.forEach(it=>it.addEventListener('click',()=>open(vis().indexOf(it))));

  $$('.chip').forEach(ch=>ch.addEventListener('click',()=>{
    $$('.chip').forEach(x=>x.setAttribute('aria-pressed',String(x===ch)));
    const f = ch.dataset.filter;
    all.forEach(it=>{ it.hidden = !(f==='all' || it.dataset.cat===f); });
  }));

  $('.lb-close',lb).addEventListener('click',close);
  $('.lb-prev',lb).addEventListener('click',()=>show(idx-1));
  $('.lb-next',lb).addEventListener('click',()=>show(idx+1));
  lb.addEventListener('click',e=>{ if(e.target===lb) close(); });

  document.addEventListener('keydown',e=>{
    if(lb.hidden) return;
    if(e.key==='Escape') close();
    else if(e.key==='ArrowLeft') show(idx-1);
    else if(e.key==='ArrowRight') show(idx+1);
    else if(e.key==='Tab'){
      const f=$$('button',lb);
      const first=f[0], last=f[f.length-1];
      if(e.shiftKey && document.activeElement===first){
        e.preventDefault();
        last.focus();
      }else if(!e.shiftKey && document.activeElement===last){
        e.preventDefault();
        first.focus();
      }
    }
  });

  lb.addEventListener('touchstart',e=>{
    touchX = e.touches[0].clientX;
  },{passive:true});

  lb.addEventListener('touchend',e=>{
    if(touchX===null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if(Math.abs(dx)>50) show(idx + (dx<0?1:-1));
    touchX=null;
  });
}


/* ---------- place pop-ups ---------- */
const pm = $('#placeModal');

if(pm){
  let pmOpener = null;
  const enc = encodeURIComponent;

  const openPlace = btn=>{
    pmOpener = btn;
    const q = btn.dataset.q, slug = btn.dataset.slug;
    $('#pmTitle').textContent = $('b',btn).textContent;
    $('#pmAbout').textContent = $('[hidden]',btn).textContent;
    $('#pmMap').src = 'https://www.google.com/maps?q='+enc(q)+'&output=embed';
    $('#pmMaps').href = 'https://www.google.com/maps/search/?api=1&query='+enc(q);
    $('#pmPhotos').href = 'https://www.google.com/search?tbm=isch&q='+enc(q);

    const ph = $('#pmPhoto');
    ph.hidden = true;
    ph.removeAttribute('src');
    ph.alt = $('#pmTitle').textContent;

    const probe = new Image();
    const path = 'assets/places/'+slug+'.jpg';
    probe.onload = ()=>{
      if(!pm.hidden && pmOpener===btn){
        ph.src = path;
        ph.hidden = false;
      }
    };
    probe.src = path;

    pm.hidden = false;
    document.body.style.overflow = 'hidden';
    $('.pm-close',pm).focus();
  };

  const closePlace = ()=>{
    pm.hidden = true;
    $('#pmMap').src = 'about:blank';
    document.body.style.overflow='';
    if(pmOpener) pmOpener.focus();
  };

  const navagrahaToggle = $('.navagraha-toggle');
  const navagrahaList = $('#navagraha-temples');

  if(navagrahaToggle && navagrahaList){
    navagrahaToggle.addEventListener('click',()=>{
      const isOpen = navagrahaToggle.getAttribute('aria-expanded') === 'true';
      navagrahaToggle.setAttribute('aria-expanded', String(!isOpen));
      navagrahaList.hidden = isOpen;
    });
  }

  $$('.place-btn').forEach(b=>b.addEventListener('click',()=>openPlace(b)));
  $('.pm-close',pm).addEventListener('click',closePlace);
  pm.addEventListener('click',e=>{ if(e.target===pm) closePlace(); });
  document.addEventListener('keydown',e=>{
    if(!pm.hidden && e.key==='Escape') closePlace();
  });
}

/* ---------- booking ---------- */
const form = $('#bookingForm');

if(!form){
  applyLang();
  initCreativeMotion();
  initProgress();
  return;
}

const el = {
  inD:$('#checkIn'),
  outD:$('#checkOut'),
  adults:$('#adults'),
  children:$('#children'),
  beds:$('#beds'),
  name:$('#guestName'),
  phone:$('#guestPhone'),
  email:$('#guestEmail'),
  notes:$('#notes'),
  lines:$('#sumLines'),
  total:$('#sumTotal'),
  adv:$('#sumAdvance'),
  bal:$('#sumBalance'),
  msg:$('#formMsg'),
  avail:$('#availMsg'),
  pay:$('#payBtn'),
  payLabel:$('#payLabel'),
  wa:$('#waLink'),
  summary:$('#summaryPanel'),
  hold:$('#holdPanel'),
  holdTime:$('#holdTime'),
  done:$('#donePanel'),
  doneRef:$('#doneRef'),
  doneText:$('#doneText'),
  ribbon:$('#testRibbon')
};

if(CFG.RAZORPAY_TEST_MODE && live) el.ribbon.hidden = false;
bookingReady = true;

const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const pkg = ()=> form.elements.package.value;
const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parse = s => {
  const [y,m,d] = s.split('-').map(Number);
  return Date.UTC(y,m-1,d);
};
const addDays = (s,n)=>{
  const d = new Date(parse(s)+n*864e5);
  return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
};
const today = iso(new Date());
el.inD.min = today;

function nightsCount(){
  if(!el.inD.value || !el.outD.value) return 0;
  return Math.round((parse(el.outD.value)-parse(el.inD.value))/864e5);
}

function quote(){
  const n = nightsCount();
  if(n<1) return null;
  const rate = CFG.PRICE[pkg()];
  const beds = +el.beds.value;
  const bedTotal = beds * CFG.PRICE.extraBed * (CFG.EXTRA_BED_PER_NIGHT ? n : 1);
  const total = rate*n + bedTotal;
  const adv = Math.ceil(total * CFG.ADVANCE_PERCENT/100);
  return {n, rate, beds, bedTotal, total, adv, bal: total-adv};
}

function renderSummary(){
  const q = quote();
  if(!q){
    el.lines.innerHTML = '<div class="sum-empty">'+(lang==='ta'?TA.s_empty:'Pick your dates to see the price.')+'</div>';
    el.total.textContent = el.adv.textContent = el.bal.textContent = '–';
    return;
  }
  const label = pkg()==='kitchen' ? t('kitLine') : t('stdLine');
  const nl = q.n + ' ' + (q.n===1 ? t('night') : t('nights'));
  let h = `<div><dt>${label}, ${nl}</dt><dd>${inr(q.rate*q.n)}</dd></div>`;
  if(q.beds) h += `<div><dt>${t('bedsLine')} × ${q.beds}</dt><dd>${inr(q.bedTotal)}</dd></div>`;
  el.lines.innerHTML = h;
  el.total.textContent = inr(q.total);
  el.adv.textContent = inr(q.adv);
  el.bal.textContent = inr(q.bal);
}

function updatePayLabel(){
  if(!el.payLabel) return;
  const q = quote();
  if(!live) el.payLabel.textContent = t('enquire');
  else el.payLabel.textContent = q ? t('payAmt',{amt:inr(q.adv)}) : t('pay');
}

function updateWhatsApp(){
  const q = quote();
  const L = [
    t('waGreet'),
    `${t('wa_in')}: ${el.inD.value||'-'}`,
    `${t('wa_out')}: ${el.outD.value||'-'}`,
    `${t('wa_guests')}: ${el.adults.value} + ${el.children.value}`,
    `${t('wa_pkg')}: ${pkg()==='kitchen'?t('kitLine'):t('stdLine')}`,
    `${t('wa_beds')}: ${el.beds.value}`,
    q ? `${t('wa_total')}: ${inr(q.total)}` : null,
    el.name.value ? `${t('wa_name')}: ${el.name.value}` : null
  ].filter(Boolean).join('\n');
  el.wa.href = `https://wa.me/${CFG.WHATSAPP_NUMBER}?text=${encodeURIComponent(L)}`;
}

/* availability */
let booked = [], wantNights = 1, availabilityLoaded = false;


async function loadAvailability(){
  if(!live) return;
  try{
    const r = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/get_unavailable_dates`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        apikey:CFG.SUPABASE_ANON_KEY,
        Authorization:'Bearer '+CFG.SUPABASE_ANON_KEY
      },
      body:'{}'
    });
    if(!r.ok) throw new Error('Availability check failed');

const data = await r.json();
if(!Array.isArray(data)) throw new Error('Invalid availability response');

booked = data;
availabilityLoaded = true;
 }catch(e){
  availabilityLoaded = false;
  console.error('Availability loading failed:', e);
}
}

function rangeIsFree(){
  const a = el.inD.value, b = el.outD.value;
  return !booked.some(x => a < x.check_out && b > x.check_in);
}
  function checkDates(){

if(live){
  if(!availabilityLoaded){
    el.avail.className = 'inline-msg err';
    el.avail.textContent = 'Unable to check availability. Please try again.';
    return false;
  }

  if(!rangeIsFree()){
    el.avail.className = 'inline-msg err';
    el.avail.textContent = t('booked');
    return false;
  }

  el.avail.className = 'inline-msg ok';
  el.avail.textContent = t('available');
}
  return true;
}

async function onDates(){
  if(el.inD.value){
    el.outD.min = addDays(el.inD.value,1);

    if(!el.outD.value || el.outD.value <= el.inD.value){
      el.outD.value = addDays(el.inD.value,wantNights);
    }
  }

  if(live){
    await loadAvailability();
  }

  checkDates();
  refresh();
}

function refresh(){
  renderSummary();
  updatePayLabel();
  updateWhatsApp();
  el.msg.textContent='';
}

el.inD.addEventListener('change',onDates);
el.outD.addEventListener('change',onDates);
form.addEventListener('input',e=>{
  if(e.target!==el.inD && e.target!==el.outD) refresh();
});

function validate(){
  if(!el.inD.value || !el.outD.value) return t('needDates');
  if(el.inD.value < today) return t('past');
  if(nightsCount()<1) return t('badRange');
  if(+el.adults.value<1) return t('needAdult');
  if(+el.adults.value + +el.children.value > CFG.MAX_GUESTS) return t('guestCap',{n:CFG.MAX_GUESTS});
  if(live && !availabilityLoaded) return 'Unable to check availability. Please try again.';
if(live && !rangeIsFree()) return t('booked');
  if(el.name.value.trim().length<2) return t('needName');
  if(el.phone.value.replace(/\D/g,'').length<10) return t('needPhone');
  if(live && !/^\S+@\S+\.\S+$/.test(el.email.value)) return t('needEmail');
  return '';
}

/* ---------- server calls ---------- */
async function api(fn, body){
  const r = await fetch(`${CFG.SUPABASE_URL}/functions/v1/${fn}`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      apikey:CFG.SUPABASE_ANON_KEY,
      Authorization:'Bearer '+CFG.SUPABASE_ANON_KEY
    },
    body:JSON.stringify(body)
  });
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw Object.assign(new Error(j.error||j.message||'Request failed'),{status:r.status,body:j});
  return j;
}

function loadRazorpay(){
  return new Promise((res,rej)=>{
    if(window.Razorpay) return res();
    const s=document.createElement('script');
    s.src='https://checkout.razorpay.com/v1/checkout.js';
    s.onload=res;
    s.onerror=()=>rej(new Error('Razorpay failed to load'));
    document.head.appendChild(s);
  });
}

let booking = null, holdTimer = null;

function lockFields(lock){
  $$('input,select,textarea',form).forEach(x=>{ x.disabled = lock; });
}

function startHold(expiresAt){
  const end = expiresAt ? new Date(expiresAt).getTime() : Date.now()+CFG.HOLD_MINUTES*60000;
  el.hold.hidden = false;
  lockFields(true);
  clearInterval(holdTimer);

  const tick = ()=>{
    const left = Math.max(0,end-Date.now());
    const m = Math.floor(left/60000), s = Math.floor(left%60000/1000);
    el.holdTime.textContent = String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');

    if(left<=0){
      clearInterval(holdTimer);
      booking=null;
      el.hold.hidden=true;
      lockFields(false);
      el.msg.textContent=t('expired');
      el.pay.disabled=false;
      loadAvailability();
    }
  };

  tick();
  holdTimer = setInterval(tick,1000);
}

function setBusy(b){
  el.pay.disabled=b;
  if(b) el.payLabel.textContent=t('working');
  else updatePayLabel();
}

/* ---------- Razorpay payment ---------- */
async function startPayment(){
  const q = quote();

  if(!booking){
    const payload = {
      check_in:el.inD.value,
      check_out:el.outD.value,
      adults:+el.adults.value,
      children:+el.children.value,
      extra_beds:+el.beds.value,
      package_type:pkg(),
      full_name:el.name.value.trim(),
      mobile:el.phone.value.trim(),
      email:el.email.value.trim(),
      special_requests:el.notes.value.trim()
    };

    const result = await api('create-booking', payload);
    const b = result.booking || result;

    booking = {
      id: b.id ?? result.booking_id,
      ref: b.booking_reference ?? result.booking_reference ?? result.reference ?? result.booking_ref ?? '',
      adv: Number(b.advance_amount ?? result.advance_amount ?? q.adv),
      bal: Number(b.balance_amount ?? result.balance_amount ?? ((b.total_amount ?? result.total_amount ?? q.total) - (b.advance_amount ?? result.advance_amount ?? q.adv))),
      expires: b.payment_hold_expires_at ?? result.payment_hold_expires_at ?? b.hold_expires_at ?? b.expires_at ?? result.expires_at
    };

    if(!booking.id){
      throw new Error('Booking was created but its ID was not returned. Please contact support before retrying.');
    }

    startHold(booking.expires);
  }

  const o = await api('create-razorpay-order',{booking_id:booking.id});
  await loadRazorpay();

  const order = {
    id:o.order_id ?? o.id,
    amount:o.amount,
    currency:o.currency||'INR',
    key:o.key_id ?? o.key ?? CFG.RAZORPAY_KEY_ID
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    let verificationStarted = false;
    let failureTimer = null;

    const finishResolve = value => {
      if (settled) return;
      settled = true;
      clearTimeout(failureTimer);
      resolve(value);
    };

    const finishReject = error => {
      if (settled) return;
      settled = true;
      clearTimeout(failureTimer);
      reject(error);
    };

    const scheduleCheckoutFailure = error => {
      if (settled || verificationStarted || failureTimer) return;

      failureTimer = setTimeout(() => {
        if (!verificationStarted) {
          finishReject(error);
        }
      }, 3000);
    };

    const rzp = new window.Razorpay({
      key: order.key,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
      name: 'Malaragam Homestay',
      description: '50% advance ' + (booking.ref ? ('· ' + booking.ref) : ''),
      prefill: {
        name: el.name.value.trim(),
        email: el.email.value.trim(),
        contact: el.phone.value.trim()
      },
      theme: { color: '#6e1130' },

      handler: async resp => {
        if (settled) return;

        verificationStarted = true;
        clearTimeout(failureTimer);
        failureTimer = null;

        try {
          const v = await api('verify-razorpay-payment', {
            booking_id: booking.id,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature
          });

          finishResolve(v);
        } catch (err) {
          err.verify = true;
          finishReject(err);
        }
      },

      modal: {
        ondismiss: () => {
          if (!verificationStarted) {
            scheduleCheckoutFailure(
              Object.assign(new Error('dismissed'), { dismissed: true })
            );
          }
        }
      }
    });

    rzp.on('payment.failed', () => {
      if (!verificationStarted) {
        scheduleCheckoutFailure(
          Object.assign(new Error('failed'), { failed: true })
        );
      }
    });

    rzp.open();
  });
}

/* ---------- booking form submission ---------- */
form.addEventListener('submit', async e=>{
  e.preventDefault();

  const err = validate();
  if(err){
    el.msg.textContent = err;
    return;
  }

  if(!live){
    el.msg.className='inline-msg';
    el.msg.textContent = t('demo');
    window.open(el.wa.href,'_blank','noopener');
    return;
  }

  el.msg.className='inline-msg err';
  el.msg.textContent='';
  setBusy(true);

  try{
    const verification = await startPayment();

    if (verification.status !== 'confirmed') {
      el.msg.className = 'inline-msg err';

      if (verification.status === 'expired') {
        el.msg.textContent =
          'Payment received, but your booking hold expired. Please contact us.';
      } else if (verification.status === 'manual_review') {
        el.msg.textContent =
          'Payment received. Your booking requires manual review. Please contact us.';
      } else {
        el.msg.textContent =
          'Payment status could not be confirmed. Please contact support.';
      }

      return;
    }

    clearInterval(holdTimer);

    const q = quote();
    el.hold.hidden = true;
    el.summary.hidden = true;
    el.done.hidden = false;

    el.doneRef.textContent = booking.ref;
    el.doneText.textContent = t('doneText',{
      adv:inr(booking.adv ?? q.adv),
      bal:inr(booking.bal ?? q.bal),
      email:el.email.value
    });

    lockFields(true);
    el.pay.disabled = true;

  }catch(ex){
    if(ex.dismissed || ex.failed) el.msg.textContent = t('payFail');
    else if(ex.verify) el.msg.textContent = t('verifyFail');
    else if(ex.status===409) el.msg.textContent = t('booked');
    else el.msg.textContent = ex.message && ex.message.length<140 ? ex.message : t('failGeneric');

    if(booking) el.hold.hidden=false;
    if(ex.status===409) loadAvailability();

  }finally{
    if(!el.done.hidden) return;
    setBusy(false);
  }
});


/* ---------- price estimator ---------- */
let estN = 2;

function estQuote(){
  const pk = ($('input[name=estPkg]:checked')||{}).value || 'standard';
  const beds = +$('#estBeds').value;
  const total = CFG.PRICE[pk]*estN + beds*CFG.PRICE.extraBed*(CFG.EXTRA_BED_PER_NIGHT?estN:1);
  return {pk,beds,total,adv:Math.ceil(total*CFG.ADVANCE_PERCENT/100)};
}

function renderEst(){
  if(!$('#estimator')) return;
  const q = estQuote();
  $('#nOut').textContent = estN+' '+(estN===1?t('night'):t('nights'));
  $('#eTotal').textContent = inr(q.total);
  $('#eAdv').textContent = inr(q.adv);
}

if($('#estimator')){
  $('#nMinus').addEventListener('click',()=>{
    estN = Math.max(1,estN-1);
    renderEst();
  });
  $('#nPlus').addEventListener('click',()=>{
    estN = Math.min(14,estN+1);
    renderEst();
  });
  $$('input[name=estPkg]').forEach(x=>x.addEventListener('change',renderEst));
  $('#estBeds').addEventListener('change',renderEst);

  $('#eBook').addEventListener('click',()=>{
    const q = estQuote();
    form.elements.package.value = q.pk;
    el.beds.value = String(q.beds);
    el.outD.min = el.inD.value ? addDays(el.inD.value,1) : '';
    if(el.inD.value) el.outD.value = addDays(el.inD.value,estN);
    wantNights = estN;
    checkDates();
    refresh();
  });
}

initCreativeMotion();
initProgress();

loadAvailability().then(checkDates);
applyLang();
refresh();
})();


// Pendant-lamp warmth follows the pointer across the gallery only.
(() => {
  const gallery = document.querySelector(".lamp-gallery");
  if (!gallery || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let frame = 0, lastX = 50, lastY = 35;

  gallery.addEventListener("pointermove", event => {
    const rect = gallery.getBoundingClientRect();
    lastX = ((event.clientX - rect.left) / rect.width) * 100;
    lastY = ((event.clientY - rect.top) / rect.height) * 100;

    if (frame) cancelAnimationFrame(frame);

    frame = requestAnimationFrame(() => {
      gallery.style.setProperty("--lamp-x", `${lastX}%`);
      gallery.style.setProperty("--lamp-y", `${lastY}%`);
      frame = 0;
    });
  }, {passive:true});

  gallery.addEventListener("pointerleave", () => {
    gallery.style.setProperty("--lamp-x", "50%");
    gallery.style.setProperty("--lamp-y", "35%");
  }, {passive:true});
})();
