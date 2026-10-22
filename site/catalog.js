// Discovery tags are inferred from text, never asserted as support guarantees.
export const PLATFORM_RULES = {
  Windows: /\b(windows|win32|winrt|msvc|powershell|uwp|wdk)\b/i,
  Android: /\b(android|apk|xapk|apks|adb)\b/i,
  Linux: /\b(linux|glibc|wayland|x11)\b/i,
  'Apple platforms': /\b(macos|ios|ipados|apple|swiftui|cocoa)\b/i,
  Web: /\b(web|browser|html|css|frontend|javascript|typescript|wasm|webassembly)\b/i
};
export const LANGUAGE_RULES = {
  'C / C++': /\bc\+\+|\b(cmake|msvc|win32|c11|c17|c23)\b|\bc\s+(?:library|libraries|language|api|runtime|compiler|code)\b/i,
  'C# / .NET': /c#|\.net\b|\b(csharp|nuget|clr|wpf)\b/i,
  'JavaScript / TypeScript': /\b(javascript|typescript|node\.js|react|vue|svelte|angular|next\.js|nuxt)\b/i,
  Python: /\b(python|cpython|pypi|pip|pandas)\b/i,
  Rust: /\b(rust|cargo)\b/i,
  Go: /\b(golang|go)\b/i,
  'Java / Kotlin': /\b(java|kotlin|jvm|gradle)\b/i,
  Swift: /\b(swift|swiftui)\b/i,
  PowerShell: /\bpowershell\b/i
};
const featured = ['Python', 'Git', 'SQLite', 'React', 'Rust and Cargo', 'Windows SDK', 'Node.js', 'GitHub Actions', 'Android Developers', 'TypeScript', 'Go', 'MDN Web Docs'];
export const DEFAULT_STATE = { q: '', category: '', platform: '', language: '', collection: '', sort: 'featured', saved: false };
export function validateCatalog(entries) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('Catalog must be a non-empty array');
  for (const entry of entries) {
    for (const key of ['name', 'url', 'category', 'purpose', 'source', 'checked_on', 'review']) {
      if (typeof entry[key] !== 'string' || !entry[key].trim()) throw new Error(`Missing catalog field: ${key}`);
    }
    if (entry.http_status !== undefined && typeof entry.http_status !== 'string') throw new Error('Invalid recorded HTTP status');
    const url = new URL(entry.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Catalog links must use credential-free HTTPS');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.checked_on)) throw new Error('Invalid research date');
  }
  return entries;
}
export function prepareCatalog(raw) {
  validateCatalog(raw);
  const merged = new Map();
  for (const entry of raw) {
    if (!merged.has(entry.url)) merged.set(entry.url, { id: entry.url, name: entry.name, url: entry.url, description: entry.purpose, entries: [] });
    merged.get(entry.url).entries.push(entry);
  }
  return [...merged.values()].map(resource => {
    const text = resource.entries.map(e => `${e.name} ${e.category} ${e.purpose}`).join(' ');
    return { ...resource,
      categories: [...new Set(resource.entries.map(e => e.category))],
      collections: [...new Set(resource.entries.map(e => e.source))],
      platforms: Object.entries(PLATFORM_RULES).filter(([, rule]) => rule.test(text)).map(([name]) => name),
      languages: Object.entries(LANGUAGE_RULES).filter(([, rule]) => rule.test(text)).map(([name]) => name),
      searchText: text.toLocaleLowerCase(),
      latestDate: resource.entries.map(e => e.checked_on).sort().at(-1),
      featuredRank: Math.min(...resource.entries.map(e => featured.indexOf(e.name)).filter(i => i >= 0), 999)
    };
  });
}
export function queryTerms(query) {
  return [...query.toLocaleLowerCase().matchAll(/"([^"]+)"|(\S+)/g)].map(m => m[1] || m[2]);
}
export function filterResources(resources, state, saved = new Set()) {
  const terms = queryTerms(state.q || '');
  const results = resources.filter(r =>
    terms.every(term => r.searchText.includes(term)) &&
    (!state.category || r.categories.includes(state.category)) &&
    (!state.platform || r.platforms.includes(state.platform)) &&
    (!state.language || r.languages.includes(state.language)) &&
    (!state.collection || r.collections.includes(state.collection)) &&
    (!state.saved || saved.has(r.id))
  );
  const nameCompare = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.url.localeCompare(b.url);
  if (state.sort === 'recent') return results.sort((a, b) => b.latestDate.localeCompare(a.latestDate) || nameCompare(a, b));
  if (state.sort === 'name') return results.sort(nameCompare);
  const score = r => terms.reduce((sum, term) => sum + (r.name.toLocaleLowerCase() === term ? 100 : r.name.toLocaleLowerCase().includes(term) ? 10 : 0), 0);
  return results.sort((a, b) => score(b) - score(a) || a.featuredRank - b.featuredRank || nameCompare(a, b));
}
export function readState(search) {
  const params = new URLSearchParams(search);
  const state = { ...DEFAULT_STATE };
  for (const key of ['q', 'category', 'platform', 'language', 'collection']) state[key] = (params.get(key) || '').slice(0, 300);
  if (['featured', 'name', 'recent'].includes(params.get('sort'))) state.sort = params.get('sort');
  state.saved = params.get('saved') === '1';
  return state;
}
export function writeState(state, { share = false } = {}) {
  const params = new URLSearchParams();
  for (const key of ['q', 'category', 'platform', 'language', 'collection']) if (state[key]) params.set(key, state[key]);
  if (state.sort && state.sort !== 'featured') params.set('sort', state.sort);
  if (state.saved && !share) params.set('saved', '1');
  return params.toString();
}
export function categoryCounts(resources) {
  const counts = new Map();
  for (const resource of resources) for (const category of resource.categories) counts.set(category, (counts.get(category) || 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b, 'en'));
}
export function readSaved(storage, knownIds) {
  try {
    const data = JSON.parse(storage.getItem('dev-resource-explorer:saved:v1') || '[]');
    if (!Array.isArray(data)) return { ids: new Set(), available: true };
    return { ids: new Set(data.filter(id => typeof id === 'string' && knownIds.has(id))), available: true };
  } catch { return { ids: new Set(), available: false }; }
}
