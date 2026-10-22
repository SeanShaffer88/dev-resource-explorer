import { prepareCatalog, categoryCounts, filterResources, DEFAULT_STATE, readState, writeState, readSaved, PLATFORM_RULES, LANGUAGE_RULES } from './catalog.js';

const $ = id => document.getElementById(id);
const PAGE_SIZE = 24;
let state = readState(location.search), resources = [], categories = [], saved = new Set(), limit = PAGE_SIZE;
let storageAvailable = true, searchTimer, toastTimer;
const labels = { general: 'General development', windows: 'Windows development', android: 'Android APK' };
const labelFor = source => labels[source] || source.replaceAll('-', ' ');
const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
const externalLink = (text, url, className) => { const link = node('a', className, text); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link; };
function showToast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500); }
function syncUrl() { const query = writeState(state); history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash); }
function fillSelect(id, values) { for (const value of values) { const option = node('option', '', id === 'collection' ? labelFor(value) : value); option.value = value; $(id).append(option); } }
function reflectControls() {
  $('search').value = state.q;
  for (const key of ['platform', 'language', 'collection', 'sort']) {
    if (state[key] && ![...$(key).options].some(o => o.value === state[key])) { const option = node('option', '', `${state[key]} (unavailable)`); option.value = state[key]; $(key).append(option); }
    $(key).value = state[key];
  }
  $('all-resources').classList.toggle('active', !state.saved && !state.category);
  $('all-resources').setAttribute('aria-pressed', String(!state.saved && !state.category));
  $('saved-resources').classList.toggle('active', state.saved);
  $('saved-resources').setAttribute('aria-pressed', String(state.saved));
  $('saved-count').textContent = saved.size;
}
function renderCategories() {
  const query = $('category-search').value.toLocaleLowerCase();
  const fragment = document.createDocumentFragment();
  for (const [category, count] of categories.filter(([name]) => name.toLocaleLowerCase().includes(query))) {
    const button = node('button', `category-button${state.category === category ? ' active' : ''}`);
    button.setAttribute('aria-pressed', String(state.category === category));
    button.append(node('span', '', category.replace(/^Windows\s*\/\s*/, 'Windows · ')), node('span', '', count));
    button.addEventListener('click', () => { state.category = state.category === category ? '' : category; update(); });
    fragment.append(button);
  }
  if (!fragment.childNodes.length) fragment.append(node('p', 'sidebar-footnote', 'No categories match.'));
  $('categories').replaceChildren(fragment);
}
function bookmarkButton(resource) {
  const button = node('button', 'save-button');
  button.dataset.resource = resource.id;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M6 4h12v17l-6-4-6 4V4Z'); svg.append(path); button.append(svg);
  setBookmarkLabel(button, resource);
  button.addEventListener('click', () => {
    const removing = saved.has(resource.id);
    if (removing) saved.delete(resource.id); else saved.add(resource.id);
    try { localStorage.setItem('dev-resource-explorer:saved:v1', JSON.stringify([...saved])); } catch { storageAvailable = false; }
    $('storage-notice').hidden = storageAvailable;
    $('saved-count').textContent = saved.size;
    for (const el of document.querySelectorAll('.save-button')) if (el.dataset.resource === resource.id) setBookmarkLabel(el, resource);
    if (state.saved) { const focusIndex = [...$('resource-grid').children].indexOf(button.closest('article')); render(); const next = $('resource-grid').children[Math.max(0, focusIndex)] || $('resource-grid').lastElementChild; (next?.querySelector('.save-button') || $('empty-reset')).focus(); }
    showToast(removing ? `${resource.name} removed from saved resources` : `${resource.name} saved in this browser`);
  });
  return button;
}
function setBookmarkLabel(button, resource) { const active = saved.has(resource.id); button.setAttribute('aria-pressed', String(active)); button.setAttribute('aria-label', `${active ? 'Unsave' : 'Save'} ${resource.name}`); button.title = active ? 'Remove from saved resources' : 'Save resource'; }
function makeCard(resource) {
  const article = node('article', 'resource-card');
  const tone = [...resource.name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 6;
  const top = node('div', 'card-top');
  const initials = resource.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2);
  const mark = node('span', `resource-mark tone-${tone}`, initials); mark.setAttribute('aria-hidden', 'true');
  top.append(mark, bookmarkButton(resource));
  const title = node('h3'); title.append(externalLink(resource.name, resource.url));
  const domain = new URL(resource.url).hostname.replace(/^www\./, '');
  const category = node('span', 'card-category', resource.categories[0]); category.title = resource.categories.join(' · ');
  const bottom = node('div', 'card-bottom');
  const details = node('button', 'details-button', `View notes${resource.entries.length > 1 ? ` (${resource.entries.length})` : ''}`);
  details.setAttribute('aria-label', `View notes for ${resource.name}`);
  details.addEventListener('click', () => showDetails(resource));
  const visit = externalLink('Explore ↗', resource.url, 'visit-link'); visit.setAttribute('aria-label', `Explore ${resource.name} (opens in a new tab)`);
  bottom.append(details, visit);
  article.append(top, title, node('p', 'resource-domain', domain), node('p', 'resource-description', resource.description), category, bottom);
  return article;
}
function showDetails(resource) {
  const content = document.createDocumentFragment();
  const title = node('h2', '', resource.name); title.id = 'detail-title';
  content.append(title, node('p', '', resource.description));
  const actions = node('div', 'detail-actions'); actions.append(externalLink('Open resource ↗', resource.url, 'primary-button'), bookmarkButton(resource)); content.append(actions);
  const topics = [...resource.platforms, ...resource.languages];
  if (topics.length) content.append(node('p', 'detail-topics', `Discovery topics: ${topics.join(' · ')}. Inferred from the catalog text; not a compatibility guarantee.`));
  content.append(node('h3', '', `Original catalog notes (${resource.entries.length})`));
  for (const entry of resource.entries) {
    const evidence = node('section', 'evidence-note');
    evidence.append(node('h3', '', entry.name), node('p', '', `${entry.category} · ${labelFor(entry.source)}`), node('p', '', entry.purpose));
    evidence.append(node('p', '', `Research date: ${entry.checked_on}`), node('p', '', `Review scope: ${entry.review}`), node('p', '', `Recorded retrieval status: ${entry.http_status || 'Not recorded'}`));
    content.append(evidence);
  }
  content.append(node('p', '', 'Research notes describe the original checks, not a current audit. Verify maintenance, licensing, security, and compatibility for your project.'));
  content.append(externalLink('View the versioned source index ↗', window.catalogSourceUrl, 'detail-source'));
  $('detail-content').replaceChildren(content); $('detail-dialog').showModal();
}
function renderChips() {
  const fragment = document.createDocumentFragment();
  for (const key of ['q', 'category', 'platform', 'language', 'collection', 'saved']) {
    if (!state[key]) continue;
    const value = key === 'saved' ? 'Saved only' : key === 'collection' ? labelFor(state[key]) : state[key];
    const button = node('button', 'filter-chip', key === 'q' ? `Search: ${value}` : value);
    button.append(node('span', '', '×')); button.setAttribute('aria-label', `Remove ${key} filter: ${value}`);
    button.addEventListener('click', () => { state[key] = DEFAULT_STATE[key]; update(); $('search').focus(); }); fragment.append(button);
  }
  $('active-filters').replaceChildren(fragment);
}
function render() {
  const filtered = filterResources(resources, state, saved);
  const fragment = document.createDocumentFragment();
  filtered.slice(0, limit).forEach(resource => fragment.append(makeCard(resource)));
  $('resource-grid').replaceChildren(fragment); $('resource-grid').setAttribute('aria-busy', 'false');
  $('result-count').textContent = `${filtered.length.toLocaleString()} resource${filtered.length === 1 ? '' : 's'}${state.q ? ` matching “${state.q}”` : ' to explore'}`;
  $('results-heading').textContent = state.saved ? 'Your saved resources.' : state.category || 'Explore the possibilities.';
  $('empty-state').hidden = filtered.length > 0;
  $('empty-title').textContent = state.saved && !saved.size ? 'Your next favorite is out there.' : 'No resources found';
  $('empty-description').textContent = state.saved && !saved.size ? 'Use the bookmark on any resource to keep it in this browser.' : 'Try a broader search or remove a filter.';
  $('load-more').hidden = filtered.length <= limit;
  $('shown-count').textContent = filtered.length ? `Showing ${Math.min(limit, filtered.length)} of ${filtered.length} resources` : '';
  $('clear-filters').hidden = !Object.keys(DEFAULT_STATE).some(k => state[k] !== DEFAULT_STATE[k]);
  reflectControls(); renderCategories(); renderChips();
}
function update() { clearTimeout(searchTimer); limit = PAGE_SIZE; syncUrl(); render(); }
function reset() { state = { ...DEFAULT_STATE }; $('category-search').value = ''; update(); }
async function init() {
  try {
    const responses = await Promise.all([fetch('./data/resources.json'), fetch('./data/meta.json')]);
    if (responses.some(r => !r.ok)) throw new Error('Unable to fetch the catalog');
    const [raw, meta] = await Promise.all(responses.map(r => r.json()));
    resources = prepareCatalog(raw); categories = categoryCounts(resources);
    try { const stored = readSaved(localStorage, new Set(resources.map(r => r.id))); saved = stored.ids; storageAvailable = stored.available; } catch { storageAvailable = false; }
    $('storage-notice').hidden = storageAvailable;
    $('total-resources').textContent = resources.length.toLocaleString(); $('all-count').textContent = resources.length;
    $('total-categories').textContent = categories.length; $('category-count').textContent = categories.length;
    $('snapshot-date').textContent = meta.imported_on; $('snapshot-date').dateTime = meta.imported_on;
    window.catalogSourceUrl = `https://github.com/SeanShaffer88/useful-dev-resources/blob/${meta.source_commit}/resources.json`;
    const provenance = node('p', 'detail-source', `Snapshot: ${meta.imported_on} · ${raw.length} source entries · ${resources.length} distinct URLs · commit ${meta.source_commit.slice(0, 12)}.`);
    $('about-provenance').replaceChildren(provenance, externalLink('Source commit ↗', `https://github.com/SeanShaffer88/useful-dev-resources/commit/${meta.source_commit}`, 'detail-source'));
    fillSelect('platform', Object.keys(PLATFORM_RULES)); fillSelect('language', Object.keys(LANGUAGE_RULES)); fillSelect('collection', [...new Set(raw.map(e => e.source))].sort());
    render();
  } catch (error) {
    console.error('Catalog load failed:', error.message); $('load-error').hidden = false;
    $('result-count').textContent = 'Catalog unavailable'; $('resource-grid').setAttribute('aria-busy', 'false');
  }
}
$('search').addEventListener('input', () => { state.q = $('search').value; clearTimeout(searchTimer); searchTimer = setTimeout(update, 140); });
$('search-form').addEventListener('submit', e => { e.preventDefault(); state.q = $('search').value; update(); });
for (const id of ['platform', 'language', 'collection', 'sort']) $(id).addEventListener('change', () => { state[id] = $(id).value; update(); });
$('category-search').addEventListener('input', renderCategories);
$('all-resources').addEventListener('click', reset);
$('saved-resources').addEventListener('click', () => { state = { ...DEFAULT_STATE, saved: true }; update(); });
for (const id of ['clear-filters', 'empty-reset']) $(id).addEventListener('click', reset);
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => { state = { ...DEFAULT_STATE, q: button.dataset.query }; update(); }));
$('load-more').addEventListener('click', () => { const previous = limit; limit += PAGE_SIZE; render(); $('resource-grid').children[previous]?.querySelector('h3 a')?.focus(); });
$('filter-toggle').addEventListener('click', () => { const open = $('sidebar').classList.toggle('is-open'); $('filter-toggle').setAttribute('aria-expanded', String(open)); });
$('about-button').addEventListener('click', () => $('about-dialog').showModal());
$('footer-about').addEventListener('click', () => $('about-dialog').showModal());
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
}
document.addEventListener('keydown', event => { if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { event.preventDefault(); $('search').focus(); } });
window.addEventListener('popstate', () => { state = readState(location.search); limit = PAGE_SIZE; render(); });
$('share-button').addEventListener('click', async () => {
  const query = writeState(state, { share: true }); const url = `${location.origin}${location.pathname}${query ? `?${query}` : ''}`;
  try { await navigator.clipboard.writeText(url); showToast(state.saved ? 'Search link copied. Bookmarks stay private to this browser.' : 'Search link copied'); }
  catch { window.prompt('Copy this search link:', url); }
});
window.addEventListener('storage', event => { if (event.key === 'dev-resource-explorer:saved:v1') { try { saved = readSaved(localStorage, new Set(resources.map(r => r.id))).ids; render(); } catch { /* Browsing remains available. */ } } });
init();
