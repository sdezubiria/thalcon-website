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
    // one column per stat; the unit, when there is one, goes on its own line
    statsValues: (p) =>
        p.stats
            .map(
                (s, i) => `
              <div class="stat${i === 0 ? " is-active" : ""}"><p class="stat__value">${esc(s.value)}${s.unit ? ` <span class="stat__unit">${esc(s.unit)}</span>` : ""}</p></div>`
            )
            .join("") + "\n            ",
    statsCaptions: (p) =>
        p.stats
            .map(
                (s, i) => `
              <div class="stat${i === 0 ? " is-active" : ""}"><p class="stat__caption">${esc(s.caption)}</p></div>`
            )
            .join("") + "\n            ",
    statsImage: (p) => src(p.statsImage, ASSETS["assets/img/aerial-tracks.jpg"]),
    heroVideo: (p) => esc(p.heroVideo || ASSETS["assets/video/thalcon-hero.mp4"] || "assets/video/thalcon-hero.mp4"),
    heroPoster: (p) => src(p.heroPoster, ASSETS["assets/img/hero-poster.jpg"]),
    siteVideo: (p) => esc(p.siteVideo || ASSETS["assets/video/site-aerial.mp4"] || "assets/video/site-aerial.mp4"),
    sitePoster: (p) => src(p.sitePoster, ASSETS["assets/img/site-aerial.jpg"]),
    // the globe puts one node per state
    states: (p) =>
        p.states
            .map((s) => `
          <li>${esc(s)}</li>`)
            .join("") + "\n        ",
    innovLogos: (p) =>
        p.certifications
            .map((c, i) => {
                // without a logo, the note (or the name) stands in for it
                const img = c.logo?.src ? `<img src="${src(c.logo)}" alt="">` : ""
                const note = c.note || (img ? "" : c.name)
                return `
            <div class="innov__logo${i === 0 ? " is-active" : ""}">${img}${note ? `<small class="innov__logo-note">${esc(note)}</small>` : ""}</div>`
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
          <button class="job__row" aria-haspopup="dialog" aria-expanded="false">
            <span class="job__title">${esc(j.title)}</span>
            <span class="job__meta">
              <span class="job__sub">${esc(j.subtitle)}</span>
              <span class="job__loc">${esc(j.location)}</span>
              <svg class="job__arrow" viewBox="0 0 48.3 7.4" aria-hidden="true"><use href="#arrow-path"/></svg>
            </span>
          </button>
          <div class="job__detail" hidden>
            <p class="job__desc">${esc(j.description)}</p>
            <a class="job__apply" href="mailto:${esc(j.email)}?subject=${subject}">Send your CV</a>
          </div>
        </li>`
            })
            .join("") + "\n      ",
}
