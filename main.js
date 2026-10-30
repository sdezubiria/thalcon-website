/* ==========================================================================
   Thalcon — scroll engine and scenes (no dependencies)

   Every pinned section is a `.scene` (tall wrapper) with a sticky
   `.scene__stage`. Each frame we read the wrapper's scroll progress (0–1),
   ease it toward the target for a soft, inertial feel, and hand it to the
   scene's render function.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const ease = {
    io: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    io2: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: t => 1 - Math.pow(1 - t, 3),
    out5: t => 1 - Math.pow(1 - t, 5),
    in: t => t * t * t,
  };
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, parent) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  const f2 = n => Math.round(n * 100) / 100;
  const dPath = pts => 'M' + pts.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L');
  const lerpPts = (A, B, t) => A.map((p, i) => [lerp(p[0], B[i][0], t), lerp(p[1], B[i][1], t)]);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------- */
  /* Viewport + design unit                                                  */
  /* ---------------------------------------------------------------------- */
  let W = 0, H = 0, U = 1, mobile = false;
  const root = document.documentElement;
  function measure() {
    W = root.clientWidth;
    H = root.clientHeight || window.innerHeight; // layout viewport — matches the 100svh stages
    mobile = W < 820;
    U = mobile ? W / 600 : W / 1512;
    root.style.setProperty('--u', U + 'px');
  }
  measure();

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ---------------------------------------------------------------------- */
  /* Text splitting                                                          */
  /* ---------------------------------------------------------------------- */
  function splitWords(el, outer, inner) {
    const nodes = [...el.childNodes];
    el.textContent = '';
    let i = 0;
    nodes.forEach(node => {
      if (node.nodeType !== 3) { el.appendChild(node); return; }
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = outer;
        if (inner) {
          const wi = document.createElement('span');
          wi.className = inner;
          wi.textContent = part;
          w.appendChild(wi);
          w.style.setProperty('--i', i);
        } else {
          w.textContent = part;
        }
        el.appendChild(w);
        i++;
      });
    });
    return i;
  }
  $$('[data-split]').forEach(el => splitWords(el, 'w', 'w__i'));
  $$('[data-words]').forEach(el => splitWords(el, 'wd'));
  $$('[data-reveal-list]').forEach(list => [...list.children].forEach((li, i) => li.style.setProperty('--i', i)));
  $$('.partner').forEach((el, i) => el.style.setProperty('--i', i));

  /* Reveal on enter (everything outside the hero, which the intro handles) */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('[data-split], [data-reveal], [data-reveal-list], .partners__grid').forEach(el => {
    if (!el.closest('.hero')) io.observe(el);
  });

  /* ---------------------------------------------------------------------- */
  /* Scene registry + main loop                                              */
  /* ---------------------------------------------------------------------- */
  const scenes = [];
  function addScene(el, render, smooth = 0.11) {
    const s = { el, render, smooth, p: 0, sp: 0, dirty: true, live: false };
    scenes.push(s);
    return s;
  }
  function targetProgress(el) {
    const r = el.getBoundingClientRect();
    const len = r.height - H;
    if (len <= 0) return r.top < 0 ? 1 : 0;
    return clamp(-r.top / len);
  }

  const tickers = []; // per-frame callbacks (time-based bits)
  let lastT = performance.now();
  let started = false;

  function frame(now) {
    const dt = Math.min(64, now - lastT) / 16.667;
    lastT = now;

    for (const s of scenes) {
      const r = s.el.getBoundingClientRect();
      s.live = r.bottom > -H * 0.25 && r.top < H * 1.25;
      s.p = targetProgress(s.el);
      const k = reduceMotion ? 1 : 1 - Math.pow(1 - s.smooth, dt);
      const next = Math.abs(s.p - s.sp) < 0.0004 ? s.p : s.sp + (s.p - s.sp) * k;
      if (next !== s.sp || s.dirty) {
        s.sp = next;
        s.dirty = false;
        s.render(s.sp, now);
      }
    }
    for (const t of tickers) t(now, dt);
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------------- */
  /* Header: stripes, theme, logo docking, active link                       */
  /* ---------------------------------------------------------------------- */
  const hdr = $('.hdr');
  const hdrLogo = $('.hdr__logo');
  const themeZones = $$('main [data-theme]');
  const navLinks = $$('.hdr__nav a');
  const navTargets = navLinks.map(a => document.getElementById(a.getAttribute('href').slice(1)));
  const state = { heroClipTop: Infinity, logoDock: 0, logoHidden: false, intro: 0 };

  function updateHeader() {
    hdr.classList.toggle('is-scrolled', window.scrollY > 8);

    // theme under the header line
    const y = (mobile ? 30 : 44 * U);
    let theme = 'light', media = false;
    for (const z of themeZones) {
      const r = z.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) { theme = z.dataset.theme; media = z.dataset.media === '1'; }
    }
    if (state.heroClipTop < y + 40 * U && hero.getBoundingClientRect().bottom > y) { theme = 'dark'; media = true; }
    if (hdr.dataset.theme !== theme) hdr.dataset.theme = theme;
    hdr.classList.toggle('on-media', media);

    // logo: rides from the hero row up into the header, then stays docked
    const d = state.logoDock;
    const top0 = mobile ? H * 0.22 : 471 * U;
    const top1 = mobile ? 20 : 34 * U;
    const s1 = mobile ? 0.5 : 0.6;
    const introY = (1 - state.intro) * 24 * U;
    hdrLogo.style.transform = `translate3d(0, ${f2(lerp(top0, top1, d) + introY)}px, 0) scale(${f2(lerp(1, s1, d) * 1000) / 1000})`;
    hdrLogo.style.opacity = state.logoHidden ? 0 : state.intro;
    hdrLogo.style.pointerEvents = state.logoHidden ? 'none' : '';

    // active link
    let active = -1;
    navTargets.forEach((t, i) => { if (t && t.getBoundingClientRect().top < H * 0.4) active = i; });
    navLinks.forEach((a, i) => a.classList.toggle('is-active', i === active));
  }
  tickers.push(updateHeader);

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const t = id === 'top' ? document.body : document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    const y = id === 'top' ? 0 : t.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---------------------------------------------------------------------- */
  /* Scroll-drawn rules                                                      */
  /* ---------------------------------------------------------------------- */
  const drawers = [];
  $$('.rule--draw').forEach(el => drawers.push({ el, axis: 'x', v: 0, from: 0.95, span: 0.5 }));
  $$('.vline--stats').forEach(el => drawers.push({ el, axis: 'y', v: 0, from: 0.9, span: 0.9 }));
  $$('.job__meta').forEach(el => drawers.push({ el, axis: 'var', v: 0, from: 0.98, span: 0.35 }));
  const lightEl = $('.light'), axisEl = $('.light__axis');
  let axisV = 0;

  tickers.push((now, dt) => {
    const k = reduceMotion ? 1 : 1 - Math.pow(1 - 0.12, dt);
    for (const d of drawers) {
      const r = d.el.getBoundingClientRect();
      const t = ease.out(range(H * d.from - r.top, 0, H * d.span));
      if (Math.abs(t - d.v) < 0.0005 && d.init) continue;
      d.init = true;
      d.v += (t - d.v) * k;
      if (d.axis === 'x') d.el.style.transform = `scaleX(${d.v.toFixed(4)})`;
      else if (d.axis === 'y') d.el.style.transform = `scaleY(${d.v.toFixed(4)})`;
      else d.el.style.setProperty('--draw', d.v.toFixed(4));
    }
    if (lightEl) {
      const r = lightEl.getBoundingClientRect();
      const t = clamp((H * 0.8 - r.top) / r.height);
      axisV += (t - axisV) * k;
      axisEl.style.transform = `scaleY(${axisV.toFixed(4)})`;
    }
  });

  /* ---------------------------------------------------------------------- */
  /* HERO                                                                    */
  /* ---------------------------------------------------------------------- */
  const hero = $('.hero');
  const heroMedia = $('.hero__media');
  const heroInner = $('.hero__media-inner');
  const heroTag = $('.hero__tagline');
  const heroCue = $('.hero__cue');
  const heroVideo = $('.hero__video');

  const heroScene = addScene(hero, p => {
    const intro = ease.out5(state.intro);
    state.logoDock = ease.io(range(p, 0.02, 0.42));

    const tagOut = ease.io(range(p, 0.04, 0.3));
    heroTag.style.opacity = 1 - tagOut;
    heroTag.style.transform = `translate3d(0, ${f2(-40 * U * tagOut)}px, 0)`;
    const cueIn = ease.out(range(state.intro, 0.55, 1));
    const cueOut = ease.io(range(p, 0.005, 0.07));
    heroCue.style.opacity = f2(cueIn * (1 - cueOut));
    heroCue.style.transform = `translate3d(0, ${f2((1 - cueIn) * 12 * U - cueOut * 20 * U)}px, 0)`;

    const base = mobile ? H * 0.34 : 527 * U;
    const top0 = lerp(H, base, intro);
    const open = ease.io(range(p, 0.06, 0.62));
    const top = lerp(top0, 0, open);
    heroMedia.style.clipPath = `inset(${f2(top)}px 0px 0px 0px)`;
    state.heroClipTop = top;

    // push into the plant
    const zoom = 1 + 0.38 * ease.io2(range(p, 0.08, 1));
    const settle = lerp(1.18, 1, intro);
    heroInner.style.transform = `scale(${(zoom * settle).toFixed(4)})`;
  }, 0.1);

  // Keep the hero video only playing while visible
  new IntersectionObserver(([e]) => {
    if (!heroVideo) return;
    if (e.isIntersecting) heroVideo.play().catch(() => {});
    else heroVideo.pause();
  }).observe(hero);

  /* ---------------------------------------------------------------------- */
  /* CLOCK — rule turns counter-clockwise and wipes text A into text B       */
  /* ---------------------------------------------------------------------- */
  const clock = $('.clock');
  const dial = $('.clock__dial');
  const dctx = dial.getContext('2d');
  const field = $('.clock__field');
  const textA = $('.clock__text--a');
  const textB = $('.clock__text--b');
  const wordsA = $$('.wd', textA);
  let litCount = -1;

  const conic = (from, phi, show) => {
    // regions [from, from+phi] and [from+180, from+180+phi] (degrees)
    const a = show ? '#000' : 'transparent';
    const b = show ? 'transparent' : '#000';
    const e = Math.min(phi, 0.35);
    return `conic-gradient(from ${f2(from)}deg at var(--px) var(--py), ` +
      `${a} 0deg, ${a} ${f2(phi)}deg, ${b} ${f2(phi + e)}deg, ${b} 180deg, ` +
      `${a} 180deg, ${a} ${f2(180 + phi)}deg, ${b} ${f2(180 + phi + e)}deg, ${b} 360deg)`;
  };

  addScene(clock, p => {
    const lit = Math.round(ease.out(range(p, 0.02, 0.32)) * wordsA.length);
    if (lit !== litCount) {
      wordsA.forEach((w, i) => w.classList.toggle('on', i < lit));
      litCount = lit;
    }

    const phi = 180 * ease.io(range(p, 0.4, 0.86));
    // the hand: a 1px line through the pivot, redrawn whole every frame
    const handLen = mobile ? W : 1472 * U;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const dw = dial.clientWidth, dh = dial.clientHeight;
    if (dial.width !== Math.round(dw * dpr) || dial.height !== Math.round(dh * dpr)) {
      dial.width = Math.round(dw * dpr);
      dial.height = Math.round(dh * dpr);
    }
    const cx = handLen / 2, cy = field.offsetTop - dial.offsetTop + 0.5;
    const rad = phi * Math.PI / 180, hx = Math.cos(rad) * handLen / 2, hy = -Math.sin(rad) * handLen / 2;
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.clearRect(0, 0, dw, dh);
    dctx.beginPath();
    dctx.moveTo(cx - hx, cy - hy);
    dctx.lineTo(cx + hx, cy + hy);
    dctx.lineWidth = 1;
    dctx.strokeStyle = '#000';
    dctx.stroke();

    // pivot = centre of the hand, expressed in each text's own box
    const px = handLen / 2 - textA.offsetLeft;
    const py = -textA.offsetTop;
    [textA, textB].forEach(t => {
      t.style.setProperty('--px', f2(px) + 'px');
      t.style.setProperty('--py', f2(py) + 'px');
    });
    if (phi <= 0.01) {
      textA.style.webkitMaskImage = textA.style.maskImage = 'none';
      textB.style.webkitMaskImage = textB.style.maskImage = 'linear-gradient(transparent, transparent)';
    } else if (phi >= 179.99) {
      textA.style.webkitMaskImage = textA.style.maskImage = 'linear-gradient(transparent, transparent)';
      textB.style.webkitMaskImage = textB.style.maskImage = 'none';
    } else {
      const from = 90 - phi;
      textB.style.webkitMaskImage = textB.style.maskImage = conic(from, phi, true);
      textA.style.webkitMaskImage = textA.style.maskImage = conic(from, phi, false);
    }
  }, 0.1);

  /* ---------------------------------------------------------------------- */
  /* OFFER — morphing illustration (see illo.js)                          */
  /* ---------------------------------------------------------------------- */
  const illo = window.createIllo($('.illo__svg'));

  let illoT = 0;          // smoothed morph position 0..2
  let illoIntroStart = 0; // time the drawing started to draw in
  let illoVisible = false;
  const offerEl = $('.offer');
  const pillars = $$('.pillar');
  const pillarTitles = pillars.map(p => $('.pillar__title', p));
  const countStrip = $('.offer__count-strip');
  const ruleFill = $('.offer__rule-fill');
  let countIdx = -1;

  new IntersectionObserver(([e]) => {
    illoVisible = e.isIntersecting;
    if (e.isIntersecting && !illoIntroStart) illoIntroStart = performance.now();
  }, { rootMargin: '0px 0px -20% 0px' }).observe($('.illo'));

  tickers.push((now, dt) => {
    const r = offerEl.getBoundingClientRect();
    if (r.bottom < -H || r.top > H * 2) return;
    let target = 0;
    for (let k = 1; k < pillarTitles.length; k++) {
      const top = pillarTitles[k].getBoundingClientRect().top;
      target += ease.io2(range(H * 0.8 - top, 0, H * 0.5));
    }
    const k = reduceMotion ? 1 : 1 - Math.pow(1 - 0.075, dt);
    illoT += (target - illoT) * k;
    if (Math.abs(target - illoT) < 0.0005) illoT = target;

    const idx = illoT < 0.5 ? 0 : illoT < 1.5 ? 1 : 2;
    if (idx !== countIdx) {
      countIdx = idx;
      countStrip.style.transform = `translateY(${-idx}em)`;
    }
    ruleFill.style.transform = `scaleX(${((illoT + 1) / 3).toFixed(4)})`;
    if (illoVisible || !illoIntroStart) {
      const intro = illoIntroStart ? (reduceMotion ? 1 : clamp((now - illoIntroStart) / 2200)) : 0;
      illo.render(illoT, intro, now);
    }
  });

  /* ---------------------------------------------------------------------- */
  /* SITE — frame grows, pushes into the plant, spins 180° into a line       */
  /* ---------------------------------------------------------------------- */
  const siteStage = $('.site__stage');
  const siteFrame = $('.site__frame');
  const siteOuter = $('.site__outer');
  const siteOuterImg = $('.site__outer img');
  const siteInner = $('.site__inner');
  const siteLine = $('.site__line');
  const siteLabel = $('.site__label');

  addScene($('.site'), p => {
    const a = ease.io(range(p, 0.02, 0.3));
    const b = ease.io(range(p, 0.32, 0.6));
    const c = ease.io(range(p, 0.62, 0.88));
    const d = ease.io(range(p, 0.88, 0.985));

    // A — the card opens like a window onto the site
    const cw0 = Math.min(704 * U, W * 0.86), ch0 = cw0 * 518 / 704;
    const cw = lerp(cw0, W, a), ch = lerp(ch0, H, a);
    siteOuterImg.style.transform = `scale(${(lerp(1.22, 1, a) * lerp(1, 1.7, b)).toFixed(4)})`;
    siteOuter.style.setProperty('--dim', (0.45 * b).toFixed(3));

    // B — the plant photo inside grows until it fills the screen
    const pw1 = cw * 550.5 / 704, ph1 = pw1 * 367 / 550.5;
    const cover = Math.max(W, H * 1.5);
    const pw = lerp(pw1, cover * 1.04, b), ph = lerp(ph1, cover * 1.04 / 1.5, b);
    siteInner.style.left = f2((W - pw) / 2) + 'px';
    siteInner.style.top = f2((H - ph) / 2) + 'px';
    siteInner.style.width = f2(pw) + 'px';
    siteInner.style.height = f2(ph) + 'px';

    // C — rotate 180° while the window crops down to a line (no squashing:
    // the photo keeps its size, only the visible band narrows)
    const lineW = mobile ? W - 20 : 1472 * U;
    // crop leads, rotation follows: it reads as a band of footage that turns
    const crop = ease.out(range(c, 0, 0.55));
    const turn = ease.io(range(c, 0.12, 1));
    const bandW = lerp(cw, lineW, ease.io(range(c, 0, 0.6))), bandH = H * Math.pow(1.5 / H, crop);
    siteFrame.style.clipPath = `inset(${f2((H - bandH) / 2)}px ${f2((W - bandW) / 2)}px)`;
    siteFrame.style.transform = `rotate(${f2(180 * turn)}deg)`;
    siteFrame.style.opacity = f2(1 - range(c, 0.86, 1));

    const bg = range(c, 0.45, 0.88);
    const v = Math.round(255 * bg);
    siteStage.style.backgroundColor = `rgb(${v},${v},${v})`;
    siteStage.dataset.theme = bg > 0.5 ? 'light' : 'dark';
    siteStage.dataset.media = a > 0.85 && c < 0.7 ? '1' : '0';

    // D — the line settles at the bottom edge, where the next section begins
    const lv = Math.round(lerp(245, 0, range(c, 0.6, 1)));
    siteLine.style.backgroundColor = `rgb(${lv},${lv},${lv})`;
    siteLine.style.width = f2(lineW) + 'px';
    siteLine.style.opacity = f2(range(c, 0.8, 0.95));
    const lx = lerp((W - lineW) / 2, 0, d), ly = lerp(H / 2, H - 1, d);
    siteLine.style.transform = `translate3d(${f2(lx)}px, ${f2(ly)}px, 0)`;
    siteLabel.style.opacity = f2(d);
    siteLabel.style.transform = `translate3d(0, ${f2((1 - d) * 14 * U)}px, 0)`;
  }, 0.1);

  /* ---------------------------------------------------------------------- */
  /* ABOUT — stats swipe left, image pans with them                          */
  /* ---------------------------------------------------------------------- */
  const tracks = $$('.about .stats__track');
  const aboutImg = $('.about__img');
  const statDots = $$('.stats__dots span');
  const nSlides = $$('.stats--values .stat').length;
  let dotIdx = -1;

  addScene($('.about'), p => {
    if (mobile) return;
    let pos = 0;
    const seg = 1 / Math.max(1, nSlides - 1);
    for (let k = 1; k < nSlides; k++) {
      const a = (k - 1) * seg;
      pos += ease.io(range(p, a + seg * 0.28, a + seg * 0.72));
    }
    tracks.forEach(t => { t.style.transform = `translate3d(${f2(-pos * 100)}%, 0, 0)`; });
    const frac = nSlides > 1 ? pos / (nSlides - 1) : 0;
    const swing = Math.sin(Math.PI * (pos % 1));
    aboutImg.style.transform = `translate3d(0, ${f2(-frac * 30.4)}%, 0) scale(${(1 + 0.06 * swing).toFixed(4)})`;
    const idx = Math.round(pos);
    if (idx !== dotIdx) { dotIdx = idx; statDots.forEach((d, i) => d.classList.toggle('on', i === idx)); }
  }, 0.09);

  /* ---------------------------------------------------------------------- */
  /* INNOVATION — active body + its logo                                     */
  /* ---------------------------------------------------------------------- */
  const innovItems = $$('.innov__item');
  const innovLogos = $$('.innov__logo');
  let innovIdx = -1;
  tickers.push(() => {
    let idx = 0;
    innovItems.forEach((it, i) => { if (it.getBoundingClientRect().top < H * 0.52) idx = i; });
    if (idx === innovIdx) return;
    innovIdx = idx;
    innovItems.forEach((it, i) => it.classList.toggle('is-active', i === idx));
    innovLogos.forEach((l, i) => l.classList.toggle('is-active', i === idx));
  });

  /* ---------------------------------------------------------------------- */
  /* NATION WIDE — words part, hub-and-spoke map opens                       */
  /* ---------------------------------------------------------------------- */
  const nation = $('.nation');
  const nmap = $('.nation__map');
  const wordA = $('.nation__word--a');
  const wordB = $('.nation__word--b');
  const ncopy = $('.nation__copy');
  // Label centres relative to the map centre (Figma: centre at 756, 10044.8)
  const NODES = [
    [-243.97, 80.99], [-138.85, 110.43], [-179.76, -107.24], [-56.77, -159.87],
    [99.76, -80.15], [271.04, -80.34], [200.63, 10.6], [138.85, 154.76],
  ];
  const RINGS = [109.375, 268.337, 376];
  const gN = svgEl('g', {}, nmap);
  const eq = svgEl('line', { class: 'eq' }, gN);
  const rings = RINGS.map(() => svgEl('ellipse', { class: 'ring' }, gN));
  const spokes = NODES.map(() => svgEl('line', { class: 'spoke' }, gN));
  const pulses = NODES.map(() => svgEl('rect', { class: 'pulse' }, gN));
  const nodes = NODES.map(() => svgEl('rect', { class: 'node' }, gN));
  const labels = NODES.map(() => { const t = svgEl('text', { class: 'state', 'text-anchor': 'middle' }, gN); t.textContent = 'State'; return t; });
  const hub = svgEl('rect', { class: 'node' }, gN);
  let nationP = 0;

  function renderNation(p, now) {
    const m = mobile ? Math.min(1, (W - 24) / (752 * U)) : 1;
    const S = U * m;
    const cx = W / 2, cy = H * (mobile ? 0.5 : 0.53);

    // words
    const wm = ease.io(range(p, 0.04, 0.5));
    const wa = wordA.offsetWidth, wb = wordB.offsetWidth, wh = wordA.offsetHeight;
    const edge = mobile ? 20 : 39 * U;
    const ax0 = cx - 12 * U - wa, ax1 = edge;
    const bx0 = cx + 12 * U, bx1 = W - edge - wb;
    const y0 = Math.max((mobile ? 90 : 150 * U), cy - 402 * U), y1 = cy - wh - 6 * U;
    wordA.style.transform = `translate3d(${f2(lerp(ax0, ax1, wm))}px, ${f2(lerp(y0, y1, wm))}px, 0)`;
    wordB.style.transform = `translate3d(${f2(lerp(bx0, bx1, wm))}px, ${f2(lerp(y0, y1 + 3 * U, wm))}px, 0)`;

    // equator
    const ek = ease.io(range(p, 0.14, 0.56));
    eq.setAttribute('x1', f2(cx - (W / 2) * ek)); eq.setAttribute('x2', f2(cx + (W / 2) * ek));
    eq.setAttribute('y1', f2(cy)); eq.setAttribute('y2', f2(cy));

    // rings ripple out from the hub
    rings.forEach((r, i) => {
      const k = ease.out(range(p, 0.1 + i * 0.08, 0.5 + i * 0.08));
      r.setAttribute('cx', f2(cx)); r.setAttribute('cy', f2(cy));
      r.setAttribute('rx', f2(RINGS[i] * S * k)); r.setAttribute('ry', f2(189.5 * S * k));
      r.style.opacity = f2(range(k, 0, 0.25));
    });

    const hs = 9 * S * ease.out(range(p, 0.08, 0.2));
    hub.setAttribute('x', f2(cx - hs / 2)); hub.setAttribute('y', f2(cy - hs / 2));
    hub.setAttribute('width', f2(hs)); hub.setAttribute('height', f2(hs));

    NODES.forEach((n, j) => {
      const nx = cx + n[0] * S, ny = cy + n[1] * S;
      const k = ease.io(range(p, 0.36 + j * 0.032, 0.6 + j * 0.032));
      spokes[j].setAttribute('x1', f2(cx)); spokes[j].setAttribute('y1', f2(cy));
      spokes[j].setAttribute('x2', f2(lerp(cx, nx, k))); spokes[j].setAttribute('y2', f2(lerp(cy, ny, k)));
      spokes[j].style.opacity = k > 0 ? 1 : 0;

      const ns = 7 * S * ease.out(range(k, 0.8, 1));
      nodes[j].setAttribute('x', f2(nx - ns / 2)); nodes[j].setAttribute('y', f2(ny - ns / 2));
      nodes[j].setAttribute('width', f2(ns)); nodes[j].setAttribute('height', f2(ns));

      const lo = ease.out(range(p, 0.5 + j * 0.03, 0.66 + j * 0.03));
      labels[j].setAttribute('x', f2(nx));
      labels[j].setAttribute('y', f2(ny + (n[1] < 0 ? -12 * S : 22 * S) + (1 - lo) * 6 * S));
      labels[j].style.opacity = f2(lo);

      // supply pulses travelling hub → node once the spoke is drawn
      const live = range(k, 0.95, 1);
      const fr = ((now / 2600) + j * 0.137) % 1;
      const ps = 4 * S;
      pulses[j].setAttribute('x', f2(lerp(cx, nx, fr) - ps / 2));
      pulses[j].setAttribute('y', f2(lerp(cy, ny, fr) - ps / 2));
      pulses[j].setAttribute('width', f2(ps)); pulses[j].setAttribute('height', f2(ps));
      pulses[j].style.opacity = f2(live * Math.sin(Math.PI * fr) * 0.85);
    });

    const co = ease.out(range(p, 0.66, 0.84));
    ncopy.style.opacity = f2(co);
    ncopy.style.top = f2(cy + (mobile ? 200 : 290) * S) + 'px';
    ncopy.style.transform = `translate3d(0, ${f2((1 - co) * 20 * U)}px, 0)`;
  }
  const nationScene = addScene(nation, p => { nationP = p; });
  tickers.push(now => { if (nationScene.live) renderNation(nationP, now); });

  /* ---------------------------------------------------------------------- */
  /* CAREERS — the page splits down the centre line                          */
  /* ---------------------------------------------------------------------- */
  const splitStage = $('.split__stage');
  const panelL = $('.split__panel--l'), panelR = $('.split__panel--r');
  const guideL = $('.split__guide--l'), guideR = $('.split__guide--r');
  const splitLabel = $('.split__head .label');
  const splitRule = $('.split__rule');
  const splitTitle = $('.split__title span');

  addScene($('.split'), p => {
    const k = ease.io(range(p, 0.06, 0.6));
    const cxu = mobile ? W / 2 : 756 * U;
    panelL.style.transform = `translate3d(${f2(-k * (cxu + 2))}px, 0, 0)`;
    panelR.style.transform = `translate3d(${f2(k * (W - cxu + 2))}px, 0, 0)`;
    if (mobile) { panelL.style.width = cxu + 'px'; panelR.style.left = cxu + 'px'; }

    const kg = ease.io(range(p, 0.1, 0.68));
    const gl = mobile ? lerp(cxu, 20, kg) : lerp(cxu, 381 * U, kg);
    const gr = mobile ? lerp(cxu, W - 20, kg) : lerp(cxu, 1132 * U, kg);
    guideL.style.transform = `translate3d(${f2(gl - cxu)}px, 0, 0)`;
    guideR.style.transform = `translate3d(${f2(gr - cxu)}px, 0, 0)`;
    const kc = range(p, 0.12, 0.42);
    const gc = Math.round(lerp(0, 245, kc));
    const ga = lerp(1, mobile ? 0 : 0.22, kc);
    guideL.style.background = guideR.style.background = `rgba(${gc},${gc},${gc},${ga.toFixed(3)})`;

    splitStage.dataset.theme = k > 0.45 ? 'dark' : 'light';
    splitLabel.style.opacity = f2(range(p, 0.5, 0.7));
    splitRule.style.transform = `scaleX(${ease.out(range(p, 0.5, 0.86)).toFixed(4)})`;
    splitTitle.style.transform = `translate3d(0, ${f2((1 - ease.out(range(p, 0.46, 0.84))) * 110)}%, 0)`;
  }, 0.1);

  // Job rows open to show the description and the CV link
  $$('.job').forEach(job => {
    const btn = $('.job__row', job);
    btn.addEventListener('click', () => {
      const open = !job.classList.contains('is-open');
      $$('.job.is-open').forEach(j => { if (j !== job) { j.classList.remove('is-open'); $('.job__row', j).setAttribute('aria-expanded', 'false'); } });
      job.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------------------------------------------------------------------- */
  /* FOOTER — the mark grows to full width and becomes the footer            */
  /* ---------------------------------------------------------------------- */
  const foot = $('.foot');
  const footSvg = $('.foot__mark');
  const footLogo = $('.foot__logo');
  const footTitle = $('.foot__title');
  const footLinks = $$('.foot__link');
  const footContent = $('.foot__content');
  const MARK = [
    'M0 0V8.16561H192.155L180.843 0H0Z',
    'M203.467 16.3313H0V40.8281H236.803V40.3962L203.467 16.3313Z',
    'M0 90.2591L44.6405 122.484H236.803V48.9937H0V90.2591Z',
  ];
  const gMark = svgEl('g', {}, footSvg);
  const markPaths = MARK.map(d => svgEl('path', { d, pathLength: 1 }, gMark));

  addScene(foot, p => {
    const s0 = mobile ? (W * 0.42) / 236.8 : U;
    const x0 = mobile ? W / 2 - 118.4 * s0 : 643.5 * U;
    const y0 = mobile ? H * 0.3 : Math.min(226.5 * U, H * 0.28);
    // Finished layout. Desktop: full-bleed mark on the bottom edge (as in Figma),
    // margin shrinking on short screens. Mobile: logo, mark and links stacked
    // as one group, centred in the screen.
    const s1 = mobile ? (W + 12) / 236.8 : 1514.8 * U / 236.8;
    const markH = 122.484 * s1;
    const x1 = mobile ? -6 : -7.5 * U;
    let y1, logoTop;
    if (mobile) {
      const logoH = footLogo.offsetHeight || 16;
      const block = logoH + 32 + markH + 30 + 16;
      logoTop = Math.max(76, (H - block) / 2);
      y1 = logoTop + logoH + 32;
    } else {
      const bottom = clamp(H - markH - 130 * U, 24, 90 * U);
      y1 = H - bottom - markH;
      logoTop = y1 - 42 * U;
    }

    const draw = ease.io(range(p, 0.0, 0.2));
    const k = ease.io(range(p, 0.22, 0.72));
    const s = s0 * Math.pow(s1 / s0, k);
    const x = lerp(x0, x1, k), y = lerp(y0, y1, k);
    gMark.setAttribute('transform', `translate(${f2(x)} ${f2(y)}) scale(${s.toFixed(5)})`);
    markPaths.forEach((path, i) => {
      path.style.strokeWidth = (1 / s).toFixed(5);
      const di = ease.io(range(draw, i * 0.18, 0.64 + i * 0.18));
      path.style.strokeDasharray = di >= 1 ? 'none' : `${f2(di)} 1.01`;
    });

    const lo = ease.out(range(p, 0.7, 0.86));
    footLogo.style.top = f2(logoTop) + 'px';
    footLogo.style.opacity = f2(lo);
    footLogo.style.transform = `translate3d(0, ${f2((1 - lo) * 12 * U)}px, 0)`;
    if (mobile) {
      // title inside the large shape, links in a row under the mark
      footContent.style.top = f2(y1) + 'px';
      footTitle.style.top = f2(markH * 0.4 + 18) + 'px';
      footLinks.forEach((l, i) => {
        l.style.top = f2(markH + 30) + 'px';
        l.style.left = i === 0 ? '20px' : 'auto';
        l.style.right = i === 0 ? 'auto' : '20px';
      });
    } else {
      footContent.style.top = f2(y1 + 362.6 * U) + 'px';
      footTitle.style.top = '';
      footLinks.forEach(l => { l.style.top = l.style.left = l.style.right = ''; });
    }
    const to = ease.out(range(p, 0.74, 0.9));
    footTitle.style.opacity = f2(to);
    footTitle.style.transform = `translate3d(0, ${f2((1 - to) * 24 * U)}px, 0)`;
    footLinks.forEach((l, i) => {
      const o = ease.out(range(p, 0.8 + i * 0.04, 0.94 + i * 0.04));
      l.style.opacity = f2(o);
      l.style.transform = `translate3d(0, ${f2((1 - o) * 12 * U)}px, 0)`;
    });
    state.logoHidden = foot.getBoundingClientRect().top < H * 0.5;
  }, 0.1);

  /* ---------------------------------------------------------------------- */
  /* LOADER                                                                  */
  /* ---------------------------------------------------------------------- */
  const loader = $('.loader');
  const loaderSvg = $('.loader__svg');
  const loaderNum = $('.loader__num');

  // The three bars of the mark, as 5-point outlines [TL, BL, ·, ·, TR]
  const ICON = [
    [[0, 0], [0, 8.166], [192.155, 8.166], [192.155, 8.166], [180.843, 0]],
    [[0, 16.331], [0, 40.828], [236.803, 40.828], [236.803, 40.396], [203.467, 16.331]],
    [[0, 48.994], [0, 90.259], [44.641, 122.484], [236.803, 122.484], [236.803, 48.994]],
  ];
  // How each outline maps onto a rectangle: which rect corner each point becomes
  const RECT_MAP = [
    ['TL', 'BL', 'BR', 'BR', 'TR'],
    ['TL', 'BL', 'BR', 'BR', 'TR'],
    ['TL', 'BL', 'BL', 'BR', 'TR'],
  ];
  const rectPts = (map, x0, y0, x1, y1) => map.map(c => ({ TL: [x0, y0], BL: [x0, y1], BR: [x1, y1], TR: [x1, y0] })[c]);
  const loaderPaths = ICON.map(() => svgEl('path', { pathLength: 1 }, loaderSvg));

  function iconPose() {
    const iw = mobile ? 150 : 190 * U;
    const s = iw / 236.803;
    const x = W / 2 - iw / 2, y = H / 2 - 122.484 * s / 2 - 10 * U;
    return ICON.map(sh => sh.map(([px, py]) => [x + px * s, y + py * s]));
  }
  function barsPose() {
    const bw = mobile ? W * 0.7 : 600 * U;
    const x0 = W / 2 - bw / 2, x1 = W / 2 + bw / 2;
    const yc = H / 2 - 36 * U;
    const ys = [[0, 4.73], [9.47, 23.67], [28.4, 71]];
    return ys.map(([a, b], i) => rectPts(RECT_MAP[i], x0, yc + a * U, x1, yc + b * U));
  }
  function headerPose() {
    return $$('.stripe').map((st, i) => {
      const r = st.getBoundingClientRect();
      return rectPts(RECT_MAP[i], r.left + 0.5, r.top + 0.5, r.right - 0.5, r.bottom - 0.5);
    });
  }
  const drawPose = pose => pose.forEach((pts, i) => loaderPaths[i].setAttribute('d', dPath(pts) + 'Z'));

  function tween(dur, fn) {
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => {
        const t = clamp((now - t0) / dur);
        fn(t);
        if (t < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }

  let loadTarget = 0.12;
  // snap near-1 sums (0.62 + 0.38 is 0.9999… in floating point)
  const bump = v => { loadTarget = loadTarget + v > 0.995 ? 1 : loadTarget + v; };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => bump(0.38));
  if (document.readyState === 'complete') bump(0.5);
  else window.addEventListener('load', () => bump(0.5), { once: true });
  setTimeout(() => { loadTarget = 1; }, 5000);

  async function runLoader() {
    const minDur = reduceMotion ? 200 : 1700;
    let shown = 0;
    const t0 = performance.now();

    // 1 — the mark draws itself while the counter runs
    let prev = t0;
    await new Promise(res => {
      const step = now => {
        const timeCap = clamp((now - t0) / minDur);
        const goal = Math.min(loadTarget, timeCap);
        // time-based easing, so a slow or throttled device can't stall the counter
        const dt = Math.min(1000, now - prev) / 16.667;
        prev = now;
        shown += (goal - shown) * (1 - Math.pow(0.88, dt));
        if (goal >= 0.999 && shown > 0.99) shown = 1;
        loaderNum.textContent = Math.round(shown * 100);
        const pose = iconPose();
        drawPose(pose);
        loaderPaths.forEach((p, i) => {
          const di = ease.io(range(shown, i * 0.16, 0.68 + i * 0.16));
          p.style.strokeDasharray = `${f2(di)} 1.01`;
        });
        if (shown >= 1) res(); else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    loaderPaths.forEach(p => { p.style.strokeDasharray = 'none'; });
    loader.classList.add('is-morphing');
    await tween(120, () => {});

    // 2 — the mark flattens into three bars
    const A = iconPose(), B = barsPose();
    await tween(reduceMotion ? 1 : 750, t => {
      drawPose(A.map((pts, i) => lerpPts(pts, B[i], ease.io(range(t, i * 0.08, 0.84 + i * 0.08)))));
    });

    // 3 — the bars stretch out and rise into the header stripes
    loader.classList.add('is-clear');
    const C = headerPose();
    const introStart = performance.now();
    const introDur = reduceMotion ? 1 : 1500;
    const introTick = now => {
      state.intro = clamp((now - introStart) / introDur);
      heroScene.dirty = true;
      if (state.intro < 1) requestAnimationFrame(introTick);
    };
    setTimeout(() => {
      requestAnimationFrame(introTick);
      heroTag.classList.add('is-in');
    }, reduceMotion ? 0 : 420);
    await tween(reduceMotion ? 1 : 950, t => {
      drawPose(B.map((pts, i) => lerpPts(pts, C[i], ease.io(range(t, (2 - i) * 0.06, 0.88 + (2 - i) * 0.06)))));
    });

    document.body.classList.remove('is-loading', 'is-intro');
    loader.classList.add('is-done');
  }

  /* ---------------------------------------------------------------------- */
  /* Boot                                                                    */
  /* ---------------------------------------------------------------------- */
  document.body.classList.add('is-intro');
  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      measure();
      scenes.forEach(s => { s.dirty = true; });
    });
  });

  if (!started) {
    started = true;
    requestAnimationFrame(frame);
    runLoader();
  }
})();
