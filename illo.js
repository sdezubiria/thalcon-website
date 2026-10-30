/* ==========================================================================
   Thalcon — morphing "Our offer" illustration

   The three Figma drawings share one set of actors that interpolate:
    · 4 quads: two tall plant rectangles → small/large square → 4 stacked
      parallelogram layers (two layers peel out of the squares)
    · 7 arrows: horizontal deliveries → a fan of 3 (the rest converge into
      them) → 2 L-shaped return arrows (a loop)
    · 3 dashed guides: detach from the rectangle edges → scale guides →
      dissolve
    · 7 square dots: merge into two nodes that travel to the corners
   Coordinates are copied from the exported SVGs, in frame space.

   createIllo(svg).render(t, intro, now)
     t      0 = mobility, 1 = scalability, 2 = sustainability
     intro  0–1 draw-in progress
     now    ms timestamp (drives the dash flow)
   ========================================================================== */
(() => {
  'use strict';

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const ease = {
    io: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out: t => 1 - Math.pow(1 - t, 3),
  };
  const f2 = n => Math.round(n * 100) / 100;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, parent) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  const dPath = pts => 'M' + pts.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L');

  function createIllo(illoSvg) {
    const R = (x0, y0, x1, y1) => [[x0, y1], [x0, y0], [x1, y0], [x1, y1]];
    const PG = (yt, yb) => [[55.231, yb], [112.933, yt], [305.27, yt], [247.569, yb]];
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const straight = (a, b) => [a, mid(a, b), b];

    const M_L = R(2.286, 2.286, 108.405, 316.268);
    const M_R = R(239.595, 4.733, 345.714, 318.715);
    const S_small = R(6.079, 94.47, 131.795, 220.529);
    const S_big = R(131.617, 49.839, 346.728, 265.16);

    const QUADS = [
      { s: [M_R, S_big, PG(59.064, 121.646)], o: [0, 0, 1], w: [[0, 0.68], [0.28, 0.78]] },
      { s: [M_R, S_big, PG(111.213, 173.799)], o: [1, 1, 1], w: [[0.04, 0.73], [0.16, 0.66]] },
      { s: [M_L, S_small, PG(163.364, 225.948)], o: [1, 1, 1], w: [[0.08, 0.78], [0.2, 0.7]] },
      { s: [M_L, S_small, PG(215.518, 278.1)], o: [0, 0, 1], w: [[0.12, 0.83], [0.32, 0.82]] },
    ];

    const MY = [42.085, 79.691, 122.186, 164.68, 207.173, 244.355, 276.651];
    const mArrow = i => straight([13.453, MY[i]], [234.76, MY[i]]);
    const A_UP = straight([6.079, 155.589], [121.305, 40.255]);
    const A_DN = straight([6.079, 157.499], [121.302, 272.838]);
    const A_RT = straight([6.079, 157.499], [320.252, 157.502]);
    const A_L1 = [[352.153, 6.182], [10.224, 6.182], [10.227, 242.598]];
    const A_L2 = [[5.848, 315.818], [347.777, 315.818], [347.775, 79.403]];
    const A_GONE = [[6.079, 157.499], [6.3, 157.499], [6.6, 157.499]]; // retracts into its origin dot

    // w: easing window per step [M→S, S→T]. On the second step the arrows that
    // disappear go first, so the layers and the loop can form on a clean canvas.
    const ARROWS = [
      { s: [mArrow(0), A_UP, A_L2], o: [1, 0, 0], dash: 1, w: [[0.12, 0.8], [0, 0.3]] },
      { s: [mArrow(1), A_UP, A_L2], o: [1, 1, 1], dash: 0, w: [[0.18, 0.85], [0, 1]], regrow: 1 },
      { s: [mArrow(2), A_RT, A_GONE], o: [1, 0, 0], dash: 1, w: [[0.15, 0.82], [0, 0.3]] },
      { s: [mArrow(3), A_RT, A_GONE], o: [1, 1, 0], dash: 0, w: [[0.2, 0.86], [0.02, 0.4]] },
      { s: [mArrow(4), A_RT, A_GONE], o: [1, 0, 0], dash: 1, w: [[0.18, 0.84], [0, 0.3]] },
      { s: [mArrow(5), A_DN, A_L1], o: [1, 1, 1], dash: 0, w: [[0.24, 0.92], [0, 1]], regrow: 1 },
      { s: [mArrow(6), A_DN, A_L1], o: [1, 0, 0], dash: 1, w: [[0.21, 0.9], [0, 0.3]] },
    ];

    const GUIDES = [
      { s: [straight([2.286, 2.286], [2.286, 316.268]), straight([6.079, 19.326], [6.079, 295.674]), straight([6.079, 157.4], [6.079, 157.6])], o: [0, 1, 0], w: [[0.08, 0.78], [0, 0.34]] },
      { s: [straight([108.405, 2.286], [108.405, 316.268]), straight([131.795, 0], [131.795, 315]), straight([131.795, 157.4], [131.795, 157.6])], o: [0, 1, 0], w: [[0.13, 0.83], [0.03, 0.37]] },
      { s: [straight([345.714, 4.733], [345.714, 318.715]), straight([346.728, 0], [346.728, 315]), straight([346.728, 157.4], [346.728, 157.6])], o: [0, 1, 0], w: [[0.18, 0.88], [0.06, 0.4]] },
    ];

    const MDY = [41.09, 78.69, 121.19, 163.68, 206.17, 243.36, 275.65];
    const DOT_SIZE = [9.773, 10.16, 10.35];
    const DOTS = MDY.map((y, i) => {
      const a = i <= 3;
      const keep = i === 3 || i === 4;
      return {
        s: [[17.341, y], a ? [5.08, 157.5] : [130.795, 157.5], a ? [9.774, 314.818] : [348.23, 5.182]],
        o: [1, keep ? 1 : 0, keep ? 1 : 0],
        w: [ARROWS[i].w[0], [0.3, 0.62]], // M→S: ride the arrow tail; S→T: reach the corner before the loop draws
      };
    });

    // Build DOM
    const gQuads = svgEl('g', {}, illoSvg);
    const gGuides = svgEl('g', {}, illoSvg);
    const gArrows = svgEl('g', {}, illoSvg);
    const gDots = svgEl('g', {}, illoSvg);
    QUADS.forEach(q => { q.el = svgEl('path', { class: 's', pathLength: 1 }, gQuads); });
    GUIDES.forEach(g => { g.el = svgEl('path', { class: 's', 'stroke-dasharray': '4.935 4.935' }, gGuides); });
    ARROWS.forEach(a => {
      a.el = svgEl('path', { class: 's' }, gArrows);
      if (a.dash) a.el.setAttribute('stroke-dasharray', '4.966 4.966');
      a.head = svgEl('path', { class: 'f', d: 'M-11.314 10.52L-13.068 8.635L-3.777 0L-13.068 -8.637L-11.314 -10.521L0 0Z' }, gArrows);
    });
    DOTS.forEach(d => { d.el = svgEl('rect', { class: 'f' }, gDots); });

    const lerpPt = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    const lerpPts = (A, B, t) => A.map((p, i) => lerpPt(p, B[i], t));
    // Interpolate an actor across states 0→1→2 for global morph value t∈[0,2]
    function sample(actor, t) {
      const k = t >= 2 ? 1 : Math.floor(t);
      const [start, end] = actor.w[k];
      const local = ease.io(range(t - k, start, end));
      return {
        pts: actor.s[k].length && Array.isArray(actor.s[k][0])
          ? lerpPts(actor.s[k], actor.s[k + 1], local)
          : lerpPt(actor.s[k], actor.s[k + 1], local),
        o: lerp(actor.o[k], actor.o[k + 1], local),
        local, k,
      };
    }
    const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Points along a polyline up to fraction g of its length
    function cutPolyline(pts, g) {
      if (g >= 1) return pts;
      const segs = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) { const l = dist(pts[i - 1], pts[i]); segs.push(l); total += l; }
      let rem = total * g;
      const out = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        if (rem >= segs[i - 1]) { out.push(pts[i]); rem -= segs[i - 1]; continue; }
        out.push(lerpPt(pts[i - 1], pts[i], segs[i - 1] ? rem / segs[i - 1] : 0));
        break;
      }
      return out;
    }

    function render(t, intro, now) {
      const march = (now / 1000) * 9; // dash flow, units/sec

      QUADS.forEach((q, i) => {
        const s = sample(q, t);
        const pts = s.pts;
        q.el.setAttribute('d', dPath(pts) + 'Z');
        const draw = ease.io(range(intro, i * 0.06, 0.5 + i * 0.06));
        q.el.setAttribute('stroke-dasharray', draw >= 1 ? 'none' : `${f2(draw)} 1.01`);
        q.el.style.opacity = f2(s.o);
      });

      GUIDES.forEach((g, i) => {
        const s = sample(g, t);
        g.el.setAttribute('d', dPath(s.pts));
        g.el.style.opacity = f2(s.o);
        g.el.setAttribute('stroke-dashoffset', f2(-march % 9.87));
      });

      ARROWS.forEach((a, i) => {
        const s = sample(a, t);
        let full = s.pts;
        let g = 1;
        if (a.regrow === s.k && t > s.k && t < s.k + 1) {
          // retract into the tail, then draw the next shape out of its tail
          const local = t - s.k;
          if (local < 0.5) { full = a.s[s.k]; g = 1 - ease.io(range(local, 0, 0.32)); }
          else { full = a.s[s.k + 1]; g = ease.io(range(local, 0.6, 1)); }
        }
        const grow = g * ease.out(range(intro, 0.22 + i * 0.055, 0.62 + i * 0.055));
        const cut = cutPolyline(full, grow);
        const tip = cut[cut.length - 1];
        // direction of the drawn end; fall back to the whole shape when it is a point
        let from = cut.length > 1 ? cut[cut.length - 2] : full[0];
        if (dist(from, tip) < 0.5) from = dist(full[1], full[2]) > 0.5 ? full[1] : full[0];
        let ux = tip[0] - from[0], uy = tip[1] - from[1];
        const ul = Math.hypot(ux, uy) || 1;
        ux /= ul; uy /= ul;
        let drawn = 0;
        for (let j = 1; j < cut.length; j++) drawn += dist(cut[j - 1], cut[j]);
        const back = Math.min(2.79, drawn);
        const line = cut.slice(0, -1).concat([[tip[0] - ux * back, tip[1] - uy * back]]);
        a.el.setAttribute('d', drawn - back > 0.3 ? dPath(line) : '');
        a.el.style.opacity = f2(s.o);
        if (a.dash) a.el.setAttribute('stroke-dashoffset', f2(2.483 - (march % 9.932)));
        const ang = Math.atan2(uy, ux) * 180 / Math.PI;
        a.head.setAttribute('transform', `translate(${f2(tip[0])} ${f2(tip[1])}) rotate(${f2(ang)})`);
        a.head.style.opacity = f2(s.o * range(grow, 0.04, 0.16));
      });

      DOTS.forEach((d, i) => {
        const s = sample(d, t);
        const k = t >= 2 ? 1 : Math.floor(t);
        const size = lerp(DOT_SIZE[k], DOT_SIZE[Math.min(2, k + 1)], s.local);
        const pop = ease.out(range(intro, 0.12 + i * 0.05, 0.32 + i * 0.05));
        const sz = size * pop;
        d.el.setAttribute('x', f2(s.pts[0] - sz / 2));
        d.el.setAttribute('y', f2(s.pts[1] - sz / 2));
        d.el.setAttribute('width', f2(sz));
        d.el.setAttribute('height', f2(sz));
        d.el.style.opacity = f2(s.o);
      });
    }

    return { render };
  }

  window.createIllo = createIllo;
})();
