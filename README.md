# Los Feliz Animal Rescue — Website

The new website for Los Feliz Animal Rescue (LFAR): a custom WordPress block theme, plus the design
mockups it was built from.

- **`theme/lfar/`** — the WordPress theme. This is the site, and the source of truth for it.
- **`design/`** — the mockups and design explorations (static HTML), browsable in the client gallery.
- **`tools/check-blocks/`** — checks that the theme's page patterns still pass the block editor's validation.

The theme runs on **WordPress 7.1** with the **Fluent Forms** plugin. No host has been chosen yet;
development happens on a local WordPress site made with [Local](https://localwp.com/).

## What the site does

Six main pages (Home, About, Adopt, Get Involved, Contact, Donate), each built from a theme pattern
(`theme/lfar/patterns/page-*.php`) with its own stylesheet and script (`assets/css/<page>.css`,
`assets/js/<page>.js`).

| Feature | Where it comes from | Where it's edited |
| --- | --- | --- |
| Page text and images | Page patterns, then the page itself once saved | Pages → *page* in the block editor |
| Forms: adoption, foster, volunteer, contact, newsletter | Fluent Forms, placed with `[lfar_form name="…"]` | Fluent Forms → All Forms |
| Featured pet (Adopt) | The **Featured pet** block, filled from LFAR's Petfinder listings | Adopt page: click the card → **Choose pet** |
| Full list of adoptable animals (Adopt) | Petfinder's pet list widget (`<pet-scroller>`, org CA3083) | On Petfinder |
| News, events, Happy Tales | LFAR's Instagram, read hourly (`inc/instagram.php`) | Settings → LFAR Instagram |
| Donation form (Home, Donate) | LFAR's Donorbox form, embedded | In Donorbox |

A few things worth knowing before you edit:

- **Sections are locked to content only.** In the editor you can change text and swap images, but not
  delete or rearrange the blocks that hold a section together. To change a section's structure, use
  **Edit pattern** on its toolbar (WordPress 7.1's name for unlocking it), or edit its pattern in the theme.
- **A page follows its pattern until someone saves it.** The six pages were created holding just a
  reference to their pattern, so theme changes show up on them right away. The first time a page is
  saved in the editor, WordPress stores its own copy of the content, and later changes to that page's
  pattern no longer reach it.
- **Forms are found by their title.** The site looks up each form by its exact Fluent Forms title:
  *Adoption application*, *Foster application*, *Volunteer sign-up*, *Contact*, *Newsletter sign-up*.
  Renaming one makes it disappear from its page. The adoption form's `animal_name` field and
  `animal_kind` choices (Dog, Cat, Other) must also keep their names: the Apply buttons fill them in.
- **The featured pet reads an undocumented Petfinder feed.** Petfinder retired its public API in
  December 2025, so `blocks/featured-pet/petfinder.js` uses the feed behind Petfinder's own widget.
  If Petfinder changes it, only the picker in the editor breaks; the card keeps showing the last pet
  chosen. Once that pet leaves Petfinder's adoptable list, the card shows **Adopted!**.
- **Never commit the Instagram token.** It lives in the `lfar_ig_token` option, or on production in
  `wp-config.php` as `define( 'LFAR_IG_TOKEN', '…' );`.

## Setting up WordPress locally (for collaborators)

You need [Local](https://localwp.com/) (free, Windows/macOS/Linux) and a clone of this repo. There are
two ways to get a working site: from a copy of the existing one (recommended), or from scratch.

### Option A: import a copy of the existing site (recommended)

This gets you everything: the pages, the dashboard, the Fluent Forms forms, the Instagram settings
and the editor exactly as they are now.

1. **The site owner exports it.** In Local, right-click the *los-feliz-animal-rescue* site →
   **Export**. Local saves a `.zip` of the site's files and database.
   Send it privately (Drive, Dropbox), **not** through git: it contains the Instagram token, user
   accounts and any test form entries.
2. **Import it.** In Local, use **File → Import Site** (or drag the `.zip` onto the Local window) and
   follow the prompts. Keep the domain `los-feliz-animal-rescue.local` or pick your own.
3. **Point the theme at your clone,** so edits you make in the repo show up on the site right away.
   Delete the imported `wp-content/themes/lfar` folder and link your clone's `theme/lfar` in its place.
   In Local, **Go to site folder** opens the site; the themes folder is `app/public/wp-content/themes/`.

   macOS / Linux:
   ```sh
   rm -rf ~/"Local Sites/los-feliz-animal-rescue/app/public/wp-content/themes/lfar"
   ln -s ~/path/to/los-feliz-website/theme/lfar ~/"Local Sites/los-feliz-animal-rescue/app/public/wp-content/themes/lfar"
   ```
   Windows (PowerShell):
   ```powershell
   $themes = "$HOME\Local Sites\los-feliz-animal-rescue\app\public\wp-content\themes"
   Remove-Item -Recurse -Force "$themes\lfar"
   New-Item -ItemType Junction -Path "$themes\lfar" -Target "C:\path\to\los-feliz-website\theme\lfar"
   ```
   If you move the repo later, the link breaks and WordPress says *"The stylesheet is missing"*:
   recreate the link.
4. **Log in.** Start the site and click **WP Admin**. To log in without the owner's password, turn on
   **One-click admin** on the site's overview in Local, or ask the owner to add a user for you before
   exporting.

### Option B: start from scratch

Use this if you can't get an export. You'll end up with the same theme and pages, but you'll have to
recreate the forms and the Instagram connection yourself.

1. In Local, create a new site (**+** → *Create a new site*) on WordPress 7.1 and note the admin login.
2. Link the theme as in step 3 of Option A, then activate **LFAR** under Appearance → Themes.
3. Open the dashboard once as an admin. The theme creates the six pages, makes Home the front page and
   adds the *News* and *Happy Tails* categories (one time only; to run it again:
   `wp option delete lfar_seeded`).
4. Install and activate **Fluent Forms** (Plugins → Add New). Then add the five forms with the exact
   titles listed above: either import them (ask the owner for a Fluent Forms → Tools → **Export Forms**
   file and use **Import Forms**), or build them by hand. Until a form exists, editors see
   *Form "…" not found in Fluent Forms* where it belongs and visitors see nothing.
5. Optional: connect Instagram at Settings → LFAR Instagram with the Page token (ask the owner). Without
   it, those sections show the sample posts from the mockups.

## Working on the theme

Edit the files in `theme/lfar/` directly; with the theme linked into Local, a reload shows the change.

```
theme/lfar/
  functions.php          page styles/scripts, form lookup, one-time page setup, block registration
  inc/instagram.php      Instagram feed (Settings → LFAR Instagram)
  patterns/page-*.php    the six pages; header, footer and newsletter patterns
  blocks/featured-pet/   the Featured pet block (editor picker, page markup, "Adopted!" check)
  assets/css, assets/js  one stylesheet and script per page, plus base.css, forms.css, forms.js
  templates/, parts/     block templates and template parts
```

After editing a pattern, check that the block editor will still accept it:

```sh
npm --prefix tools/check-blocks ci
node tools/check-blocks/check.mjs
```

It parses every pattern with WordPress's own block code and fails on any block the editor would reject
("This block contains unexpected or invalid content") or silently rewrite. On a Windows folder from WSL
it's very slow because of disk speed; a copy of `tools/check-blocks` on the Linux disk runs in seconds.
Pass it the patterns folder: `node check.mjs /path/to/theme/lfar/patterns`.

The theme started as a conversion of `design/final-mockups/` by a script that was retired after its
last run (commit `a627e69`, still in git history). Nothing is generated from the mockups anymore, so a
change to a mockup has to be carried into the theme by hand.

## Design mockups and client gallery

`design/` holds the static HTML mockups: open any `.html` file in a browser. `design/final-mockups/`
is the approved design the theme was built from; the other folders are earlier explorations.

`index.html` at the repo root is a browser for everything in `design/` (folders first, then a
thumbnail card per page), published with GitHub Pages.

- **Build locally:** `npm install && npx playwright install chromium`, then `npm run gallery` (writes
  `gallery/manifest.json` and thumbnails; `gallery/` is git-ignored). `npm run preview` builds and
  serves the site locally.
- **Deploy:** `.github/workflows/pages.yml` rebuilds the gallery and publishes `index.html`,
  `gallery/` and `design/` (minus `design/studio/`) on every push to `main`. One-time setup: repo
  **Settings → Pages → Source: GitHub Actions**.

### Design studio

`design/studio/` is a small Node app for iterating on the mockups: it lists the `.html` files in
`design/`, previews one, lets you describe an edit in plain language and has an agent edit the file,
and can save variants without touching the original.

```sh
cd design/studio && npm install && cd ..
node studio/server.mjs          # http://localhost:4590, serving design/
```

`--dir <path>` or `STUDIO_DIR` serves a different folder; `PORT` changes the port.

Edits run on the Claude Agent SDK, authenticated with your Claude Code subscription (never an
`ANTHROPIC_API_KEY`). Run `claude setup-token` and put the token in `design/.env` as
`CLAUDE_CODE_OAUTH_TOKEN=…` (see `.env.example`; `.env` is git-ignored), or export the variable.

- **How edits work:** the agent edits a staged copy of the page with Read and Edit only, confined to
  that copy. The result must pass sanity checks (a full HTML page, half to 3x the original size,
  actually changed) before it **overwrites the file in place**. There's no undo in the app: use git,
  or "Save as new page" first.
- **Speed vs. judgement:** edits default to Claude Sonnet 5 at `low` effort. `STUDIO_MODEL` and
  `STUDIO_EFFORT` (`low`…`max`) change that; `STUDIO_EDIT_TIMEOUT_MS` sets the time limit (3 minutes).
  Edits ignore your personal Claude settings, hooks and MCP servers.
- **Tests:** `node --test studio/test/` (from `design/`), against fixtures with a mock agent; no
  network or subscription needed.

## Project goals and open questions

From the client kickoff (`kickoff-meeting-notes.txt`):

- **Reduce administrative work** — the main problem the site should solve.
- **A clean, easy-to-use site** that reads as professional, partly to support grant applications.
- **Real forms** with conditional and required questions, one per purpose (contact, volunteer, foster,
  adoption, unsubscribe). Now built with Fluent Forms.
- **A CMS the client can use**, including creating new pages without help.
- **Social publishing** — compose a post once and publish across channels.
- **Salesforce** is the system of record; connecting it likely needs an API integration.

Lost & found is out of scope.

Still open:

- Hosting and launch.
- Whether social publishing and the Salesforce connection land in v1 or later.
- How to present "Happy Tails" stories when the before photos are too graphic to use as-is.
