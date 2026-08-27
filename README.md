# Los Feliz Animal Rescue — Website

Design exploration and prototypes for a new Los Feliz Animal Rescue website.

Everything here is a **static HTML mockup** — self-contained pages you open directly in a
browser, with images inlined or sitting alongside them. There is no build step, no
framework, and no backend yet. The goal at this stage is to give the client something
concrete to react to and to settle direction (layout, tone, typography, color) before any
real implementation starts.

## Project goals

From the kickoff conversation (see `kickoff-meeting-notes.txt`), the priorities are:

- **Reduce administrative work** — this is the main problem the site should solve.
- **A clean, easy-to-use site** that reads as professional, partly to support grant applications.
- **A real form system** — roughly four or five separate forms (contact, volunteer, foster,
  adoption, unsubscribe), each supporting conditional and required questions. Google Forms
  is not sufficient; separate forms are wanted over one dynamic mega-form.
- **A CMS the client can actually use**, including creating new pages without help.
- **Social publishing** — compose a post once and publish across channels.
- **Salesforce** is the system of record; connecting to it likely means an API integration
  rather than a no-code connector.

Lost & found is explicitly out of scope.

## What's in here

### Top level

| File | What it is |
| --- | --- |
| `homepage-mockup.html` | Homepage mockup v1 — the first full-page direction. |
| `homepage-mockup-colorful.html` | A brighter, higher-saturation take on the same page. |
| `homepage-mockup-phone.html` | Mobile/phone view of the homepage. |
| `quiet-full-dark-lighter-titlecase.html` | Current front-runner: the "quiet" direction, dark, with lightened type and title-case headings. |
| `kickoff-meeting-notes.txt` | Raw notes from the client kickoff — requirements, red flags, open questions. |
| `three-kittens-1.png` | Source photo used in several hero treatments. |

### `quiet-variations/`

Iterations on the restrained, editorial "quiet" direction — the one built around lines like
*"Small rescue. Stubbornly good numbers."* Each file changes one variable so they can be
compared side by side:

- `homepage-mockup-quiet.html` — the base quiet layout.
- `homepage-mockup-quiet-full.html` — the full-length page.
- `quiet-50-width.html` — narrower measure.
- `quiet-left-nav.html` — left-hand navigation instead of top nav.
- `quiet-full-dark.html` / `quiet-full-dark-lighter.html` — dark-mode treatments.
- `quiet-full-atkinson.html` — Atkinson Hyperlegible for accessibility.
- `quiet-full-comic-sans.html` — deliberate control case for typography discussions.
- `three-kittens-cutout*.png` — cutout hero assets for light and dark backgrounds.

### `kittens-jumping/`

An animated hero concept: cut-out kittens that leap into frame on load.

- `kittens-leap-01.html` — first pass at the animation.
- `kittens-leap-02-buttons.html` — adds the call-to-action buttons.
- `kittens-leap-03-reveal.html` — reworked reveal timing.
- `kittens-leap-04-purple.html` — latest, on the purple palette.
- `*-jumping.png` / `*-sitting.png` — per-kitten source frames (black, orange, white).
- `cutouts/` — the same frames as transparent `.webp` cutouts, used by the animated pages.

## Viewing the mockups

Open any `.html` file directly in a browser. Nothing needs to be installed or served.
If you prefer a local server:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000/homepage-mockup.html
```

## Status and open questions

Still undecided:

- Platform. WordPress is the assumption, but the forms requirement (conditional + required
  questions) needs to be validated against whatever plugin or form system is chosen.
- Whether the CMS and social publishing land in v1 or a later phase.
- How to present "Happy Tails" transformation stories — the before photos are often too
  graphic to use as-is.
- The Donorbox link currently shows different donation options depending on the browser,
  which needs to be fixed.

Next step per the kickoff: deliver a wireframe the client can write content against, since
they'd rather fit copy to a layout than the other way around.
