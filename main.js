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
  let W = 0, H = 0, U = 1, GC = 19, mobile = false;
  const root = document.documentElement;
  function measure() {
    W = root.clientWidth;
    H = root.clientHeight || window.innerHeight; // layout viewport — matches the 100svh stages
    mobile = W < 820;
    U = mobile ? W / 600 : W / 1512;
    // graph-paper cell (1512 / 80 u), whole pixels so the repeating lines
    // and the rules placed on them land on the same pixel
    GC = Math.max(1, Math.round(1512 / 80 * U));
    root.style.setProperty('--u', U + 'px');
    root.style.setProperty('--gc', GC + 'px');
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
  // (Innovation's title and note are driven by the Sustainability scene on desktop)
  $$('[data-split], [data-reveal], [data-reveal-list], .partners__grid').forEach(el => {
    if (!el.closest('.hero') && !(el.closest('.innov') && !mobile)) io.observe(el);
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
  const state = { heroClipTop: Infinity, logoDock: 0, intro: 0, clockInv: -1 };

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

    // over the clock, the header inverts in step with the page instead of
    // switching theme on its own a moment later
    const cr = clockStage.getBoundingClientRect();
    const overClock = state.clockInv > 0 && state.clockInv < 1 && cr.top <= y && cr.bottom > y;
    if (overClock) {
      const bg = Math.round(255 * (1 - state.clockInv)), fg = Math.round(245 * state.clockInv);
      hdr.style.transition = 'none';
      hdr.style.color = `rgb(${fg},${fg},${fg})`;
      hdr.style.setProperty('--hdr-bg', `${bg},${bg},${bg}`);
    } else if (hdr.style.color) {
      hdr.style.transition = hdr.style.color = '';
      hdr.style.removeProperty('--hdr-bg');
    }

    // logo: rides from the hero row up into the header, then stays docked
    const d = state.logoDock;
    const top0 = mobile ? H * 0.22 : 471 * U;
    const top1 = mobile ? 20 : 34 * U;
    const s1 = mobile ? 0.5 : 0.6;
    const introY = (1 - state.intro) * 24 * U;
    hdrLogo.style.transform = `translate3d(0, ${f2(lerp(top0, top1, d) + introY)}px, 0) scale(${f2(lerp(1, s1, d) * 1000) / 1000})`;
    hdrLogo.style.opacity = state.intro;

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
  /* Cursor — square follows the pointer with a little lag                   */
  /* ---------------------------------------------------------------------- */
  const cursor = $('.cursor');
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    root.classList.add('has-cursor');
    const c = { x: -50, y: -50, tx: -50, ty: -50, s: 1, ts: 1 };
    window.addEventListener('pointermove', e => {
      c.tx = e.clientX; c.ty = e.clientY;
      if (!cursor.classList.contains('is-on')) { c.x = c.tx; c.y = c.ty; cursor.classList.add('is-on'); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
    // grows a little over anything clickable
    const CLICKABLE = 'a[href], button, [role="button"], label, summary, select, input, textarea';
    document.addEventListener('pointerover', e => {
      c.ts = e.target.closest(CLICKABLE) ? 1.6 : 1;
    }, { passive: true });
    tickers.push((now, dt) => {
      const k = reduceMotion ? 1 : 1 - Math.pow(1 - 0.35, dt);
      c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
      // scale lives in the same transform, after the translate, so it grows in place
      c.s += (c.ts - c.s) * (reduceMotion ? 1 : 1 - Math.pow(1 - 0.18, dt));
      cursor.style.transform = `translate3d(${f2(c.x)}px, ${f2(c.y)}px, 0) scale(${c.s.toFixed(3)})`;
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Scroll-drawn rules                                                      */
  /* ---------------------------------------------------------------------- */
  const drawers = [];
  $$('.rule--draw').forEach(el => drawers.push({ el, axis: 'x', v: 0, from: 0.95, span: 0.5 }));
  $$('.job__meta').forEach(el => drawers.push({ el, axis: 'var', v: 0, from: 0.98, span: 0.35 }));

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
  const heroRule = $('.hero__rule');
  const heroTitle = $('.hero__title');
  const heroLede = $('.hero__lede');

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

    // the intro comes in over the footage once it has nearly opened: the
    // rule draws, the title rises word by word, then the lede
    heroRule.style.transform = `scaleX(${ease.out(range(p, 0.5, 0.72)).toFixed(4)})`;
    heroTitle.classList.toggle('is-in', p > 0.56);
    const lo = ease.out(range(p, 0.62, 0.76));
    heroLede.style.opacity = f2(lo);
    heroLede.style.transform = `translate3d(0, ${f2((1 - lo) * 20 * U)}px, 0)`;
  }, 0.1);

  // The hero video follows the scroll: it ends in white cloud just as the
  // hero hands over to the white section below
  tickers.push(() => {
    if (!heroVideo || !heroVideo.duration || heroVideo.seeking) return;
    const t = range(heroScene.sp, 0.08, 1) * (heroVideo.duration - 0.05);
    if (Math.abs(heroVideo.currentTime - t) > 1 / 30) heroVideo.currentTime = t;
  });

  /* ---------------------------------------------------------------------- */
  /* CLOCK — rule turns counter-clockwise and wipes text A into text B       */
  /* ---------------------------------------------------------------------- */
  const clock = $('.clock');
  const dial = $('.clock__dial');
  const dctx = dial.getContext('2d');
  const field = $('.clock__field');
  const textA = $('.clock__text--a');
  const textB = $('.clock__text--b');
  const clockStage = $('.clock__stage');
  const clockLabel = $('.clock__label');
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
    const lit = Math.round(ease.out(range(p, 0.02, 0.24)) * wordsA.length);
    if (lit !== litCount) {
      wordsA.forEach((w, i) => w.classList.toggle('on', i < lit));
      litCount = lit;
    }

    const phi = 180 * ease.io(range(p, 0.28, 0.54));
    // at 180° the page inverts, ready for the black section that follows
    const inv = ease.io(range(p, 0.46, 0.56));
    state.clockInv = inv;
    const bg = Math.round(255 * (1 - inv)), fg = Math.round(245 * inv);
    clockStage.style.backgroundColor = inv >= 1 ? 'transparent' : `rgb(${bg},${bg},${bg})`;
    clockStage.style.color = `rgb(${fg},${fg},${fg})`;
    clockStage.style.pointerEvents = inv >= 1 ? 'none' : '';
    clockStage.dataset.theme = inv > 0.5 ? 'dark' : 'light';
    textB.style.opacity = f2(1 - range(p, 0.6, 0.66));
    clockLabel.style.opacity = f2(1 - range(p, 0.5, 0.6));

    // the hand: a hairline through the pivot, redrawn whole every frame
    const handLen = mobile ? W : 1472 * U;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const lw = dpr >= 2 ? 0.5 : 1;
    const dw = dial.clientWidth, dh = dial.clientHeight;
    if (dial.width !== Math.round(dw * dpr) || dial.height !== Math.round(dh * dpr)) {
      dial.width = Math.round(dw * dpr);
      dial.height = Math.round(dh * dpr);
    }
    const cx = handLen / 2, cy = field.offsetTop - dial.offsetTop;
    const rad = phi * Math.PI / 180, hx = Math.cos(rad) * handLen / 2, hy = -Math.sin(rad) * handLen / 2;
    // after the turn the line slides up and shortens into the offer rule
    // (desktop: x -2u → 744u, 163u from the top); on mobile it just fades
    const m = mobile ? 0 : ease.io(range(p, 0.6, 0.7));
    const x0 = lerp(cx - hx, -2 * U, m), x1 = lerp(cx + hx, 744 * U, m);
    const yEnd = 163 * U - dial.offsetTop;
    const snap = y => Math.round(y * dpr) / dpr + lw / 2;
    const y0 = snap(lerp(cy - hy, yEnd, m)), y1 = snap(lerp(cy + hy, yEnd, m));
    const lc = Math.round(lerp(207, 245, inv));
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.clearRect(0, 0, dw, dh);
    dctx.globalAlpha = mobile ? 1 - range(p, 0.6, 0.7) : 1;
    dctx.lineWidth = lw;
    // lands as one even line, as bright as the offer rule when its fill is full
    // (track .24 under fill .6 ≈ .7); the offer then eases it to its progress
    dctx.strokeStyle = `rgba(${lc},${lc},${lc},${f2(lerp(1, 0.7, inv))})`;
    dctx.beginPath();
    dctx.moveTo(x0, y0);
    dctx.lineTo(x1, y1);
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

  // Hand-over: once the offer has slid into place under the clock's last
  // screen, its own rule takes over from the drawn line
  const offerSec = $('.offer');
  let offerArrivedAt = 0; // when the rule took over (0 = not yet)
  tickers.push(now => {
    const arrived = mobile || offerSec.getBoundingClientRect().top <= 19 * U + 1;
    if (arrived === offerSec.classList.contains('is-arrived')) return;
    offerSec.classList.toggle('is-arrived', arrived);
    dial.style.opacity = arrived && !mobile ? 0 : '';
    offerArrivedAt = arrived && !mobile ? now : 0;
  });

  /* ---------------------------------------------------------------------- */
  /* OFFER — morphing illustration (see illo.js)                          */
  /* ---------------------------------------------------------------------- */
  const illo = window.createIllo($('.illo__svg'));

  let illoT = 0;          // smoothed morph position 0..2
  let illoIntroStart = 0; // time the drawing started to draw in
  let illoVisible = false;
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
    const r = offerSec.getBoundingClientRect();
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
    // the rule arrives full from the clock, then settles back to the progress
    const settle = !offerArrivedAt || reduceMotion ? 1 : ease.io(clamp((now - offerArrivedAt - 250) / 1100));
    ruleFill.style.transform = `scaleX(${lerp(1, (illoT + 1) / 3, settle).toFixed(4)})`;
    if (illoVisible || !illoIntroStart) {
      const intro = illoIntroStart ? (reduceMotion ? 1 : clamp((now - illoIntroStart) / 2200)) : 0;
      illo.render(illoT, intro, now);
    }
  });

  /* ---------------------------------------------------------------------- */
  /* SITE — video card grows to full screen and plays with the scroll; the  */
  /* "~1 acre" caption rises over the last frame, then it spins into a line */
  /* ---------------------------------------------------------------------- */
  const siteStage = $('.site__stage');
  const siteFrame = $('.site__frame');
  const siteVideo = $('.site__video');
  const siteShade = $('.site__shade');
  const siteCapLines = $$('.site__caption span');
  const siteLine = $('.site__line');
  const siteLabel = $('.site__label');
  let siteVideoT = 0; // 0–1, how far through the video the scroll has got
  const lerpRect = (r, s, t) => r.map((v, i) => lerp(v, s[i], t)); // [x0, y0, x1, y1]

  const siteScene = addScene($('.site'), p => {
    const a = ease.io(range(p, 0.03, 0.22)); // card → full screen
    const b = ease.io(range(p, 0.24, 0.5));  // footage pushes in while it plays
    const c = ease.io(range(p, 0.8, 0.93));  // crop to a line and turn
    const d = ease.io(range(p, 0.93, 0.99)); // line settles at the bottom
    siteVideoT = range(p, 0.02, 0.52);

    // The visible window onto the footage: the 704 × 469 card (Figma),
    // centred, opens to full screen and stays there, zoomed in, to the end
    const cw0 = Math.min(704 * U, W * 0.86), ch0 = cw0 * 469 / 704;
    const card = [(W - cw0) / 2, (H - ch0) / 2, (W + cw0) / 2, (H + ch0) / 2];
    const R = lerpRect(card, [0, 0, W, H], a);

    siteVideo.style.transform = `scale(${(lerp(1.08, 1, a) * lerp(1, 1.12, b)).toFixed(4)})`;

    // Once the video has reached its last frame, the caption rises over it,
    // line by line, and leaves before the footage turns into a line
    const so = ease.io(range(p, 0.75, 0.8));
    siteShade.style.opacity = f2(ease.out(range(p, 0.54, 0.64)) * (1 - so));
    siteCapLines.forEach((l, i) => {
      const k = ease.out(range(p, 0.56 + i * 0.025, 0.66 + i * 0.025));
      l.style.opacity = f2(k * (1 - so));
      l.style.transform = `translate3d(0, ${f2((1 - k) * 36 * U - so * 16 * U)}px, 0)`;
    });

    // C — the window crops down to a line while it turns 180° about its own
    // centre, which drifts to the middle of the screen (no squashing: the
    // footage keeps its size, only the visible band narrows)
    const lineW = mobile ? W - 20 : 1472 * U;
    // crop leads, rotation follows: it reads as a band of footage that turns
    const crop = ease.out(range(c, 0, 0.55));
    const turn = ease.io(range(c, 0.12, 1));
    const mv = ease.io(range(c, 0, 0.6));
    const rw = R[2] - R[0], rh = R[3] - R[1];
    const cx = lerp((R[0] + R[2]) / 2, W / 2, mv), cy = lerp((R[1] + R[3]) / 2, H / 2, mv);
    const bw = lerp(rw, lineW, mv), bh = rh * Math.pow(1.5 / rh, crop);
    siteFrame.style.clipPath = `inset(${f2(cy - bh / 2)}px ${f2(W - cx - bw / 2)}px ${f2(H - cy - bh / 2)}px ${f2(cx - bw / 2)}px)`;
    siteFrame.style.transformOrigin = `${f2(cx)}px ${f2(cy)}px`;
    siteFrame.style.transform = `rotate(${f2(180 * turn)}deg)`;
    siteFrame.style.opacity = f2(1 - range(c, 0.86, 1));

    const bg = range(c, 0.45, 0.88);
    const v = Math.round(255 * bg);
    siteStage.style.backgroundColor = `rgb(${v},${v},${v})`;
    siteStage.dataset.theme = bg > 0.5 ? 'light' : 'dark';
    siteStage.dataset.media = a > 0.85 && c < 0.3 ? '1' : '0';

    // D — the line settles at the bottom edge, where the next section begins
    const lv = Math.round(lerp(245, 207, range(c, 0.6, 1)));
    siteLine.style.backgroundColor = `rgb(${lv},${lv},${lv})`;
    siteLine.style.width = f2(lineW) + 'px';
    siteLine.style.opacity = f2(range(c, 0.8, 0.95));
    const lx = lerp((W - lineW) / 2, 0, d), ly = lerp(H / 2, H - 1, d);
    siteLine.style.transform = `translate3d(${f2(lx)}px, ${f2(ly)}px, 0)`;
    siteLabel.style.opacity = f2(d);
    siteLabel.style.transform = `translate3d(0, ${f2((1 - d) * 14 * U)}px, 0)`;
  }, 0.1);

  // Video progress follows the scroll. Seeks are queued one at a time, so a
  // fast scroll doesn't pile them up; until the file loads the poster shows.
  tickers.push(() => {
    if (!siteScene.live || !siteVideo.duration || siteVideo.seeking) return;
    const t = siteVideoT * (siteVideo.duration - 0.05);
    if (Math.abs(siteVideo.currentTime - t) > 1 / 30) siteVideo.currentTime = t;
  });

  /* ---------------------------------------------------------------------- */
  /* SUSTAINABILITY → INNOVATION — one pinned 2×2 grid. The stat columns     */
  /* slide left one at a time, then the quadrants hand over to Innovation    */
  /* and its names step up the right side, each resting on the rule.         */
  /* ---------------------------------------------------------------------- */
  const STATS_END = 0.52, INNOV_IN = 0.62; // scroll split; .about__anchor sits at INNOV_IN
  const tracks = $$('.about .stats__track');
  const statCols = tracks.map(t => [...t.children]);
  const aboutImg = $('.about__img');
  const aboutMedia = $('.about__media');
  const aboutOut = $$('.about__title, .about__source, .stats');
  const statsLine = $('.vline--stats');
  const nSlides = $$('.stats--values .stat').length;
  let statIdx = -1;

  const innovTitle = $('.innov__title');
  const innovLede = $('.innov__lede');
  const innovLogosBox = $('.innov__logos');
  const innovWindow = $('.innov__window');
  const innovItems = $$('.innov__item');
  const innovLogos = $$('.innov__logo');
  const innovList = $('.innov__list');
  let innovIdx = -1;
  const setInnov = idx => {
    if (idx === innovIdx) return;
    innovIdx = idx;
    innovItems.forEach((it, i) => it.classList.toggle('is-active', i === idx));
    innovLogos.forEach((l, i) => l.classList.toggle('is-active', i === idx));
  };
  // steps 0 → n-1 over t, each one easing through the middle of its share
  const steps = (t, n) => {
    let pos = 0;
    const seg = 1 / Math.max(1, n - 1);
    for (let k = 1; k < n; k++) pos += ease.io(range(t, (k - 1 + 0.28) * seg, (k - 1 + 0.72) * seg));
    return pos;
  };

  addScene($('.about'), p => {
    if (mobile) {
      // static layout on mobile: drop anything a desktop render left inline
      [...aboutOut, statsLine, aboutMedia, innovLogosBox, innovWindow, innovList].forEach(el => { el.style.opacity = el.style.transform = el.style.clipPath = ''; });
      innovTitle.classList.add('is-in');
      innovLede.classList.add('is-in');
      return;
    }
    // stats: one column (376u) per step; the column arriving on the left turns black
    const ps = range(p, 0, STATS_END);
    const pos = steps(ps, nSlides);
    tracks.forEach(t => { t.style.transform = `translate3d(${f2(-pos * 376 * U)}px, 0, 0)`; });
    // the photo pans steadily with the scroll (no zoom pulse between steps)
    aboutImg.style.transform = `translate3d(0, ${f2(-ps * 30.4)}%, 0)`;
    const idx = Math.round(pos);
    if (idx !== statIdx) {
      statIdx = idx;
      statCols.forEach(cols => cols.forEach((c, i) => c.classList.toggle('is-active', i === idx)));
    }

    // hand-over: the lines hold; the stats lift away, the photo rolls up
    // into the rule and the column line drops into it, then Innovation
    // rises into the same quadrants
    const span = INNOV_IN - STATS_END;
    const out = ease.io(range(p, STATS_END, STATS_END + span * 0.6));
    const inn = ease.out(range(p, STATS_END + span * 0.4, INNOV_IN));
    aboutOut.forEach(el => {
      el.style.opacity = f2(1 - out);
      el.style.transform = `translate3d(0, ${f2(-out * 24 * U)}px, 0)`;
    });
    statsLine.style.transform = `scaleY(${(1 - out).toFixed(4)})`;
    aboutMedia.style.clipPath = out > 0 ? `inset(0 0 ${f2(out * 100)}% 0)` : '';
    innovTitle.classList.toggle('is-in', inn > 0.25);
    innovLede.classList.toggle('is-in', inn > 0.3);
    innovLogosBox.style.opacity = innovWindow.style.opacity = f2(inn);
    innovLogosBox.style.transform = `translate3d(0, ${f2((1 - inn) * 24 * U)}px, 0)`;

    // names: the active one hangs from the rule, level with its logo; the
    // ones before it have slid up under the rule
    const ip = steps(range(p, INNOV_IN, 1), innovItems.length);
    const restY = i => -innovItems[i].offsetTop;
    const i0 = Math.min(Math.floor(ip), innovItems.length - 1);
    const y = lerp(restY(i0), restY(Math.min(i0 + 1, innovItems.length - 1)), ip - i0) + (1 - inn) * 120 * U;
    innovList.style.transform = `translate3d(0, ${f2(y)}px, 0)`;
    setInnov(Math.round(ip));
  }, 0.09);
  tickers.push(() => {
    if (!mobile) return;
    let idx = 0;
    innovItems.forEach((it, i) => { if (it.getBoundingClientRect().top < H * 0.52) idx = i; });
    setInnov(idx);
  });

  /* ---------------------------------------------------------------------- */
  /* PARTNERS — head holds, the four logos rise into place                   */
  /* ---------------------------------------------------------------------- */
  // Parallax: the two centre logos lead and travel less; the outer two start
  // lower and later. Once landed they keep drifting at different rates.
  const partnerEls = $$('.partner');
  const PARTNER_DEPTH = [1, 0, 0, 1]; // 0 = centre (near), 1 = outer (far)
  addScene($('.partners'), p => {
    if (mobile) { partnerEls.forEach(el => { el.style.opacity = el.style.transform = ''; }); return; }
    partnerEls.forEach((el, i) => {
      const d = PARTNER_DEPTH[i];
      const k = ease.out(range(p, 0.1 + d * 0.12, 0.46 + d * 0.16));
      const rise = (1 - k) * H * lerp(0.55, 0.95, d);
      const drift = (p - 0.5) * lerp(-40, -90, d) * U;
      el.style.opacity = f2(range(k, 0, 0.6));
      el.style.transform = `translate3d(0, ${f2(rise + drift)}px, 0)`;
    });
  }, 0.1);

  /* ---------------------------------------------------------------------- */
  /* SCALE OUTPUT — axis opens into a grid, numbers count, grid folds back   */
  /* ---------------------------------------------------------------------- */
  const scaleGrid = $('.scale__grid');
  const scaleFrame = $('.scale__frame');
  const scaleTable = $('.scale__table');
  const scaleRows = $$('.scale__row');
  const scaleTitle = $('.scale__title');
  const scaleNotes = $('.scale__notes');
  const scaleNums = $$('.scale__row [data-n]');
  const fmt = n => String(n); // Figma shows plain digits (1200, not 1,200)
  let countFrom = 0; // when the count-up was triggered (0 = not yet)
  let countShown = -1;

  addScene($('.scale'), (p, now) => {
    if (mobile) {
      // static layout on mobile: drop anything a desktop render left inline
      [scaleTitle, scaleNotes, scaleFrame].forEach(el => { el.style.opacity = el.style.transform = ''; });
      [scaleTable, ...scaleRows].forEach(el => { el.style.removeProperty('--k'); el.style.removeProperty('--t'); });
      scaleTable.style.top = '';
      return;
    }
    const open = ease.io(range(p, 0.02, 0.22));
    const close = ease.io(range(p, 0.7, 0.94));
    // grid: the way in is the way out reversed. Squares grow out of the
    // axis while the grid fades in; on the way out they shrink and fade.
    // Mid-scale the major lines and the horizontal axis stand out, like a
    // cartesian plane, then settle back into an even grid.
    const g = open * (1 - close);
    const mid = Math.sin(Math.PI * g);
    scaleGrid.style.setProperty('--cell', f2(GC * lerp(0.2, 1, g)) + 'px');
    // the table's rules sit on grid lines: its top is a whole number of
    // cells above the centre line, ten normally, more on short screens so
    // the last rule and a cell of the divider below it stay on screen
    let n = Math.max(10, Math.ceil((31 * GC + 24 * U - H / 2) / GC));
    n = Math.min(n, Math.floor((H / 2 - 72 * U) / GC));
    const frameTop = Math.max(110 * U, H / 2 - 382 * U);
    scaleTable.style.top = f2(H / 2 - n * GC - frameTop) + 'px';
    scaleGrid.style.setProperty('--minor', (0.105 * range(g, 0.35, 1)).toFixed(3));
    scaleGrid.style.setProperty('--major', (0.1 * mid).toFixed(3));
    scaleGrid.style.setProperty('--axis', (0.17 * mid).toFixed(3));

    // table rules draw in once the grid is open, row by row
    scaleTable.style.setProperty('--k', ease.io(range(p, 0.14, 0.3)).toFixed(4));
    scaleRows.forEach((r, i) => r.style.setProperty('--k', ease.io(range(p, 0.16 + i * 0.022, 0.3 + i * 0.022)).toFixed(4)));
    const t = ease.out(range(p, 0.16, 0.3));
    scaleTable.style.setProperty('--t', f2(range(p, 0.2, 0.32)));
    scaleTitle.style.opacity = f2(t);
    scaleTitle.style.transform = `translate3d(0, ${f2((1 - t) * 30 * U)}px, 0)`;
    const nt = ease.out(range(p, 0.26, 0.38));
    scaleNotes.style.opacity = f2(nt);
    scaleNotes.style.transform = `translate3d(0, ${f2((1 - nt) * 16 * U)}px, 0)`;

    // scroll only triggers the count; it then runs on its own (see ticker
    // below). Scrolling back above the table resets it for next time.
    if (p >= 0.3 && !countFrom) countFrom = now;
    else if (p < 0.2) countFrom = 0;

    // everything folds toward the axis as the grid closes
    const fo = range(close, 0, 0.6);
    scaleFrame.style.opacity = f2(1 - fo);
    scaleFrame.style.transform = `scale(${(1 - 0.06 * fo).toFixed(4)})`;
    scaleFrame.style.transformOrigin = `${f2(756 * U)}px 50%`;
  }, 0.1);

  // numbers count up from 0 over a fixed time once triggered
  tickers.push(now => {
    const c = mobile ? 1 : !countFrom ? 0 : reduceMotion ? 1 : ease.out(clamp((now - countFrom) / 1600));
    if (c === countShown) return;
    countShown = c;
    scaleNums.forEach(el => { el.textContent = fmt(Math.round(+el.dataset.n * c)); });
  });

  /* ---------------------------------------------------------------------- */
  /* NATION WIDE — words part, hub-and-spoke map opens                       */
  /* ---------------------------------------------------------------------- */
  const nation = $('.nation');
  const nmap = $('.nation__map');
  const wordA = $('.nation__word--a');
  const wordB = $('.nation__word--b');
  const ncopy = $('.nation__copy');
  // Wire globe (Figma outline 752 × 379). A unit sphere, tilted toward the
  // viewer and turning about its axis, projected with x × 376 and y × 189.5,
  // so the outline stays the Figma ellipse. Lines and nodes on the far side
  // are drawn lighter and smaller.
  const GR = [376, 189.5];
  const TILT = 0.32; // rad, top of the globe leans toward the viewer
  const MERIDIANS = 6;
  const PARALLELS = [-0.85, -0.45, 0, 0.45, 0.85]; // latitude, rad
  // One node per state in .nation__states. Each node's place on the sphere
  // [latitude, longitude] in rad: spread evenly all the way round (nudged)
  // at mixed latitudes, so some are always on the far side as it turns
  const STATES = $$('.nation__states li').map(li => li.textContent.trim()).filter(Boolean);
  const NODE_LAT = [0.42, -0.5, 0.75, -0.18, 0.2, -0.72, 0.55, -0.35];
  const NODE_GEO = STATES.map((_, j) => [NODE_LAT[j % NODE_LAT.length], j * 2 * Math.PI / STATES.length + (j % 2 ? 0.2 : -0.12)]);
  const gN = svgEl('g', {}, nmap);
  const eq = svgEl('line', { class: 'eq' }, gN);
  const wireBack = svgEl('path', { class: 'wire wire--back' }, gN);
  const silhouette = svgEl('ellipse', { class: 'ring' }, gN);
  const wireFront = svgEl('path', { class: 'wire' }, gN);
  const spokes = NODE_GEO.map(() => svgEl('line', { class: 'spoke' }, gN));
  const pulses = NODE_GEO.map(() => svgEl('rect', { class: 'pulse' }, gN));
  const nodes = NODE_GEO.map(() => svgEl('rect', { class: 'node' }, gN));
  const labels = STATES.map(name => { const t = svgEl('text', { class: 'state', 'text-anchor': 'middle' }, gN); t.textContent = name; return t; });
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

    // globe ripples out from the hub, then keeps turning (time + scroll)
    const ks = ease.out(range(p, 0.1, 0.5));
    const A = GR[0] * S * ks, B = GR[1] * S * ks;
    silhouette.setAttribute('cx', f2(cx)); silhouette.setAttribute('cy', f2(cy));
    silhouette.setAttribute('rx', f2(A)); silhouette.setAttribute('ry', f2(B));
    silhouette.style.opacity = f2(range(ks, 0, 0.25));
    const spin = (reduceMotion ? 0 : now / 1000 * (Math.PI * 2 / 60)) + p * Math.PI * 0.6;
    const ct = Math.cos(TILT), st = Math.sin(TILT);
    // unit-sphere point → [screen x, screen y, depth (-1 back … 1 front)]
    const proj = (ux, uy, uz) => [cx + A * ux, cy - B * (uy * ct - uz * st), uz * ct + uy * st];
    const geo = (lat, lon) => proj(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));

    // wireframe: each curve is split into the half facing us and the half behind
    let dF = '', dB = '';
    const curve = pt => {
      const N = 72;
      let prev = pt(0), last = '';
      for (let i = 1; i <= N; i++) {
        const cur = pt(i / N * Math.PI * 2);
        const side = prev[2] + cur[2] >= 0 ? 'F' : 'B';
        const seg = (side === last ? '' : `M${f2(prev[0])} ${f2(prev[1])}`) + `L${f2(cur[0])} ${f2(cur[1])}`;
        if (side === 'F') dF += seg; else dB += seg;
        last = side; prev = cur;
      }
    };
    if (ks > 0) {
      for (let k = 0; k < MERIDIANS; k++) {
        const lon = spin + k * Math.PI / MERIDIANS, sl = Math.sin(lon), cl = Math.cos(lon);
        curve(t => proj(Math.cos(t) * sl, Math.sin(t), Math.cos(t) * cl));
      }
      PARALLELS.forEach(lat => curve(t => geo(lat, t)));
    }
    wireFront.setAttribute('d', dF || 'M0 0');
    wireBack.setAttribute('d', dB || 'M0 0');
    const km = range(ease.out(range(p, 0.18, 0.62)), 0, 0.4);
    wireFront.style.opacity = f2(km);
    wireBack.style.opacity = f2(km);

    const hs = 9 * S * ease.out(range(p, 0.08, 0.2));
    hub.setAttribute('x', f2(cx - hs / 2)); hub.setAttribute('y', f2(cy - hs / 2));
    hub.setAttribute('width', f2(hs)); hub.setAttribute('height', f2(hs));

    NODE_GEO.forEach(([lat, lon], j) => {
      const [nx, ny, z] = geo(lat, lon + spin);
      const depth = (z + 1) / 2; // 0 far side … 1 facing us
      const k = ease.io(range(p, 0.36 + j * 0.032, 0.6 + j * 0.032));
      spokes[j].setAttribute('x1', f2(cx)); spokes[j].setAttribute('y1', f2(cy));
      spokes[j].setAttribute('x2', f2(lerp(cx, nx, k))); spokes[j].setAttribute('y2', f2(lerp(cy, ny, k)));
      spokes[j].style.opacity = k > 0 ? f2(lerp(0.15, 1, depth)) : 0;

      const ns = 7 * S * lerp(0.4, 1.15, depth) * ease.out(range(k, 0.8, 1));
      nodes[j].setAttribute('x', f2(nx - ns / 2)); nodes[j].setAttribute('y', f2(ny - ns / 2));
      nodes[j].setAttribute('width', f2(ns)); nodes[j].setAttribute('height', f2(ns));
      nodes[j].style.opacity = f2(lerp(0.25, 1, depth));

      const lo = ease.out(range(p, 0.5 + j * 0.03, 0.66 + j * 0.03));
      labels[j].setAttribute('x', f2(nx));
      labels[j].setAttribute('y', f2(ny + (ny < cy ? -12 * S : 22 * S) + (1 - lo) * 6 * S));
      labels[j].style.opacity = f2(lo * lerp(0.1, 1, depth * depth));
      labels[j].style.fontSize = f2(14 * S * lerp(0.75, 1.05, depth)) + 'px';

      // supply pulses travelling hub → node once the spoke is drawn
      const live = range(k, 0.95, 1);
      const fr = ((now / 2600) + j * 0.137) % 1;
      const ps = 4 * S * lerp(0.6, 1, depth);
      pulses[j].setAttribute('x', f2(lerp(cx, nx, fr) - ps / 2));
      pulses[j].setAttribute('y', f2(lerp(cy, ny, fr) - ps / 2));
      pulses[j].setAttribute('width', f2(ps)); pulses[j].setAttribute('height', f2(ps));
      pulses[j].style.opacity = f2(live * Math.sin(Math.PI * fr) * 0.85 * lerp(0.3, 1, depth));
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
    // once fully open, take the panels out of paint: some browsers (Safari)
    // can leave a stale layer of a panel that slid out of the clipped stage
    panelL.style.visibility = panelR.style.visibility = k >= 0.999 ? 'hidden' : '';
    // mobile sizes the panels inline; clear that again after a resize to desktop
    if (mobile) { panelL.style.width = cxu + 'px'; panelR.style.left = cxu + 'px'; }
    else { panelL.style.width = panelR.style.left = ''; }

    const kg = ease.io(range(p, 0.1, 0.68));
    const gl = mobile ? lerp(cxu, 20, kg) : lerp(cxu, 381 * U, kg);
    const gr = mobile ? lerp(cxu, W - 20, kg) : lerp(cxu, 1132 * U, kg);
    guideL.style.transform = `translate3d(${f2(gl - cxu)}px, 0, 0)`;
    guideR.style.transform = `translate3d(${f2(gr - cxu)}px, 0, 0)`;
    const kc = range(p, 0.12, 0.42);
    const gc = Math.round(lerp(207, 245, kc));
    const ga = lerp(1, mobile ? 0 : 0.24, kc);
    guideL.style.background = guideR.style.background = `rgba(${gc},${gc},${gc},${ga.toFixed(3)})`;

    splitStage.dataset.theme = k > 0.45 ? 'dark' : 'light';
    splitLabel.style.opacity = f2(range(p, 0.5, 0.7));
    splitRule.style.transform = `scaleX(${ease.out(range(p, 0.5, 0.86)).toFixed(4)})`;
    splitTitle.style.transform = `translate3d(0, ${f2((1 - ease.out(range(p, 0.46, 0.84))) * 110)}%, 0)`;
  }, 0.1);

  // Job rows open the description tab from the right
  const jobtab = $('.jobtab');
  const jobtabClose = $('.jobtab__close');
  let jobOpener = null;
  function openJob(job) {
    const btn = $('.job__row', job);
    $('.jobtab__title').textContent = $('.job__title', job).textContent;
    $('.jobtab__sub').textContent = $('.job__sub', job).textContent;
    $('.jobtab__loc').textContent = $('.job__loc', job).textContent;
    $('.jobtab__desc').textContent = $('.job__desc', job).textContent;
    $('.jobtab__apply').href = $('.job__apply', job).href;
    $$('.job__row[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    btn.setAttribute('aria-expanded', 'true');
    jobOpener = btn;
    jobtab.classList.add('is-open');
    jobtab.removeAttribute('inert');
    jobtab.setAttribute('aria-hidden', 'false');
    root.style.overflow = 'hidden';
    jobtabClose.focus({ preventScroll: true });
  }
  function closeJob() {
    if (!jobtab.classList.contains('is-open')) return;
    jobtab.classList.remove('is-open');
    jobtab.setAttribute('inert', '');
    jobtab.setAttribute('aria-hidden', 'true');
    root.style.overflow = '';
    if (jobOpener) { jobOpener.setAttribute('aria-expanded', 'false'); jobOpener.focus({ preventScroll: true }); }
  }
  $$('.job').forEach(job => $('.job__row', job).addEventListener('click', () => openJob(job)));
  jobtabClose.addEventListener('click', closeJob);
  $('.jobtab__scrim').addEventListener('click', closeJob);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeJob(); });

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
    // the header stays visible here, so skip the footer logo when it would sit under it
    footLogo.style.opacity = f2(!mobile && logoTop < 110 * U ? 0 : lo);
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
