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

## Design studio

`studio/` is a small in-repo Node app for iterating on these mockups: it lists every
`.html` file in this directory, previews the one you pick, lets you describe an edit in
plain language and have an agent rewrite the file, and saves variants without touching
the original. It has no build step and ships alongside the mockups it edits.

### Running it

```sh
node studio/server.mjs
# Design Studio server listening on http://localhost:4590, serving <repo root>
```

By default it serves the repo root (this directory). Point it at a different directory
with `--dir` or the `STUDIO_DIR` environment variable:

```sh
node studio/server.mjs --dir ../some-other-mockups
# or
STUDIO_DIR=../some-other-mockups node studio/server.mjs
```

`PORT` overrides the default port (4590).

### Minting the subscription token

Edits are driven by the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`, a normal
dependency in `studio/package.json` — `npm install` provisions it), authenticated with
the OAuth token your Claude Code subscription mints — **never an `ANTHROPIC_API_KEY`**.
The app does not read that variable at all; there is no API-credits path. Each edit
consumes your subscription quota, the same as an interactive Claude Code session.

```sh
claude setup-token
# copy the printed token, then create a .env file in the repo root:
cp .env.example .env
# edit .env and paste the token in place of CLAUDE_CODE_OAUTH_TOKEN=
node studio/server.mjs
```

`.env` is gitignored, so it never gets committed. Exporting the variable instead of using
a `.env` file still works too — a real exported `CLAUDE_CODE_OAUTH_TOKEN` always takes
priority over whatever is in `.env`.

If the token isn't set when you try to send an edit, the server reports a distinct
"auth not configured" error (not a generic failure) and the chat panel shows a hint to
run `claude setup-token` and export the variable — the input stays enabled so you can
retry once it's set.

### How edits work

Sending a chat message calls the agent with the current file's contents and your
instruction, running with no tool access (a plain content rewrite, not a coding-agent
session) so it can't wander off into exploring the filesystem. A real edit typically
takes **roughly 1-2 minutes** to come back. The agent's response is validated (non-empty,
starts with `<!doctype`/`<html`, within 3x the original byte size, and actually different
from the input) before it is written — a malformed or garbage response is rejected and
the file is left untouched.
A valid response **overwrites the current file in place**; the preview and the file on
disk never diverge. There is no in-app undo — this repo is version-controlled, so `git
diff` and `git checkout -- <file>` are the recovery path. Use "Save as new page" first if
you want to keep the original and iterate on a copy instead.

While an edit is running, the chat pane now shows live progress (elapsed time and a
running character count) instead of a static "working" state, so you can tell a healthy
1-2 minute rewrite from a stall.

### Pane controls

- **Preview (center).** The maximize button expands the preview to fill the window,
  hiding the pages and chat panes. Press <kbd>Esc</kbd> or click the floating restore
  button to return to the three-pane layout; chat history is untouched either way.
- **Pages (left).** The minimize button collapses the page list to a slim rail; click the
  rail's expand icon to bring it back. The collapsed/expanded state is remembered in
  `localStorage` and survives a reload.

### Running the tests

```sh
node --test studio/test/
```

Tests run against fixtures with a mock agent adapter — no network access and no real
Claude Code subscription required.

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
