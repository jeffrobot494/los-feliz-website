// Parses every theme pattern with the block editor's own code and reports blocks it would reject
// ("This block contains unexpected or invalid content"), so a hand edit that breaks a block shows up here
// instead of in front of an editor.
//
// Run from the repo root:  npm --prefix tools/check-blocks ci && node tools/check-blocks/check.mjs [patterns dir]
import globalJsdom from 'global-jsdom';
import { VirtualConsole } from 'jsdom';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { format } from 'node:util';

// A browser-like DOM for the parser. Its own console (CSS it can't parse in inline <style>) stays quiet.
globalJsdom(undefined, { virtualConsole: new VirtualConsole() });

// The CommonJS builds: the ES module builds import block.json without the import attribute Node requires.
const require = createRequire(import.meta.url);
const { parse } = require('@wordpress/blocks');
const { registerCoreBlocks } = require('@wordpress/block-library');
const { registerBlockType } = require('@wordpress/blocks');

const PATTERNS = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '../../theme/lfar/patterns');
const BLOCKS = join(PATTERNS, '../blocks');

// Quiet the editor's own console output, but keep its "Updated Block" notes: a block an old-version migration
// had to fix is accepted, then silently rewritten the next time the page is saved.
const error = console.error;
let migrated = [];
console.log = console.info = console.warn = console.error = (...args) => {
	const msg = format(...args);
	if (msg.startsWith('Updated Block')) migrated.push(msg);
};
registerCoreBlocks();
// The theme's own blocks (blocks/*/block.json) are rendered in PHP, so they save nothing for the editor to compare.
if (existsSync(BLOCKS)) {
	for (const dir of readdirSync(BLOCKS)) {
		const json = join(BLOCKS, dir, 'block.json');
		if (existsSync(json)) {
			const meta = JSON.parse(readFileSync(json, 'utf8'));
			registerBlockType(meta.name, { ...meta, save: () => null });
		}
	}
}

// Patterns are PHP: drop the header and stand in for the inline echoes (image URLs, form ids).
function toMarkup(php) {
	return php
		.replace(/^<\?php[\s\S]*?\?>\s*/, '')
		.replace(/<\?php echo esc_url\( get_theme_file_uri\( '([^']+)' \) \); \?>/g, 'https://example.test/$1')
		.replace(/<\?php[\s\S]*?\?>/g, '0');
}

function* walk(blocks, path = []) {
	for (const [i, b] of blocks.entries()) {
		const here = [...path, `${b.name}#${i + 1}`];
		yield [b, here];
		yield* walk(b.innerBlocks, here);
	}
}

let bad = 0;
for (const file of readdirSync(PATTERNS).filter((f) => f.endsWith('.php')).sort()) {
	migrated = [];
	const blocks = parse(toMarkup(readFileSync(join(PATTERNS, file), 'utf8')));
	let n = 0;
	for (const msg of migrated) {
		bad++;
		error(`${file}: needed a migration (${msg.replace('Updated Block: ', '')}): the editor would rewrite it`);
	}
	migrated = [];
	for (const [b, path] of walk(blocks)) {
		n++;
		if (b.name === 'core/missing' || b.name === 'core/freeform') {
			bad++;
			error(`${file}: ${path.join(' > ')}: not a registered block (${b.attributes.originalName || 'stray HTML'})`);
		} else if (!b.isValid) {
			bad++;
			// The last issue is a summary that dumps the whole block type; the ones before it say what differed.
			const why = (b.validationIssues || []).slice(0, -1).map((v) => format(...v.args)).join(' ');
			error(`${file}: ${path.join(' > ')}: invalid. ${why}`.slice(0, 600));
		}
	}
	process.stdout.write(`${file}: ${n} blocks\n`);
}
if (bad) {
	error(`\n${bad} block(s) the editor would reject or rewrite.`);
	process.exit(1);
}
process.stdout.write('\nAll blocks valid.\n');
