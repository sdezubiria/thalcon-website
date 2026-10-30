# Moving the Thalcon site to Framer

Meeting brief, 30 October 2026. Companion to `content-editing.md`, which covers the option of keeping the current site.

> **Update, same day: built.** The site now runs in Framer, and the estimates below are out of date. Instead of rebuilding each section, `framer-build/` wraps the site's own HTML, CSS and JS into one Framer component. That took hours, not weeks. Stats, certifications, partners and jobs are editable component properties. A pixel comparison of the published Framer page against the HTML site matches on desktop and phone, apart from Framer's badge and editing button. One script deploys it to any Framer project. See `framer-build/README.md`.

## Short answer

Yes, it can move to Framer, and the client could then edit stats, jobs and partners without a developer. Expect about two weeks of work, not a few days. Most of that goes into rebuilding the scroll animations as custom code. Framer's built-in effects can't do them, and once they're custom code the client can't edit them anyway.

If the only goal is editing stats, jobs and partners, the current site can get an editor in about a day (see `content-editing.md`). Framer is worth it if the client also wants to change page text and images themselves, and is happy to pay a monthly subscription for that.

## What the site is today

- One page, hand-written HTML, CSS and JavaScript, with no framework or dependencies. About 2,200 lines in total.
- 7 pinned scroll scenes run by a custom scroll engine (`main.js`): loader into header stripes, hero video opening, clock-hand text wipe, morphing "Our offer" drawing (`illo.js`), photo frame spinning into a line, stats slider, nation-wide map, careers split and the footer mark.
- The header changes colour per section and the logo travels from the hero into the header. This touches every section.
- All content is written straight into `index.html`, so stats, jobs and partner logos can only be changed by editing HTML.

## Effort per part

| Part | How it's built in Framer | Estimate |
|---|---|---|
| Intro, innovation list, partners grid, jobs accordion, nav, text reveals | Native Framer layout and effects | 1.5–2 days |
| Partners, jobs, certifications as CMS collections | Native CMS + collection lists | 0.5 day |
| Stats slider | Code component (proof of concept done, see below) | 0.5 day to finish |
| Hero, clock wipe, offer morph, site frame, nation map, careers split, footer mark | One code component each, porting the existing JS to React | 3–4 days |
| Loader, header colour switching, logo docking | Global code component or overrides; the riskiest part, because it spans sections | 1–1.5 days |
| Mobile layouts, performance pass, domain, redirects, QA | | 1.5–2 days |
| **Total** | | **8–11 working days** |

`content-editing.md` estimated 2–4 days plus a day of code components. That figure leaves out most of the scenes. The site has seven bespoke ones, not one or two.

## How the client would edit content in Framer

Framer gives three ways to keep content editable. Each fits a different part of this site.

1. **CMS collections.** A table of items (fields like title, location, description, image) shown through a collection list. The client adds a row and a new job or logo appears. Best for **jobs, partners and certifications**: simple lists with no special animation.
2. **Component properties and variables.** A component exposes fields (text, number, image, a list of items) in the properties panel. Framer's on-page editing lets a Content Editor change text, images and component properties directly on the live site. Best for **one-off text and images** on static sections.
3. **Code components and overrides.** React code inside Framer. Needed when content drives custom behaviour, or when data comes from outside (an API or a spreadsheet). Overrides add behaviour to an existing canvas element.

**For the stats, the best fit is a code component with a list property.** The slider has to know how many stats there are so it can set the scroll length and the swipe points. A list property gives it that count directly. A CMS collection would need a community workaround to feed items into the component, because Framer has no documented way for a code component to read a collection list. Stats are also a short ordered list with no page per item, which is exactly what a list property is for.

## Proof of concept: stats component

`docs/framer/ThalconStats.tsx` is a Framer code component that rebuilds the stats scene:

- The "Stats" property is a list. Each item has a value, unit, comparison figure, two captions and an optional photo.
- Adding a third stat lengthens the pinned section and adds a swipe and a dot automatically. Up to 6.
- Same timing, easing, photo movement and layout as the current site, using the same 1512px design unit. Below 820px the stats stack, as they do now.
- Each stat can have its own photo, which cross-fades as the slides change. Today one photo only pans.

To demo it: in Framer, go to Assets → Code → New component, paste the file in, and drop it on a page. The stats appear in the right-hand panel.

It runs in the Thalcon Test Framer project: pushed with the Server API scripts in `framer-build/`, type-checked by Framer, and tested in the Framer preview at desktop width (pinning, swipe, photo pan and dots all work).

## What the client could change on their own

- Stats: add, remove, reorder, change numbers, captions and photos.
- Jobs, partners and certifications: add or remove items through the CMS.
- Headlines, body text and images on the native sections, through on-page editing.
- Text inside the animated scenes, but only where we expose it as a property.

What they couldn't change: the animations themselves, the layout of the animated scenes, or new sections that behave like them.

## Limits and risks

- **Animations stay custom code.** Moving to Framer doesn't make them editable or easier to maintain. It moves them into a different codebase.
- **Header coupling.** The header reacts to every section underneath it. In Framer the header is a separate layer, so this needs a global code solution. Test it first: it's the most likely thing to slip.
- **Performance.** The current site loads no libraries. Framer adds its React runtime, and seven scroll-driven components on one page need a check on mid-range phones.
- **Publishing workflow.** According to Framer's docs, on-page edits must be published by someone with publish permission. Decide who presses publish: the client's admin or us.
- **SEO and redirects.** Framer outputs static HTML, so search engines can read the page. thalconmix.com is live today, so its old URLs need mapping in Framer's redirects panel before the domain switches.
- **Hosting cost.** Third-party summaries from September–October 2026 put Framer at about $10–30/month per site on annual billing ($15–45 monthly), plus about $10/month per Content Editor seat. A full Editor seat is about $20/month. Check framer.com/pricing before quoting these. Plan bandwidth limits also matter for the hero video, which could be hosted elsewhere. The current site can run on a free static host.
- **Lock-in.** Framer doesn't export a site as code. Leaving later means rebuilding the layout. The code components are plain React and would carry over.

## Options to put to the client

| | Framer | Current site + editor |
|---|---|---|
| Build time | 8–11 days | about 1 day |
| Client can edit | stats, lists, most text and images | stats, jobs, partners, certifications |
| Running cost | Framer plan + editor seats, monthly | free static hosting |
| Animations | rebuilt, still custom code | unchanged |
| Lock-in | Framer | none, plain files in GitHub |

Recommendation: if the client mainly needs to update stats, jobs and partners, keep the current site and add the editor. If they want to own and change most of the page text over time, move to Framer, and budget two weeks for it.

## Sources

- [Framer on-page editing](https://www.framer.com/help/articles/on-page-editing/)
- [Framer roles and permissions](https://www.framer.com/help/articles/member-roles-and-permissions/)
- [Framer property controls](https://www.framer.com/developers/property-controls)
- Pricing (third-party, check against framer.com): [siter.io](https://siter.io/framer-pricing), [createwith.com on the Content Editor role](https://www.createwith.com/tool/framer/updates/framer-cuts-editor-pricing-and-introduces-10-content-editor-role), [vp0.com](https://vp0.com/blogs/framer-pricing-plans-2026/)
