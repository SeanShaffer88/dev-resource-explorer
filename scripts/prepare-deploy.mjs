import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataPaths = ['site/data/resources.json', 'site/data/meta.json', 'site/data/CATALOG-LICENSE.txt'];
const maintenancePath = '.github/catalog-sync-activity.json';

export function maintenanceNeeded(lastCommitSeconds, now = new Date()) {
  if (!Number.isFinite(lastCommitSeconds)) throw new Error('Invalid repository activity date');
  return now.getTime() / 1000 - lastCommitSeconds >= 45 * 24 * 60 * 60;
}

export async function siteFingerprint(directory) {
  const hash = createHash('sha256');
  const visit = async (path, prefix = '') => {
    const entries = (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      const relative = prefix + entry.name;
      if (relative === 'build.json') continue;
      if (entry.isSymbolicLink()) throw new Error('Deployable assets must not contain symbolic links');
      if (entry.isDirectory()) await visit(join(path, entry.name), relative + '/');
      else {
        const content = await readFile(join(path, entry.name));
        hash.update(relative + '\0' + content.length + '\0');
        hash.update(content);
      }
    }
  };
  await visit(directory);
  return hash.digest('hex');
}

export function deploymentNeeded(fingerprint, published) {
  return published?.schema !== 1 || published?.content_sha256 !== fingerprint;
}

export async function publishedBuild(siteUrl, fetcher = fetch) {
  try {
    const response = await fetcher(new URL('build.json', siteUrl), {
      headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'dev-resource-explorer-catalog-sync' },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--commit')) throw new Error('Usage: prepare-deploy.mjs [--commit]');
  const git = parameters => execFileSync('git', parameters, { cwd: root, windowsHide: true, encoding: 'utf8' }).trim();
  if (args.includes('--commit')) {
    if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF !== 'refs/heads/main') {
      throw new Error('Automatic commits are restricted to GitHub Actions on main');
    }
    if (git(['diff', '--cached', '--name-only'])) throw new Error('Unexpected staged changes before catalog commit');
    const catalogChanged = Boolean(git(['diff', '--name-only', '--', ...dataPaths]));
    const keepAlive = !catalogChanged && maintenanceNeeded(Number(git(['log', '-1', '--format=%ct'])));
    if (keepAlive) {
      await writeFile(resolve(root, maintenancePath), JSON.stringify({
        last_maintenance: new Date().toISOString(),
        purpose: 'Keep the authorized catalog sync active during long periods without resource changes.'
      }, null, 2) + '\n');
    }
    if (catalogChanged || keepAlive) {
      git(['add', '--', ...(catalogChanged ? dataPaths : [maintenancePath])]);
      git(['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
        'commit', '-m', catalogChanged ? 'chore: sync resource catalog' : 'chore: keep catalog sync active']);
      // A concurrent human push is never overwritten. The next run starts from current main.
      git(['push', 'origin', 'HEAD:main']);
    }
  }

  const repository = process.env.GITHUB_REPOSITORY || 'SeanShaffer88/dev-resource-explorer';
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Invalid repository name');
  const [owner, name] = repository.split('/');
  const siteUrl = `https://${owner.toLowerCase()}.github.io/${name}/`;
  const fingerprint = await siteFingerprint(resolve(root, 'site'));
  const deploy = deploymentNeeded(fingerprint, await publishedBuild(siteUrl));
  const meta = JSON.parse(await readFile(resolve(root, 'site/data/meta.json'), 'utf8'));
  const build = { schema: 1, content_sha256: fingerprint, app_commit: git(['rev-parse', 'HEAD']), catalog_commit: meta.source_commit };
  await writeFile(resolve(root, 'site/build.json'), JSON.stringify(build, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `deploy=${deploy}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### Catalog sync\n\n- ${meta.entry_count} entries / ${meta.resource_count} distinct resources\n- Catalog commit: \`${meta.source_commit}\`\n- Explorer commit: \`${build.app_commit}\`\n- ${deploy ? 'Publishing validated changes (or repairing a missing/stale deployment).' : 'Published content already matches; no deployment needed.'}\n`);
  console.log(JSON.stringify({ deploy, ...build }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
