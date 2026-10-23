const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { collectPages } = require('../lib/paging');
const { createRateLimiter } = require('../lib/rate-limit');

// ---------- lib/paging ----------
const items = (ids) => ids.map((id) => ({ id }));

test('collectPages keeps going when a page has fewer than 10 items but a next page exists', async () => {
  const pages = [
    { items: items(['a', 'b', 'c']), next: 'x' }, // 10件未満（市場フィルタ等）でも続ける
    { items: items(['d', 'e']), next: 'y' },
    { items: items(['f']), next: null },
  ];
  const offsets = [];
  const result = await collectPages({ maxItems: 20, fetchPage: async (offset) => { offsets.push(offset); return pages[offset / 10]; } });
  assert.deepEqual(result.map((x) => x.id), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(offsets, [0, 10, 20]);
});

test('collectPages stops at maxItems, removes duplicates and honours accept()', async () => {
  const result = await collectPages({
    maxItems: 3,
    accept: (t) => t.id !== 'skip',
    fetchPage: async () => ({ items: items(['a', 'a', 'skip', 'b', 'c', 'd']), next: 'more' }),
  });
  assert.deepEqual(result.map((x) => x.id), ['a', 'b', 'c']);
});

test('collectPages stops on empty page, swallows non-429 errors but rethrows 429', async () => {
  let calls = 0;
  const empty = await collectPages({ fetchPage: async () => { calls++; return { items: [], next: 'loop' }; } });
  assert.deepEqual(empty, []);
  assert.equal(calls, 1);

  const partial = await collectPages({
    maxItems: 20,
    fetchPage: async (offset) => { if (offset === 10) throw Object.assign(new Error('boom'), { status: 500 }); return { items: items(['a']), next: 'n' }; },
  });
  assert.deepEqual(partial.map((x) => x.id), ['a']);

  await assert.rejects(collectPages({ fetchPage: async () => { throw Object.assign(new Error('limit'), { status: 429 }); } }), { status: 429 });
});

// ---------- lib/rate-limit ----------
test('rate limiter blocks after max requests with Retry-After and resets after the window', () => {
  let now = 1000;
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2, now: () => now });
  const make = () => {
    const res = { headers: {}, set(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    return res;
  };
  const req = { ip: '1.2.3.4' };
  let passed = 0;
  const next = () => { passed++; };
  limiter(req, make(), next);
  limiter(req, make(), next);
  const blocked = make();
  limiter(req, blocked, next);
  assert.equal(passed, 2);
  assert.equal(blocked.code, 429);
  assert.ok(Number(blocked.headers['Retry-After']) >= 1);
  limiter({ ip: '9.9.9.9' }, make(), next); // 別のIPは別カウント
  assert.equal(passed, 3);
  now += 61_000;
  limiter(req, make(), next); // ウィンドウが過ぎたら再び通る
  assert.equal(passed, 4);
});

// ---------- client search (public/script.js) ----------
function clientApp(fetch, token = 'test') {
  const element = () => ({
    children: [], dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild(child) { this.children.push(child); },
    set innerHTML(v) { this.html = v; this.children = []; }, get innerHTML() { return this.html; },
    setAttribute() {}, addEventListener() {},
  });
  const context = vm.createContext({
    console, URL, URLSearchParams, AbortController, Date, setTimeout, clearTimeout, setInterval: () => 0, fetch,
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], createElement: element, getElementById: () => element() },
    window: { scrollTo() {} }, navigator: {}, localStorage: { getItem: () => null, setItem() {} },
  });
  vm.runInContext(fs.readFileSync('public/script.js', 'utf8'), context);
  vm.runInContext(`getFreshSpotifyToken = async () => ${JSON.stringify(token)}; createTrackCard = (track) => ({ track });`, context);
  const box = { innerHTML: '', children: [], appendChild(c) { this.children.push(c); }, querySelector: () => null };
  return { run: (code) => vm.runInContext(code, context), box, context };
}
const res = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body });
const trk = (id) => ({ id, name: `song ${id}`, uri: `spotify:track:${id}`, type: 'track', artists: [{ name: 'A' }] });
const page = (ids, next) => res({ tracks: { items: ids.map(trk), next: next ? 'n' : null }, artists: { items: [{ id: 'ar1', name: 'Artist' }] } });

test('search: 2 pages are requested with offsets 0 and 10 and combined without duplicates', async () => {
  const urls = [];
  const first = Array.from({ length: 10 }, (_, i) => `t${i}`);
  const second = ['t9', ...Array.from({ length: 9 }, (_, i) => `u${i}`)];
  const { run, box, context } = clientApp(async (url) => {
    urls.push(url);
    return url.includes('offset=0') ? page(first, true) : page(second, true);
  });
  context.__box = box;
  await run('runSongSearch("back number", __box)');
  assert.equal(urls.length, 2);
  assert.ok(urls[0].includes('offset=0') && urls[0].includes('type=track%2Cartist') || urls[0].includes('type=track,artist'));
  assert.ok(urls[1].includes('offset=10'));
  const state = run('searchCache.get("back number")');
  assert.equal(state.tracks.length, 19); // 20件 - 重複1件
  assert.equal(state.next, true);
  // 同じ語をもう一度検索してもネットワークは使わない
  await run('runSongSearch("back number", __box)');
  assert.equal(urls.length, 2);
});

test('search without a Spotify login falls back to /api/search', async () => {
  const urls = [];
  const { run, box, context } = clientApp(async (url) => {
    urls.push(url);
    return res({ tracks: [trk('s1'), trk('s2')], artists: [{ id: 'x', name: 'X' }], next: false });
  }, '');
  context.__box = box;
  await run('runSongSearch("yoasobi", __box)');
  assert.ok(urls.every((u) => u.startsWith('/api/search?')));
  assert.equal(run('searchCache.get("yoasobi")').tracks.length, 2);
});

test('search falls back to /api/search when the Spotify token is rejected (401)', async () => {
  const urls = [];
  const { run, box, context } = clientApp(async (url) => {
    urls.push(url);
    if (url.startsWith('https://api.spotify.com')) return res({}, 401);
    return res({ tracks: [trk('k1')], artists: [], next: false });
  });
  context.__box = box;
  await run('runSongSearch("kenshi", __box)');
  assert.equal(run('searchCache.get("kenshi")').tracks.length, 1);
});

test('empty query shows the prompt and an older slow response never overwrites a newer search', async () => {
  let release;
  const slow = new Promise((resolve) => { release = resolve; });
  const { run, box, context } = clientApp(async (url) => {
    if (url.includes('q=old')) { await slow; return page(['old1'], false); }
    return page(['new1'], false);
  });
  context.__box = box;
  await run('runSongSearch("", __box)');
  assert.match(box.innerHTML, /入力してください/);
  const oldSearch = run('runSongSearch("old", __box)');
  await run('runSongSearch("new", __box)');
  release();
  await oldSearch;
  assert.equal(run('searchCache.has("old")'), false); // 古い検索は結果を残さない
  assert.equal(run('searchCache.get("new")').tracks[0].id, 'new1');
});

test('search shows a Japanese error message when the request fails', async () => {
  const { run, box, context } = clientApp(async () => res({}, 500));
  context.__box = box;
  await run('runSongSearch("x", __box)');
  assert.match(box.innerHTML, /Spotify側で一時的な問題/);
});

test('infinite scroll appends the next page to the same play queue', async () => {
  const { run, box, context } = clientApp(async (url) => {
    if (url.includes('offset=0')) return page(['a1', 'a2'], true);
    if (url.includes('offset=10')) return page(['b1'], true);
    return page(['c1', 'c2'], false); // offset=20: 追加読み込み
  });
  context.__box = box;
  await run('runSongSearch("q", __box)');
  const state = run('searchCache.get("q")');
  assert.equal(state.tracks.length, 3);
  await run('loadMoreSearch("q", searchCache.get("q"), __box)');
  assert.deepEqual(Array.from(state.tracks, (t) => t.id), ['a1', 'a2', 'b1', 'c1', 'c2']);
  assert.equal(state.next, false);
});
