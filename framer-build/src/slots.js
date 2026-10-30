/* List templates: turn the editable properties into the same markup index.html has.
   Inlined into ThalconSite.tsx by generate.mjs, which also checks that the default
   properties reproduce index.html exactly. Uses ASSETS (path → uploaded URL). */
const esc = (s) =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
// Line breaks typed in a field become <br>, as in "American <br>Concrete Institute"
const lines = (s) => esc(s).replace(/\n/g, "<br>")
const src = (img, fallback) => esc(img?.src || fallback || "")

const SLOTS = {
    statsValues: (p) =>
        p.stats
            .map(
                (s) => `
              <div class="stat">
                <p class="stat__value">${esc(s.value)} <span class="stat__unit">${esc(s.unit)}</span></p>
                <p class="stat__delta">${esc(s.delta)}</p>
              </div>`
            )
            .join("") + "\n            ",
    statsCaptions: (p) =>
        p.stats
            .map(
                (s) => `
              <div class="stat">
                <p class="stat__caption">${esc(s.caption)}</p>
                <p class="stat__caption stat__caption--muted">${esc(s.deltaCaption)}</p>
              </div>`
            )
            .join("") + "\n            ",
    statsDots: (p) => p.stats.map(() => "<span></span>").join(""),
    statsImage: (p) => src(p.statsImage, ASSETS["assets/img/aerial-tracks.jpg"]),
    heroVideo: (p) => esc(p.heroVideo || ASSETS["assets/video/thalcon-hero.mp4"] || "assets/video/thalcon-hero.mp4"),
    innovLogos: (p) =>
        p.certifications
            .map((c, i) => {
                const inner = c.logo?.src
                    ? `<img src="${src(c.logo)}" alt="">`
                    : `<span class="innov__wordmark">${esc(c.wordmark || c.name)}${c.note ? `<small>${esc(c.note)}</small>` : ""}</span>`
                return `
          <div class="innov__logo${i === 0 ? " is-active" : ""}">${inner}</div>`
            })
            .join("") + "\n        ",
    innovItems: (p) =>
        p.certifications
            .map((c, i) => `
          <li class="innov__item${i === 0 ? " is-active" : ""}">${lines(c.name)}</li>`)
            .join("") + "\n        ",
    partners: (p) =>
        p.partners
            .map((s) => {
                const h = s.logoHeight ? ` height="${esc(s.logoHeight)}"` : ""
                return `
        <li class="partner"><img src="${src(s.logo)}" alt="${esc(s.name)}" width="${esc(s.logoWidth)}"${h} style="width:calc(${Number(s.logoWidth) || 0} * var(--u))"></li>`
            })
            .join("") + "\n      ",
    jobs: (p) =>
        p.jobs
            .map((j) => {
                const subject = encodeURIComponent(`Application — ${j.title}`)
                return `
        <li class="job">
          <button class="job__row" aria-expanded="false">
            <span class="job__title">${esc(j.title)}</span>
            <span class="job__meta">
              <span class="job__sub">${esc(j.subtitle)}</span>
              <span class="job__loc">${esc(j.location)}</span>
              <svg class="job__arrow" viewBox="0 0 48.3 7.4" aria-hidden="true"><use href="#arrow-path"/></svg>
            </span>
          </button>
          <div class="job__panel"><div class="job__panel-inner">
            <p class="job__desc">${esc(j.description)}</p>
            <a class="job__apply" href="mailto:${esc(j.email)}?subject=${subject}">Send your CV</a>
          </div></div>
        </li>`
            })
            .join("") + "\n      ",
}
