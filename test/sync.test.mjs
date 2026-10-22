import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { syncCatalog } from '../scripts/sync-catalog.mjs';
import { siteFingerprint, deploymentNeeded, publishedBuild, maintenanceNeeded } from '../scripts/prepare-deploy.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = { name: 'Example', url: 'https://example.com/tool', category: 'Tools', purpose: 'A useful library', source: 'general', checked_on: '2026-10-21', review: 'Discovery only', http_status: '' };
const license = await readFile(resolve(project, 'LICENSE'));

async function fixture(run) {
  const directory = await mkdtemp(join(project, '.test-work-sync-'));
  const source = join(directory, 'source'), root = join(directory, 'explorer');
  await mkdir(source); await mkdir(root);
  const git = (...args) => execFileSync('git', ['-C', source, '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Catalog Test'); git('config', 'user.email', 'test@example.invalid');
  git('config', 'core.autocrlf', 'false');
  await writeFile(join(source, '.gitattributes'), '* -text\n');
  await writeFile(join(source, 'LICENSE'), license);
  const bytes = Buffer.from('\uFEFF' + JSON.stringify([entry], null, 2).replaceAll('\n', '\r\n') + '\r\n');
  await writeFile(join(source, 'resources.json'), bytes);
  const commit = () => { git('add', '.'); git('commit', '-m', 'Fixture update'); return git('rev-parse', 'HEAD'); };
  const originalCommit = commit();
  try { await run({ directory, source, root, bytes, git, commit, originalCommit }); }
  finally {
    assert.equal(dirname(resolve(directory)), project);
    assert.ok(directory.startsWith(join(project, '.test-work-sync-')));
    await rm(directory, { recursive: true, force: true });
  }
}

test('repeated imports and documentation-only commits preserve exact bytes, date, and provenance', async () => fixture(async ({ source, root, bytes, originalCommit, commit }) => {
  const first = await syncCatalog({ source, root, date: '2026-10-22' });
  assert.equal(first.changed, true);
  assert.equal(first.meta.source_commit, originalCommit);
  assert.deepEqual(await readFile(join(root, 'site/data/resources.json')), bytes);
  assert.equal(first.meta.sha256, createHash('sha256').update(bytes).digest('hex'));
  const originalMeta = await readFile(join(root, 'site/data/meta.json'));
  await writeFile(join(source, 'README.md'), 'A documentation update.\n');
  const nextCommit = commit();
  const second = await syncCatalog({ source, root, date: '2026-10-23' });
  assert.equal(second.changed, false);
  assert.equal(second.checked_commit, nextCommit);
  assert.equal(second.meta.source_commit, originalCommit);
  assert.deepEqual(await readFile(join(root, 'site/data/meta.json')), originalMeta);
}));

test('a new catalog entry creates one new snapshot with accurate counts and source commit', async () => fixture(async ({ source, root, commit }) => {
  await syncCatalog({ source, root, date: '2026-10-22' });
  await writeFile(join(source, 'resources.json'), JSON.stringify([entry, { ...entry, name: 'Another', url: 'https://example.com/another', category: 'Another category' }]));
  const head = commit();
  const result = await syncCatalog({ source, root, date: '2026-10-23' });
  assert.equal(result.changed, true); assert.equal(result.meta.entry_count, 2);
  assert.equal(result.meta.resource_count, 2); assert.equal(result.meta.category_count, 2);
  assert.equal(result.meta.source_commit, head); assert.equal(result.meta.imported_on, '2026-10-23');
  assert.equal((await syncCatalog({ source, root, date: '2026-10-24' })).changed, false);
}));

test('invalid catalog and license changes leave the previous snapshot untouched', async () => fixture(async ({ source, root, commit }) => {
  await syncCatalog({ source, root });
  const files = ['resources.json', 'meta.json', 'CATALOG-LICENSE.txt'];
  const before = await Promise.all(files.map(file => readFile(join(root, 'site/data', file))));
  await writeFile(join(source, 'resources.json'), JSON.stringify([{ ...entry, url: 'javascript:alert(1)' }]));
  commit(); await assert.rejects(syncCatalog({ source, root }), /HTTPS/);
  await writeFile(join(source, 'resources.json'), JSON.stringify([entry]));
  await writeFile(join(source, 'LICENSE'), license.toString() + '\nAn unreviewed extra restriction.\n');
  commit(); await assert.rejects(syncCatalog({ source, root }), /license changed/);
  assert.deepEqual(await Promise.all(files.map(file => readFile(join(root, 'site/data', file)))), before);
}));

test('remote downloads pin both files to one resolved commit', async () => fixture(async ({ root, bytes }) => {
  const sha = 'a'.repeat(40), requests = [];
  const fetcher = async url => {
    requests.push(String(url));
    if (String(url).endsWith('/commits/main')) return new Response(JSON.stringify({ sha }));
    assert.ok(String(url).includes(`/${sha}/`));
    return new Response(String(url).endsWith('/LICENSE') ? license : bytes);
  };
  const result = await syncCatalog({ root, fetcher });
  assert.equal(result.meta.source_commit, sha); assert.equal(requests.length, 3);
  const before = await readFile(join(root, 'site/data/meta.json'));
  await assert.rejects(syncCatalog({ root, fetcher: async () => new Response('Unavailable', { status: 503 }) }), /HTTP 503/);
  assert.deepEqual(await readFile(join(root, 'site/data/meta.json')), before);
}));

test('content fingerprints ignore generated metadata but detect changed files and filenames', async () => fixture(async ({ root }) => {
  await mkdir(join(root, 'site'));
  await writeFile(join(root, 'site/index.html'), '<p>Hello</p>');
  const original = await siteFingerprint(join(root, 'site'));
  await writeFile(join(root, 'site/build.json'), '{"app_commit":"new commit"}');
  assert.equal(await siteFingerprint(join(root, 'site')), original);
  await writeFile(join(root, 'site/index.html'), '<p>Updated</p>');
  assert.notEqual(await siteFingerprint(join(root, 'site')), original);
  await writeFile(join(root, 'site/index.html'), '<p>Hello</p>');
  await writeFile(join(root, 'site/another.html'), '');
  assert.notEqual(await siteFingerprint(join(root, 'site')), original);
}));

test('unchanged content skips deployment, stale or missing deployments are retried', () => {
  const hash = 'b'.repeat(64);
  assert.equal(deploymentNeeded(hash, { schema: 1, content_sha256: hash }), false);
  assert.equal(deploymentNeeded(hash, { schema: 1, content_sha256: 'old' }), true);
  assert.equal(deploymentNeeded(hash, null), true);
  assert.equal(deploymentNeeded(hash, { schema: 2, content_sha256: hash }), true);
});

test('unavailable or invalid published manifests request a repair deployment', async () => {
  const url = 'https://example.com/explorer/';
  for (const fetcher of [async () => new Response('', { status: 404 }), async () => new Response('bad JSON'), async () => { throw new Error('offline'); }]) {
    assert.equal(await publishedBuild(url, fetcher), null);
  }
  assert.deepEqual(await publishedBuild(url, async () => new Response('{"schema":1}')), { schema: 1 });
});

test('quiet repositories receive maintenance only after 45 days without commits', () => {
  const now = new Date('2026-10-22T12:00:00Z');
  const seconds = now.getTime() / 1000;
  assert.equal(maintenanceNeeded(seconds - 44 * 86400, now), false);
  assert.equal(maintenanceNeeded(seconds - 45 * 86400, now), true);
  assert.equal(maintenanceNeeded(seconds, now), false);
  assert.throws(() => maintenanceNeeded(NaN, now));
});

test('automatic commit command refuses execution outside Actions main', () => {
  assert.throws(() => execFileSync(process.execPath, [join(project, 'scripts/prepare-deploy.mjs'), '--commit'], {
    env: { ...process.env, GITHUB_ACTIONS: 'false', GITHUB_REF: 'refs/heads/main' },
    windowsHide: true, stdio: 'pipe'
  }), /restricted to GitHub Actions on main/);
});
