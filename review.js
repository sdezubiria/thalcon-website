/* ==========================================================================
   Review panel — TEST VERSION ONLY. Remove the <script src="review.js"> line
   from index.html before launch.

   A small window (bottom right) with the design-review changes as a
   checklist. Each item jumps to the place on the page where the change can
   be seen; ticks are remembered in this browser. Builds its own markup and
   styles, so nothing else in the site depends on it. The Framer build only
   reads index.html up to illo.js, so this file never reaches Framer.
   ========================================================================== */
(() => {
  'use strict';

  // [label, where to go] — where: [selector, scroll progress through it, extra px]
  const GROUPS = [
    ['General', [
      ['Líneas divisorias más delgadas y grises', ['.intro', 0, -120]],
      ['Nav en Afacad Flux SemiBold, interlineado reducido', ['body', 0, 0]],
      ['Cursor cuadrado que invierte el color y crece sobre links', null],
      ['Favicon: la marca de Thalcon en líneas', null],
      ['Header visible en el footer', ['.foot', 1, 0]],
    ]],
    ['Recorrido', [
      ['Reloj: a 180° se invierte todo, header incluido', ['.clock', 0.5, 0]],
      ['La línea llega llena a “our offer” y pasa a progreso', ['.clock', 1, 0]],
      ['Video real con scroll y dato “~1 acre” al terminar', ['.site', 0.66, 0]],
      ['“Sustainability” sobre la línea al final del video', ['.site', 0.985, 0]],
      ['Sustainability: líneas fijas, título libre del nav', ['.about', 0.05, 0]],
      ['Innovation fija: los nombres suben con fade', ['.innov', 0.35, 0]],
      ['Strategic Relationships: título fijo, logos con parallax', ['.partners', 0.3, 0]],
      ['Nueva sección Scale output: cuadrícula y números', ['.scale', 0.12, 0]],
      ['Globo 3D girando, estados alrededor', ['.nation', 0.75, 0]],
      ['Careers: la línea termina antes de “Work with us”', ['.split', 0.95, 0]],
      ['Tab del puesto, de derecha a izquierda', ['.jobs', 0, 0], 'job'],
    ]],
  ];

  const KEY = 'thalcon-review';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } };
  const state = load(); // { open: bool, done: { id: true } }
  state.done = state.done || {};

  const css = `
  .rv { position: fixed; right: 16px; bottom: 16px; z-index: 90; font-family: "Sometype Mono", ui-monospace, monospace; color: #000; }
  .rv__toggle { display: flex; align-items: center; gap: 10px; margin-left: auto; padding: 10px 14px; background: #fff; border: 1px solid #000; font: 700 12px/1 "Sometype Mono", ui-monospace, monospace; text-transform: uppercase; letter-spacing: .02em; }
  .rv__toggle:hover { background: #000; color: #fff; }
  .rv__count { font-weight: 400; opacity: .6; }
  .rv__panel { position: absolute; right: 0; bottom: calc(100% + 8px); width: 380px; max-height: min(72vh, 620px); display: flex; flex-direction: column; background: #fff; border: 1px solid #000; box-shadow: 0 12px 40px rgba(0,0,0,.18); transform-origin: bottom right; transition: opacity .2s linear, transform .3s cubic-bezier(.16,1,.3,1); }
  .rv:not(.is-open) .rv__panel { opacity: 0; transform: translateY(8px) scale(.98); pointer-events: none; visibility: hidden; }
  .rv__head { display: flex; justify-content: space-between; align-items: baseline; padding: 14px 16px 12px; border-bottom: 1px solid #000; }
  .rv__title { font: 600 18px/1 "Afacad Flux", "Poppins", sans-serif; text-transform: uppercase; }
  .rv__reset { font-size: 11px; font-weight: 400; line-height: 1; text-transform: uppercase; opacity: .6; text-decoration: underline; text-underline-offset: 3px; }
  .rv__reset:hover { opacity: 1; }
  .rv__body { overflow-y: auto; overscroll-behavior: contain; padding: 4px 0 10px; }
  .rv__group { padding: 14px 16px 6px; font-size: 11px; text-transform: uppercase; opacity: .55; }
  .rv__item { display: grid; grid-template-columns: 20px 1fr auto; align-items: start; gap: 10px; padding: 7px 16px; }
  .rv__item:hover { background: #f3f3f3; }
  .rv__check { appearance: none; -webkit-appearance: none; width: 14px; height: 14px; margin: 2px 0 0; border: 1px solid #000; background: #fff; }
  .rv__check:checked { background: #000; box-shadow: inset 0 0 0 2px #fff; }
  .rv__label { font: 400 13px/1.3 "Inclusive Sans", system-ui, sans-serif; text-align: left; }
  .rv__item.is-done .rv__label { opacity: .45; text-decoration: line-through; }
  .rv__go { font-size: 11px; font-weight: 700; line-height: 1; text-transform: uppercase; padding: 3px 0 2px; border-bottom: 1px solid currentColor; white-space: nowrap; }
  .rv__go:hover { opacity: .6; }
  .rv__num { font-size: 11px; opacity: .5; margin-right: 4px; }
  @media (max-width: 819px) {
    .rv { left: 12px; right: 12px; bottom: 12px; }
    .rv__panel { width: auto; left: 0; }
  }`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'rv';
  root.innerHTML = `
    <div class="rv__panel" role="dialog" aria-label="Checklist de revisión" id="rv-panel">
      <div class="rv__head"><span class="rv__title">Cambios a revisar</span><button class="rv__reset" type="button">Desmarcar todo</button></div>
      <div class="rv__body"></div>
    </div>
    <button class="rv__toggle" type="button" aria-expanded="false" aria-controls="rv-panel">Revisión <span class="rv__count"></span></button>`;
  document.body.appendChild(root);

  const body = root.querySelector('.rv__body');
  const toggle = root.querySelector('.rv__toggle');
  const count = root.querySelector('.rv__count');
  const items = [];
  let n = 0;

  GROUPS.forEach(([group, list]) => {
    const h = document.createElement('p');
    h.className = 'rv__group';
    h.textContent = group;
    body.appendChild(h);
    list.forEach(([label, where, action]) => {
      const id = 'i' + (n++);
      const row = document.createElement('div');
      row.className = 'rv__item';
      row.innerHTML = `
        <input class="rv__check" type="checkbox" id="rv-${id}">
        <label class="rv__label" for="rv-${id}"><span class="rv__num">${String(n).padStart(2, '0')}</span></label>
        ${where ? '<button class="rv__go" type="button">Ver</button>' : '<span></span>'}`;
      row.querySelector('.rv__label').append(label);
      const check = row.querySelector('.rv__check');
      check.checked = !!state.done[id];
      check.addEventListener('change', () => {
        if (check.checked) state.done[id] = true; else delete state.done[id];
        save(state); refresh();
      });
      if (where) row.querySelector('.rv__go').addEventListener('click', () => go(where, action));
      body.appendChild(row);
      items.push({ id, row, check });
    });
  });

  function refresh() {
    let done = 0;
    items.forEach(it => { it.row.classList.toggle('is-done', it.check.checked); if (it.check.checked) done++; });
    count.textContent = `${done}/${items.length}`;
  }

  function setOpen(open) {
    root.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    state.open = open;
    save(state);
  }

  // Jump straight to the point in the scroll where the change shows; the
  // pinned scenes then ease into place on their own
  function go([sel, p, extra], action) {
    if (document.body.classList.contains('is-loading')) return;
    const jobtab = document.querySelector('.jobtab.is-open .jobtab__close');
    if (jobtab) jobtab.click();
    const el = document.querySelector(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const y = r.top + window.scrollY + p * Math.max(0, r.height - window.innerHeight) + extra;
    window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
    if (action === 'job') setTimeout(() => { const b = document.querySelector('.job__row'); if (b) b.click(); }, 500);
  }

  toggle.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
  root.querySelector('.rv__reset').addEventListener('click', () => {
    state.done = {};
    items.forEach(it => { it.check.checked = false; });
    save(state); refresh();
  });
  document.addEventListener('keydown', e => {
    // only when you're in the panel, so Esc on the job tab doesn't close it too
    if (e.key === 'Escape' && root.classList.contains('is-open') && root.contains(document.activeElement)) setOpen(false);
  });

  refresh();
  setOpen(!!state.open);
})();
