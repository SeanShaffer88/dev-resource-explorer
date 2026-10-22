import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { validateCatalog, prepareCatalog, categoryCounts } from '../site/catalog.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRepository = 'https://github.com/SeanShaffer88/useful-dev-resources';
const readOptional = async path => {
  try { return await readFile(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};
const normalizeLicense = text => text.replaceAll('\r\n', '\n').trim();

export async function syncCatalog({ root = projectRoot, source, ref = '', date, fetcher = fetch } = {}) {
  let commit = ref;
  const importedOn = date || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(importedOn)) throw new Error('Date must use YYYY-MM-DD');
  if (commit && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Ref must be a full 40-character commit SHA');

  let bytes, license;
  if (source) {
    const git = parameters => execFileSync('git', ['-C', source, ...parameters], {
      maxBuffer: 20 * 1024 * 1024, windowsHide: true
    });
    commit ||= git(['rev-parse', 'HEAD']).toString().trim();
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid source commit');
    bytes = git(['show', `${commit}:resources.json`]);
    license = git(['show', `${commit}:LICENSE`]);
  } else {
    const fetchBytes = async url => {
      const response = await fetcher(url, {
        headers: { 'User-Agent': 'dev-resource-explorer-catalog-sync' },
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error(`Catalog download failed: HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    };
    if (!commit) {
      const data = JSON.parse((await fetchBytes('https://api.github.com/repos/SeanShaffer88/useful-dev-resources/commits/main')).toString());
      commit = data.sha;
    }
    if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid remote source commit');
    [bytes, license] = await Promise.all(['resources.json', 'LICENSE'].map(path =>
      fetchBytes(`https://raw.githubusercontent.com/SeanShaffer88/useful-dev-resources/${commit}/${path}`)
    ));
  }

  // Validate every downloaded input before changing the last known good snapshot.
  const entries = validateCatalog(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')));
  const resources = prepareCatalog(entries);
  const approvedLicense = await readFile(resolve(projectRoot, 'LICENSE'), 'utf8');
  if (normalizeLicense(license.toString()) !== normalizeLicense(approvedLicense)) {
    throw new Error('Upstream license changed; review and update the approved LICENSE before importing');
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  const dataDirectory = resolve(root, 'site/data');
  const [oldBytes, oldLicense, oldMetadataBytes] = await Promise.all(
    ['resources.json', 'CATALOG-LICENSE.txt', 'meta.json'].map(path => readOptional(resolve(dataDirectory, path)))
  );
  const oldMeta = oldMetadataBytes ? JSON.parse(oldMetadataBytes.toString('utf8')) : null;
  const counts = { entry_count: entries.length, resource_count: resources.length, category_count: categoryCounts(resources).length };
  const validOldMetadata = oldMeta && oldMeta.source_repository === sourceRepository &&
    /^[a-f0-9]{40}$/.test(oldMeta.source_commit) && /^\d{4}-\d{2}-\d{2}$/.test(oldMeta.imported_on) &&
    oldMeta.sha256 === hash && Object.entries(counts).every(([key, value]) => oldMeta[key] === value);
  if (oldBytes?.equals(bytes) && oldLicense?.equals(license) && validOldMetadata) {
    // A documentation-only upstream commit or a new check date is not a data update.
    return { changed: false, checked_commit: commit, meta: oldMeta };
  }
  const meta = {
    source_repository: sourceRepository, source_commit: commit,
    imported_on: importedOn, ...counts, sha256: hash,
    evidence: 'Catalog import only. Original research dates and review scopes are preserved; this is not a fresh audit of linked resources.'
  };
  await mkdir(dataDirectory, { recursive: true });
  const files = { 'resources.json': bytes, 'CATALOG-LICENSE.txt': license, 'meta.json': JSON.stringify(meta, null, 2) + '\n' };
  for (const [name, content] of Object.entries(files)) await writeFile(resolve(dataDirectory, `${name}.tmp`), content);
  for (const name of Object.keys(files)) await rename(resolve(dataDirectory, `${name}.tmp`), resolve(dataDirectory, name));
  return { changed: true, checked_commit: commit, meta };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!['--source', '--ref', '--date'].includes(flag) || !args[index + 1] || args[index + 1].startsWith('--')) {
      throw new Error('Usage: sync-catalog.mjs [--source CHECKOUT] [--ref COMMIT_SHA] [--date YYYY-MM-DD]');
    }
    options[flag.slice(2)] = args[index + 1];
  }
  const result = await syncCatalog(options);
  console.log(result.changed
    ? `Imported ${result.meta.entry_count} entries, ${result.meta.resource_count} resources, ${result.meta.category_count} categories from ${result.meta.source_commit}.`
    : `Catalog unchanged at ${result.meta.source_commit}; checked upstream ${result.checked_commit}.`);
}
