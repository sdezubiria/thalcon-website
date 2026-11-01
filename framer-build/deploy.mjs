// Puts the Thalcon site into a Framer project.
//
//   npm run deploy                       project from FRAMER_PROJECT_URL in .env
//   npm run deploy -- <project url>      any other project (its key in FRAMER_API_KEY)
//   npm run deploy -- --replace-page     also clear everything else off the Home page
//   npm run deploy -- --content c.json   apply content exported with `npm run content:export`
//
// What it does, every run:
//   1. uploads everything in assets/ (once per project, cached in .cache/)
//   2. generates ThalconSite.tsx from the site files and type-checks it in Framer
//   3. creates or updates that code file
//   4. makes sure the Home page shows one full-width ThalconSite instance,
//      with Tablet and Phone breakpoints so phones get device width
//   5. fills the instance's empty image and video fields with the site's own
//      files, so Framer's panel shows the images that are on the page
// Content the client edited on the instance is kept. Nothing is published.
import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises"
import { join, extname, basename } from "node:path"
import { connect } from "framer-api"
import { generate } from "./generate.mjs"
import { defaults } from "./src/defaults.js"

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const projectUrl = args.find((a) => a.startsWith("https://")) ?? process.env.FRAMER_PROJECT_URL
if (!projectUrl) throw new Error("Pass a project URL or set FRAMER_PROJECT_URL in .env")
if (!process.env.FRAMER_API_KEY) throw new Error("Set FRAMER_API_KEY in .env (Framer: Site settings → API Keys)")

const SITE = new URL("..", import.meta.url).pathname
const FILE = "ThalconSite.tsx"
const INSTANCE = "Thalcon site"
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm" }

const framer = await connect(projectUrl, process.env.FRAMER_API_KEY)
try {
    const info = await framer.getProjectInfo()
    console.log(`Project: ${info.name}`)

    /* 1. Assets ------------------------------------------------------------ */
    const cacheFile = join(SITE, "framer-build/.cache", `assets-${info.id ?? info.name}.json`.replace(/[^\w.-]/g, "_"))
    const cache = JSON.parse(await readFile(cacheFile, "utf8").catch(() => "{}"))
    const ASSETS = {}
    const uploaded = {} // path → the asset uploaded in this run (images as images, videos as files)
    const upload = async (path) => {
        if (uploaded[path]) return uploaded[path]
        const input = { bytes: new Uint8Array(await readFile(join(SITE, path))), mimeType: MIME[extname(path).toLowerCase()] }
        const name = basename(path)
        uploaded[path] = path.startsWith("assets/video/")
            ? await framer.uploadFile({ file: input, name })
            : await framer.uploadImage({ image: input, name })
        return uploaded[path]
    }
    for (const dir of ["assets/img", "assets/video"]) {
        for (const name of await readdir(join(SITE, dir)).catch(() => [])) {
            const ext = extname(name).toLowerCase()
            if (!MIME[ext]) continue
            const path = `${dir}/${name}`
            const { size, mtimeMs } = await stat(join(SITE, path))
            const key = `${size}:${mtimeMs}`
            if (cache[path]?.key !== key) {
                cache[path] = { key, url: (await upload(path)).url }
                console.log(`  uploaded ${path}`)
            }
            ASSETS[path] = cache[path].url
        }
    }
    await mkdir(join(SITE, "framer-build/.cache"), { recursive: true })
    await writeFile(cacheFile, JSON.stringify(cache, null, 2))
    console.log(`Assets: ${Object.keys(ASSETS).length}`)

    /* 2–3. Code file ------------------------------------------------------- */
    const code = await generate(ASSETS)
    const errors = (await framer.typecheckCode(FILE, code)).filter((d) => d.category === 1)
    if (errors.length) throw new Error(`Type errors in ${FILE}:\n${errors.map((d) => d.message).join("\n")}`)
    const existing = await framer.getCodeFile(FILE)
    const file = existing ? await existing.setFileContent(code) : await framer.createCodeFile(FILE, code)
    const component = file.exports.find((e) => e.type === "component" && e.name === "ThalconSite")
    console.log(`Code: ${FILE} ${existing ? "updated" : "created"}`)

    /* 4. Home page ---------------------------------------------------------- */
    const pages = await framer.getNodesWithType("WebPageNode")
    const home = pages.find((p) => p.path === "/") ?? pages[0]
    const frames = (await framer.getChildren(home.id)).filter((n) => n.constructor.name === "FrameNode")
    const desktop = frames.find((n) => n.isPrimaryBreakpoint) ?? frames[0]
    await framer.setAttributes(desktop.id, { layout: "stack", stackDirection: "vertical", stackAlignment: "center", gap: "0px", padding: "0px", height: "fit-content" })

    let kids = await framer.getChildren(desktop.id)
    let instance = kids.find((n) => n.name === INSTANCE)
    // A layer pasted from another project keeps running that project's saved
    // copy of the code. Swap it for one from this project's file, with the same
    // content (a backup of the fields goes to .cache/ first).
    const moduleOf = (url) => url?.match(/modules\/([^/]+)\//)?.[1]
    if (instance && moduleOf(instance.insertURL) !== moduleOf(component.insertURL)) {
        const controls = instance.controls ?? {}
        await mkdir(join(SITE, "framer-build/.cache"), { recursive: true })
        await writeFile(join(SITE, "framer-build/.cache", `controls-backup-${Date.now()}.json`), JSON.stringify(controls, null, 2))
        const fresh = await framer.addComponentInstance({ url: component.insertURL, parentId: desktop.id })
        await framer.setAttributes(fresh.id, { controls })
        await framer.removeNodes([instance.id])
        instance = fresh
        console.log("Page: moved Thalcon site onto this project's code file, content kept")
    }
    if (!instance) {
        instance = await framer.addComponentInstance({ url: component.insertURL, parentId: desktop.id })
        console.log("Page: added ThalconSite")
    }
    instance = await framer.setAttributes(instance.id, { name: INSTANCE, position: "relative", width: "100%", height: "fit-content" })
    await framer.setParent(instance.id, desktop.id, 0)

    // With only a Desktop breakpoint Framer serves <meta viewport width=1200> and
    // phones get a shrunken desktop page. Tablet and Phone breakpoints switch it to
    // device width; they show the same instance, the site's CSS does the rest.
    const breakpoints = (await framer.getChildren(home.id)).filter((n) => n.isBreakpoint)
    if (breakpoints.length === 1) {
        for (const bp of await home.getBreakpointSuggestions()) {
            await home.addBreakpoint(desktop.id, bp)
            console.log(`Page: added ${bp.name} breakpoint`)
        }
    }

    if (flag("--replace-page")) {
        const others = (await framer.getChildren(desktop.id)).filter((n) => n.id !== instance.id)
        if (others.length) await framer.removeNodes(others.map((n) => n.id))
        const loose = (await framer.getChildren(home.id)).filter((n) => n.constructor.name === "FrameNode" && !n.isBreakpoint && n.id !== desktop.id)
        if (loose.length) await framer.removeNodes(loose.map((n) => n.id))
        console.log(`Page: removed ${others.length + loose.length} other layers`)
    }

    const contentFile = option("--content")
    if (contentFile) {
        const controls = JSON.parse(await readFile(contentFile, "utf8"))
        await framer.setAttributes(instance.id, { controls })
        console.log(`Content: applied ${contentFile}`)
    }

    /* 5. Image and video fields --------------------------------------------- */
    // Framer shows an empty field for an image or file that only lives in the
    // component's defaults. Put the site's own files into every empty one; a
    // field the client filled is left alone.
    const current = (await framer.getNode(instance.id)).controls ?? {}
    const paths = defaults(new Proxy({}, { get: (_, p) => p })) // images come back as { src: path }
    const changes = {}
    for (const [key, path] of Object.entries({ heroVideo: "assets/video/thalcon-hero.mp4", siteVideo: "assets/video/site-aerial.mp4" })) {
        if (!current[key]) changes[key] = await upload(path)
    }
    for (const [key, value] of Object.entries(paths)) {
        if (value?.src && !current[key]) changes[key] = await upload(value.src)
        if (!Array.isArray(value) || !Array.isArray(current[key])) continue
        let changed = false
        const items = []
        for (const item of current[key]) {
            const original = value.find((o) => o.name === item.name)
            if (item.logo || !original?.logo?.src) items.push(item)
            else {
                items.push({ ...item, logo: await upload(original.logo.src) })
                changed = true
            }
        }
        if (changed) changes[key] = items
    }
    if (Object.keys(changes).length) {
        await framer.setAttributes(instance.id, { controls: changes })
        console.log(`Fields: filled ${Object.keys(changes).join(", ")}`)
    }

    console.log(`Done. Open ${projectUrl} and press Preview. Nothing was published.`)
} finally {
    await framer.disconnect()
}
