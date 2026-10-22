import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareCatalog, filterResources, queryTerms, categoryCounts, readState, writeState, readSaved, DEFAULT_STATE, validateCatalog } from '../site/catalog.js';
const raw = JSON.parse(readFileSync(new URL('../site/data/resources.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const all = prepareCatalog(raw);
const base = { name: 'Sample', url: 'https://example.com/tool', category: 'Tools', purpose: 'A tool', source: 'general', checked_on: '2026-10-21', review: 'Discovery only', http_status: '200' };
test('all source entries survive deduplication with exact provenance', () => {
  assert.equal(all.length, new Set(raw.map(e => e.url)).size);
  assert.equal(all.flatMap(r => r.entries).length, raw.length);
  for (const entry of raw) assert.ok(all.find(r => r.url === entry.url).entries.includes(entry));
});
test('duplicate URLs retain distinct names, categories, dates and sources', () => {
  const merged = prepareCatalog([base, { ...base, name: 'Alias', category: 'Another category', source: 'windows', checked_on: '2026-10-22' }]);
  assert.equal(merged.length, 1); assert.equal(merged[0].entries.length, 2);
  assert.equal(merged[0].latestDate, '2026-10-22'); assert.deepEqual(merged[0].collections, ['general', 'windows']);
  assert.equal(filterResources(merged, { ...DEFAULT_STATE, q: 'alias', category: 'Another category' }).length, 1);
});
test('case-insensitive search uses all words and supports quoted phrases', () => {
  assert.deepEqual(queryTerms(' "named pipes" Windows '), ['named pipes', 'windows']);
  const found = filterResources(all, { ...DEFAULT_STATE, q: 'SQLITE' });
  assert.ok(found.length); assert.ok(found.some(r => r.name === 'SQLite'));
  assert.ok(filterResources(all, { ...DEFAULT_STATE, q: 'unfindable-dre-string-9891' }).length === 0);
});
test('platform, language, category, collection and bookmarks compose as AND filters', () => {
  const one = prepareCatalog([{ ...base, category: 'Windows tools', purpose: 'Python library for Windows' }, { ...base, url: 'https://example.com/other', purpose: 'Python on Linux' }]);
  const state = { ...DEFAULT_STATE, q: 'python', category: 'Windows tools', platform: 'Windows', language: 'Python', collection: 'general', saved: true };
  assert.equal(filterResources(one, state, new Set([base.url])).length, 1);
  assert.equal(filterResources(one, { ...state, platform: 'Linux' }, new Set([base.url])).length, 0);
  assert.equal(filterResources(one, state, new Set()).length, 0);
});
test('C++ tag recognizes C++ while go does not match google', () => {
  assert.ok(prepareCatalog([{ ...base, purpose: 'C++ library' }])[0].languages.includes('C / C++'));
  assert.ok(!prepareCatalog([{ ...base, purpose: 'Google services' }])[0].languages.includes('Go'));
});
test('category counts count each distinct URL once per category', () => {
  assert.deepEqual(categoryCounts(prepareCatalog([base, { ...base }])), [['Tools', 1]]);
});
test('search rank places exact resource name first', () => {
  assert.equal(filterResources(all, { ...DEFAULT_STATE, q: 'SQLite' })[0].name, 'SQLite');
});
test('name and date sorting are deterministic without mutating the catalog', () => {
  const original = all.map(r => r.id);
  const sorted = filterResources(all, { ...DEFAULT_STATE, sort: 'recent' });
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i - 1].latestDate >= sorted[i].latestDate);
  assert.deepEqual(all.map(r => r.id), original);
  const named = filterResources(all, { ...DEFAULT_STATE, sort: 'name' });
  assert.deepEqual(named.map(r => r.name), all.map(r => r.name).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
});
test('shareable filter state round-trips symbols, spaces and Unicode', () => {
  const state = { ...DEFAULT_STATE, q: 'C++ & café', category: 'Windows / Native libraries', language: 'C / C++', sort: 'recent', saved: true };
  assert.deepEqual(readState(writeState(state)), state);
  assert.equal(readState(writeState(state, { share: true })).saved, false);
});
test('invalid sort and unbounded input are normalized', () => {
  assert.equal(readState('?sort=bad').sort, 'featured');
  assert.equal(readState('?q=' + 'x'.repeat(500)).q.length, 300);
});
test('bookmark storage filters stale values and handles broken storage', () => {
  const known = new Set([base.url]);
  assert.deepEqual([...readSaved({ getItem: () => JSON.stringify([base.url, base.url, 'unknown', 5]) }, known).ids], [base.url]);
  assert.equal(readSaved({ getItem: () => '{bad' }, known).available, false);
  assert.equal(readSaved({ getItem: () => { throw new Error('blocked'); } }, known).available, false);
  assert.equal(readSaved({ getItem: () => '{}' }, known).ids.size, 0);
});
test('unsafe URLs and missing research fields are rejected', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com']) assert.throws(() => validateCatalog([{ ...base, url }]));
  assert.throws(() => validateCatalog([{ ...base, review: '' }]));
  assert.throws(() => validateCatalog([]));
});
test('historical entries without a recorded HTTP status remain usable', () => {
  assert.equal(prepareCatalog([{ ...base, http_status: '' }]).length, 1);
});
