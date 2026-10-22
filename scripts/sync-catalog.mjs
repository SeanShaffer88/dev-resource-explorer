import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { validateCatalog, prepareCatalog, categoryCounts } from '../site/catalog.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const sourceIndex = args.indexOf('--source');
const refIndex = args.indexOf('--ref');
const dateIndex = args.indexOf('--date');
let commit = refIndex >= 0 ? args[refIndex + 1] : '';
const importedOn = dateIndex >= 0 ? args[dateIndex + 1] : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(importedOn)) throw new Error('Date must use YYYY-MM-DD');
if (commit && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Ref must be a full 40-character commit SHA');
let bytes, license;
if (sourceIndex >= 0) {
  const source = args[sourceIndex + 1];
  if (!source) throw new Error('--source requires a local catalog checkout');
  const git = parameters => execFileSync('git', ['-C', source, ...parameters], { maxBuffer: 20 * 1024 * 1024, windowsHide: true });
  commit ||= git(['rev-parse', 'HEAD']).toString().trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid source commit');
  bytes = git(['show', `${commit}:resources.json`]);
  license = git(['show', `${commit}:LICENSE`]);
} else {
  const fetchBytes = async url => { const response = await fetch(url, { headers: { 'User-Agent': 'dev-resource-explorer-catalog-sync' }, signal: AbortSignal.timeout(30000) }); if (!response.ok) throw new Error(`Catalog download failed: HTTP ${response.status}`); return Buffer.from(await response.arrayBuffer()); };
  if (!commit) {
    const data = JSON.parse((await fetchBytes('https://api.github.com/repos/SeanShaffer88/useful-dev-resources/commits/main')).toString());
    commit = data.sha;
  }
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid remote source commit');
  [bytes, license] = await Promise.all(['resources.json', 'LICENSE'].map(path => fetchBytes(`https://raw.githubusercontent.com/SeanShaffer88/useful-dev-resources/${commit}/${path}`)));
}
const entries = validateCatalog(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')));
const resources = prepareCatalog(entries);
if (!license.toString().includes('MIT License')) throw new Error('Upstream license changed; review before importing');
const meta = {
  source_repository: 'https://github.com/SeanShaffer88/useful-dev-resources', source_commit: commit,
  imported_on: importedOn, entry_count: entries.length, resource_count: resources.length, category_count: categoryCounts(resources).length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  evidence: 'Catalog import only. Original research dates and review scopes are preserved; this is not a fresh audit of linked resources.'
};
await mkdir(resolve(root, 'site/data'), { recursive: true });
await writeFile(resolve(root, 'site/data/resources.json'), bytes);
await writeFile(resolve(root, 'site/data/CATALOG-LICENSE.txt'), license);
await writeFile(resolve(root, 'site/data/meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`Imported ${entries.length} entries, ${resources.length} resources, ${meta.category_count} categories from ${commit}.`);
