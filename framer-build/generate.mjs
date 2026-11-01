// Builds the ThalconSite Framer component from the site's own files:
// index.html (markup), styles.css, main.js and illo.js.
//
//   node generate.mjs --check   verify the default content reproduces index.html
//
// deploy.mjs calls generate() with the uploaded asset URLs.
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { defaults } from "./src/defaults.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const SITE = join(HERE, "..")
const read = (p) => readFile(join(SITE, p), "utf8")

// Same Google Fonts request as the <head> of index.html
const FONTS =
    '@import url("https://fonts.googleapis.com/css2?family=Afacad+Flux:wght@600;800&family=Inclusive+Sans:wght@300;400;500;600&family=Poppins:wght@600;800&family=Sometype+Mono:wght@400;700&display=swap");\n'

/* -------------------------------------------------------------------------- */
/* Markup                                                                      */
/* -------------------------------------------------------------------------- */

// Index range of the content inside the element whose opening tag is `open`
function inner(html, open, from = 0) {
    const at = html.indexOf(open, from)
    if (at < 0) throw new Error(`index.html: can't find ${open}`)
    const tag = open.match(/^<(\w+)/)[1]
    const start = at + open.length
    const re = new RegExp(`<\\/?${tag}\\b`, "g")
    re.lastIndex = start
    let depth = 1
    for (let m; (m = re.exec(html)); ) {
        depth += m[0][1] === "/" ? -1 : 1
        if (depth === 0) return [start, m.index]
    }
    throw new Error(`index.html: ${open} isn't closed`)
}

// Exact attribute value to swap for a slot: [text before value, value]
function attr(html, before, value) {
    const at = html.indexOf(before + value)
    if (at < 0) throw new Error(`index.html: can't find ${before}${value}`)
    return [at + before.length, at + before.length + value.length]
}

// Splits the <body> into fixed strings and named slots for the editable parts
export async function segments() {
    const page = await read("index.html")
    const body = page.slice(page.indexOf('<body class="is-loading">') + '<body class="is-loading">'.length, page.indexOf('<script src="illo.js">'))
    const tracks = inner(body, '<div class="stats__track">')
    const regions = [
        ["statsValues", tracks],
        ["statsCaptions", inner(body, '<div class="stats__track">', tracks[1])],
        ["statsImage", attr(body, '<img class="about__img" src="', "assets/img/aerial-tracks.jpg")],
        ["heroVideo", attr(body, '<source src="', "assets/video/thalcon-hero.mp4")],
        ["heroPoster", attr(body, 'poster="', "assets/img/hero-poster.jpg")],
        ["siteVideo", attr(body, '<source src="', "assets/video/site-aerial.mp4")],
        ["sitePoster", attr(body, 'poster="', "assets/img/site-aerial.jpg")],
        ["states", inner(body, '<ul class="nation__states" hidden>')],
        ["innovLogos", inner(body, '<div class="innov__logos" aria-hidden="true">')],
        ["innovItems", inner(body, '<ol class="innov__list">')],
        ["partners", inner(body, '<ul class="partners__grid">')],
        ["jobs", inner(body, '<ul class="jobs__list">')],
    ].sort((a, b) => a[1][0] - b[1][0])

    const parts = []
    let pos = 0
    for (const [slot, [a, b]] of regions) {
        parts.push(body.slice(pos, a), { slot, original: body.slice(a, b) })
        pos = b
    }
    parts.push(body.slice(pos).replace(/\s+$/, "\n"))
    return parts
}

const withAssets = (s, ASSETS) => s.replace(/assets\/(?:img|video)\/[\w.-]+/g, (p) => ASSETS[p] ?? p)

/* -------------------------------------------------------------------------- */
/* Styles: scope everything to .tc-site so Framer's own UI is left alone       */
/* -------------------------------------------------------------------------- */

function close(css, open) {
    let depth = 0
    for (let i = open; i < css.length; i++) {
        if (css[i] === "{") depth++
        else if (css[i] === "}" && --depth === 0) return i
    }
    throw new Error("styles.css: unbalanced braces")
}

function scopeSelector(sel) {
    return sel
        .split(",")
        .map((s) => s.trim())
        .map((s) => {
            if (/^(:root|html|body)\b/.test(s)) return s
            // .is-loading / .is-intro live on <body>, outside the component
            const m = s.match(/^(\.is-(?:loading|intro))(\s.*)$/)
            if (m) return `body${m[1]} .tc-site${m[2]}`
            return `.tc-site ${s}`
        })
        .join(", ")
}

export function scopeCss(css) {
    css = css.replace(/\/\*[\s\S]*?\*\//g, "")
    let out = ""
    let i = 0
    while (i < css.length) {
        const brace = css.indexOf("{", i)
        if (brace < 0) break
        const prelude = css.slice(i, brace).trim()
        const end = close(css, brace)
        const body = css.slice(brace + 1, end)
        if (/^@(media|supports)/.test(prelude)) out += `${prelude} {\n${scopeCss(body)}}\n`
        else if (prelude.startsWith("@")) out += `${prelude} {${body}}\n`
        else out += `${scopeSelector(prelude)} {${body}}\n`
        i = end + 1
    }
    return out
}

/* -------------------------------------------------------------------------- */
/* Scripts                                                                     */
/* -------------------------------------------------------------------------- */

function replaceOnce(src, from, to, file) {
    const n = src.split(from).length - 1
    if (n !== 1) throw new Error(`${file}: expected one "${from}", found ${n}`)
    return src.replace(from, to)
}

async function engine() {
    let js = await read("main.js")
    // The IIFE becomes the body of boot(ctx); requestAnimationFrame comes from
    // ctx so the loop stops when the component unmounts
    js = replaceOnce(js, "\n(() => {\n", "\nconst { requestAnimationFrame, createIllo } = ctx;\n", "main.js")
    js = js.replace(/\}\)\(\);\s*$/, "")
    js = replaceOnce(js, "window.createIllo(", "createIllo(", "main.js")
    return js
}

async function illo() {
    let js = await read("illo.js")
    js = replaceOnce(js, "window.createIllo = createIllo;", "return createIllo;", "illo.js")
    return js.replace(/\}\)\(\);\s*$/, "})()")
}

/* -------------------------------------------------------------------------- */
/* Check + generate                                                            */
/* -------------------------------------------------------------------------- */

async function slotFns(ASSETS) {
    const code = await readFile(join(HERE, "src/slots.js"), "utf8")
    return new Function("ASSETS", `${code}\nreturn SLOTS`)(ASSETS)
}

const norm = (s) => s.replace(/&nbsp;/g, " ").replace(/>\s+</g, "><").replace(/\s+/g, " ").trim()

// Renders every slot with the default content and compares it to index.html
export async function check() {
    const identity = new Proxy({}, { get: (_, p) => p })
    const parts = await segments()
    const SLOTS = await slotFns(identity)
    const props = defaults(identity)
    const problems = []
    for (const part of parts) {
        if (typeof part === "string") continue
        const got = norm(SLOTS[part.slot](props))
        const want = norm(part.original)
        if (got !== want) problems.push(`${part.slot}\n  want: ${want}\n  got:  ${got}`)
    }
    return problems
}

export async function generate(ASSETS = {}) {
    const problems = await check()
    if (problems.length) throw new Error(`Default content doesn't match index.html:\n${problems.join("\n")}`)

    const parts = (await segments()).map((p) => (typeof p === "string" ? withAssets(p, ASSETS) : { slot: p.slot }))
    const css = FONTS + scopeCss(await read("styles.css"))
    const slots = await readFile(join(HERE, "src/slots.js"), "utf8")
    const template = await readFile(join(HERE, "src/ThalconSite.template.tsx"), "utf8")
    const fill = {
        __CSS__: JSON.stringify(css),
        __SEGMENTS__: JSON.stringify(parts),
        __ASSETS__: JSON.stringify(ASSETS, null, 4),
        __SLOTS__: slots,
        __ILLO__: await illo(),
        __ENGINE__: await engine(),
        __DEFAULTS__: JSON.stringify(defaults(ASSETS), null, 4),
    }
    let code = template
    for (const [k, v] of Object.entries(fill)) code = replaceOnce(code, k, () => v, "template")
    await mkdir(join(HERE, "generated"), { recursive: true })
    await writeFile(join(HERE, "generated/ThalconSite.tsx"), code)
    return code
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const problems = await check()
    if (problems.length) {
        console.log(problems.join("\n"))
        process.exit(1)
    }
    await generate()
    console.log("Default content matches index.html; wrote generated/ThalconSite.tsx")
}
