# Thalcon on Framer

Scripts that put the Thalcon site into any Framer project, exactly as the HTML version looks and moves.

## How it works

The site isn't rebuilt by hand in Framer. `generate.mjs` takes the site's own files (`index.html`, `styles.css`, `main.js`, `illo.js`) and wraps them into one Framer code component, `ThalconSite`. The markup, styles and scroll engine are the originals, so every animation, colour change and layout matches.

Only two things change in the wrapping:

- The styles are scoped to the component, so Framer's own UI isn't affected.
- `main.js` gets its animation loop from the component, so the loop stops when Framer remounts the component.

The parts the client edits are properties of the component, in Framer's right-hand panel or with on-page editing:

| Property | What it controls |
|---|---|
| Stats | The sustainability slider. Add a stat and the scroll length and dots adjust. |
| Stats photo | The photo next to the stats. |
| Certifications | The Innovation list and its sticky logo. Use a logo, or a wordmark and an optional note. |
| Partners | The partner logo grid. The logo width is in design units (1/1512 of the page). |
| Jobs | The careers accordion. The CV link emails the address given, with the job title in the subject. |
| Hero video | The hero video file. The repo doesn't have `assets/video/thalcon-hero.mp4` yet. |

Everything else (headings, body copy, the animated scenes) comes from `index.html`. To change it, edit the site files and deploy again.

## Setup (once per computer)

```bash
cd framer-build
npm install
```

## Put the site in a Framer project

1. In the Framer project, press Cmd+K and open settings. Under **API Keys**, create a key.
2. In the `.env` file at the repo root, set both values:

   ```
   FRAMER_API_KEY=…
   FRAMER_PROJECT_URL=https://framer.com/projects/…
   ```

3. Deploy:

   ```bash
   npm run deploy -- --replace-page
   ```

   `--replace-page` clears whatever else is on the Home page. Use it for a new project. Later deploys don't need it.

The deploy:
- uploads `assets/`, once per project;
- generates and type-checks the component, then creates or updates the code file;
- puts one full-width instance on the Home page;
- adds Tablet and Phone breakpoints, so phones get device width.

It never publishes. Content the client edited on the instance is kept.

## Move to another project, with the client's edits

```bash
npm run content:export                       # saves content.json from the current project
# switch FRAMER_API_KEY and FRAMER_PROJECT_URL in .env to the new project
npm run deploy -- --replace-page --content content.json
```

Images in `content.json` point at Framer's image CDN, so they keep working in the new project.

## After changing the site files

```bash
npm run check        # default content still reproduces index.html?
npm run compare      # local pixel comparison, desktop and phone
npm run deploy
```

`npm run compare -- --url https://<site>.framer.app` compares a published Framer site with the HTML version. It loads both in headless Chrome, scrolls through the same positions and diffs every pair of screenshots. Frames that differ are saved to `.cache/compare/`.

To publish to the project's free Framer subdomain for that test:

```bash
npm run publish:staging
```

It refuses to run if the project has a custom domain.

## Known differences on Framer

- The free plan shows a "Made in Framer" badge, and Framer adds an on-page editing button. Both are Framer UI, not the site. A paid plan removes the badge.
- On the Framer canvas the scroll engine doesn't run, so the page shows in its finished state. Preview and the live site run the real animation.
