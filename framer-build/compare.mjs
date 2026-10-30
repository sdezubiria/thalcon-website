// Compares the generated Framer component with the original HTML site, pixel by pixel.
//
//   npm run compare                 desktop (1440×900) and phone (390×844)
//   npm run compare -- --only 1440  one viewport width
//   npm run compare -- --self       original against itself: shows the noise floor
//   npm run compare -- --url <url>  a published Framer site instead of the local harness
//
// The component runs in a plain React page (harness/) with a stub for the
// "framer" module. Both pages load in headless Chrome, scroll through the same
// positions, and every pair of screenshots goes through pixelmatch. Pairs that
// differ are saved to .cache/compare/ as original / framer / diff images.
import { createServer } from "node:http"
import { readFile, writeFile, mkdir, rm, copyFile } from "node:fs/promises"
import { join, extname } from "node:path"
import { build } from "esbuild"
import puppeteer from "puppeteer-core"
import { PNG } from "pngjs"
import pixelmatch from "pixelmatch"
import { generate } from "./generate.mjs"

const HERE = new URL(".", import.meta.url).pathname
const SITE = join(HERE, "..")
const OUT = join(HERE, ".cache/compare")
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const VIEWPORTS = [
    { width: 1440, height: 900 },
    { width: 390, height: 844, isMobile: true, hasTouch: true },
]
const only = process.argv.includes("--only") ? Number(process.argv[process.argv.indexOf("--only") + 1]) : null
const SETTLE = 1400 // ms after each scroll: the engine eases toward the target

/* Assets: by default both pages load the same local image files, so any
   difference is in the code. --framer-assets uses the URLs uploaded to Framer. */
const ASSETS = {}
const { readdirSync } = await import("node:fs")
for (const dir of ["assets/img", "assets/video"])
    for (const name of readdirSync(join(SITE, dir))) if (!name.startsWith(".")) ASSETS[`${dir}/${name}`] = `/${dir}/${name}`
const cacheFile = readdirSync(join(HERE, ".cache")).find((f) => f.startsWith("assets-"))
if (process.argv.includes("--framer-assets") && cacheFile) {
    const cache = JSON.parse(await readFile(join(HERE, ".cache", cacheFile), "utf8"))
    for (const [path, { url }] of Object.entries(cache)) ASSETS[path] = url
}
await generate(ASSETS)
await build({
    entryPoints: [join(HERE, "harness/entry.jsx")],
    bundle: true,
    outfile: join(HERE, "harness/out/app.js"),
    jsx: "automatic",
    loader: { ".tsx": "tsx" },
    alias: { framer: join(HERE, "harness/framer-stub.js") },
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "error",
})
await copyFile(join(HERE, "harness/index.html"), join(HERE, "harness/out/index.html"))

/* Serve the repo: / is the original site, /framer-build/harness/out/ the component */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp4": "video/mp4" }
const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname)
    const file = join(SITE, path.endsWith("/") ? path + "index.html" : path)
    try {
        const body = await readFile(file)
        res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" })
        res.end(body)
    } catch {
        res.writeHead(404)
        res.end()
    }
}).listen(0)
const base = `http://localhost:${server.address().port}`

// One browser per page: a background tab would have its animation frames paused
const launch = () => puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--force-device-scale-factor=1"] })
const browsers = [await launch(), await launch()]
const urlArg = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : null
const target = urlArg ?? (process.argv.includes("--self") ? `${base}/index.html` : `${base}/framer-build/harness/out/index.html`)

async function open(url, viewport, browser) {
    const page = await browser.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 })
    await page.waitForSelector(".loader.is-done", { timeout: 20000 }).catch(() => errors.push("loader never finished"))
    await new Promise((r) => setTimeout(r, 2200))
    return { page, errors }
}

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
let worst = 0
const report = []
for (const vp of VIEWPORTS.filter((v) => !only || v.width === only)) {
    const [a, b] = await Promise.all([
        open(`${base}/index.html`, vp, browsers[0]),
        open(target, vp, browsers[1]),
    ])
    const heights = await Promise.all([a, b].map((s) => s.page.evaluate(() => document.documentElement.scrollHeight)))
    report.push(`${vp.width}×${vp.height}: page height original ${heights[0]}, framer ${heights[1]}`)
    for (const s of [a, b]) if (s.errors.length) report.push(`  errors (${s === a ? "original" : "framer"}): ${s.errors.join(" | ")}`)

    const step = Math.round(vp.height * 0.75)
    for (let y = 0, i = 0; y < heights[0]; y += step, i++) {
        const shots = []
        for (const s of [a, b]) {
            await s.page.evaluate((y) => window.scrollTo(0, y), y)
        }
        await new Promise((r) => setTimeout(r, SETTLE))
        for (const s of [a, b]) shots.push(PNG.sync.read(Buffer.from(await s.page.screenshot({ type: "png" }))))
        const [pa, pb] = shots
        const diff = new PNG({ width: pa.width, height: pa.height })
        const n = pixelmatch(pa.data, pb.data, diff.data, pa.width, pa.height, { threshold: 0.1 })
        const ratio = n / (pa.width * pa.height)
        worst = Math.max(worst, ratio)
        const tag = `${vp.width}-${String(i).padStart(2, "0")}-y${y}`
        if (ratio > 0.001) {
            await writeFile(join(OUT, `${tag}-original.png`), PNG.sync.write(pa))
            await writeFile(join(OUT, `${tag}-framer.png`), PNG.sync.write(pb))
            await writeFile(join(OUT, `${tag}-diff.png`), PNG.sync.write(diff))
        }
        report.push(`  y=${String(y).padStart(5)}  ${(ratio * 100).toFixed(2)}% different${ratio > 0.001 ? `  → ${tag}` : ""}`)
    }
    await a.page.close()
    await b.page.close()
}
await Promise.all(browsers.map((b) => b.close()))
server.close()
console.log(report.join("\n"))
console.log(`Worst frame: ${(worst * 100).toFixed(2)}% of pixels differ`)
