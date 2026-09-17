// Scans design/ for HTML pages, writes gallery/manifest.json, and screenshots
// each page into gallery/thumbs/ for the index.html page selector.
import { readdir, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_DIR = path.join(ROOT, 'design');
const OUT_DIR = path.join(ROOT, 'gallery');
const THUMB_DIR = path.join(OUT_DIR, 'thumbs');
const EXCLUDE = new Set(['studio', 'node_modules']);

const toPosix = (p) => p.split(path.sep).join('/');

// "lfar-home-furball-dusk.html" -> "Lfar Home Furball Dusk"
function prettify(name) {
  return name
    .replace(/\.html?$/i, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// Returns a folder node, or null if the folder has no HTML anywhere beneath it.
async function scan(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const folders = [];
  const pages = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE.has(entry.name)) continue;
      const child = await scan(full);
      if (child) folders.push(child);
    } else if (/\.html?$/i.test(entry.name)) {
      const rel = toPosix(path.relative(ROOT, full));
      pages.push({
        title: prettify(entry.name),
        path: rel,
        thumb: 'gallery/thumbs/' + rel.replace(/^design\//, '').replace(/\.html?$/i, '.jpg'),
      });
    }
  }
  if (!folders.length && !pages.length) return null;
  return { name: prettify(path.basename(dir)), path: toPosix(path.relative(ROOT, dir)), folders, pages };
}

function allPages(node) {
  return [...node.pages, ...node.folders.flatMap(allPages)];
}

const tree = (await scan(DESIGN_DIR)) ?? { name: 'Design', path: 'design', folders: [], pages: [] };
const pages = allPages(tree);

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(THUMB_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.5 });
const page = await context.newPage();
for (const p of pages) {
  const out = path.join(ROOT, p.thumb);
  await mkdir(path.dirname(out), { recursive: true });
  try {
    await page.goto(pathToFileURL(path.join(ROOT, p.path)).href, { waitUntil: 'load', timeout: 30000 });
    // Some pages (e.g. the SARA design canvas) render client-side seconds after
    // load, so keep capturing until two consecutive frames match (or we give up).
    let shot;
    const deadline = Date.now() + 12000;
    await page.waitForTimeout(1000);
    while (true) {
      await page.waitForTimeout(750);
      const next = await page.screenshot({ type: 'jpeg', quality: 78 });
      const hasContent = await page.evaluate(() =>
        document.body.innerText.trim().length > 0 || !!document.querySelector('img, svg, canvas, video'));
      if ((hasContent && shot && next.equals(shot)) || Date.now() > deadline) { shot = next; break; }
      shot = next;
    }
    await writeFile(out, shot);
    console.log('✓', p.path);
  } catch (err) {
    console.warn('✗', p.path, '-', err.message);
    p.thumb = null;
  }
}
await browser.close();

await writeFile(
  path.join(OUT_DIR, 'manifest.json'),
  JSON.stringify({ generated: new Date().toISOString(), tree }, null, 2),
);
console.log(`Wrote gallery/manifest.json (${pages.length} pages)`);
