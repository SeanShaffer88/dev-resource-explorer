import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { prepareCatalog, categoryCounts } from '../site/catalog.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bytes = await readFile(resolve(root, 'site/data/resources.json'));
const raw = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const resources = prepareCatalog(raw);
const meta = JSON.parse(await readFile(resolve(root, 'site/data/meta.json'), 'utf8'));
assert.match(meta.source_commit, /^[a-f0-9]{40}$/);
assert.equal(meta.source_repository, 'https://github.com/SeanShaffer88/useful-dev-resources');
assert.equal(meta.sha256, createHash('sha256').update(bytes).digest('hex'), 'Catalog checksum differs; run the sync command');
assert.equal(meta.entry_count, raw.length);
assert.equal(meta.resource_count, resources.length);
assert.equal(meta.category_count, categoryCounts(resources).length);
assert.ok((await readFile(resolve(root, 'site/data/CATALOG-LICENSE.txt'), 'utf8')).includes('Copyright (c) 2026 Sean Shaffer'));
const html = await readFile(resolve(root, 'site/index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g)) await readFile(resolve(root, 'site', match[1]));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
for (const dir of ['site', 'scripts', 'test']) {
  const inspect = async path => { for (const file of await readdir(path, { withFileTypes: true })) { const target = join(path, file.name); if (file.isDirectory()) await inspect(target); else { const text = await readFile(target, 'utf8'); assert.ok(!/[A-Za-z]:[\\/]Users[\\/]/.test(text), `Local machine path in ${file.name}`); assert.ok(!/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|fc-[a-f0-9]{32}/.test(text), `Potential credential in ${file.name}`); } } };
  await inspect(resolve(root, dir));
}
console.log(`Verified ${resources.length} resources, provenance, licensing, asset paths, unique HTML IDs, and publishable file content.`);
