const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app(fetch) {
  const elements = new Map();
  const element = () => ({
    children: [], dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild(child) { this.children.push(child); },
    set innerHTML(value) { this.html = value; this.children = []; },
    get innerHTML() { return this.html; },
    setAttribute() {}, addEventListener(type, fn) { this[type] = fn; },
  });
  const context = vm.createContext({
    console, URL, Date, setTimeout, clearTimeout, setInterval: () => 0, fetch,
    document: {
      addEventListener() {}, querySelectorAll: () => [], createElement: element,
      getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    },
    window: { scrollTo() {} }, navigator: {},
    localStorage: { getItem: () => null, setItem() {} },
  });
  vm.runInContext(fs.readFileSync('public/script.js', 'utf8'), context);
  vm.runInContext('getFreshSpotifyToken = async (force) => force ? "fresh" : "test";', context);
  return { run: (code) => vm.runInContext(code, context), elements };
}
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const track = (id) => ({ id, name: id, uri: `spotify:track:${id}`, type: 'track' });

test('loads every page and refreshes authorization once on expiry', async () => {
  const calls = [];
  const { run } = app(async (url, options) => {
    calls.push([url, options.headers.Authorization]);
    if (calls.length === 1) return response({}, 401);
    if (!url.includes('offset')) return response({ items: [track('a'), null], next: 'https://api.spotify.com/v1/me/playlists?offset=50' });
    return response({ items: [track('b')], next: null });
  });
  const items = await run('fetchSpotifyPages("https://api.spotify.com/v1/me/playlists")');
  assert.deepEqual(Array.from(items, x => x.id), ['a', 'b']);
  assert.equal(calls[1][1], 'Bearer fresh');
});

test('rejects foreign paging URLs before sending the token', async () => {
  let calls = 0;
  const { run } = app(async () => { calls++; return response({ items: [], next: 'https://example.com/steal' }); });
  await assert.rejects(run('fetchSpotifyPages("https://api.spotify.com/v1/me/playlists")'), /Invalid Spotify URL/);
  assert.equal(calls, 1);
});

test('playlist browsing does not play; selected playable row retains original Spotify offset', async () => {
  const calls = [];
  const { run, elements } = app(async (url, options) => {
    calls.push(options?.method || 'GET');
    return response({ items: [{ item: null }, { item: { ...track('local'), is_local: true } }, { item: track('third') }] });
  });
  run('createTrackCard = (track, index, queue, onPlay) => ({ track, onPlay }); playSpotifyPlaylist = (playlist, position) => { window.played = position; };');
  await run('openSpotifyPlaylist({ id: "p", name: "Playlist" })');
  assert.deepEqual(calls, ['GET']);
  assert.equal(run('window.played'), undefined);
  assert.equal(elements.get('playlistTracks').children.length, 1);
  elements.get('playlistTracks').children[0].onPlay();
  assert.equal(run('window.played'), 2);
});

test('old playlist response cannot overwrite a newer detail view', async () => {
  let finishFirst;
  const { run, elements } = app(async url => {
    if (url.includes('/first/')) return new Promise(resolve => { finishFirst = resolve; });
    return response({ items: [{ item: track('new') }] });
  });
  run('createTrackCard = (track) => ({ track });');
  const first = run('openSpotifyPlaylist({id:"first",name:"First"})');
  await new Promise(resolve => setImmediate(resolve));
  await run('openSpotifyPlaylist({id:"second",name:"Second"})');
  finishFirst(response({ items: [{ item: track('old') }] }));
  await first;
  assert.equal(elements.get('playlistTracks').children[0].track.id, 'new');
});

test('local queue excludes the current track and all previous tracks', () => {
  const { run, elements } = app();
  run(`localPlayback = true; currentPlaylist = ${JSON.stringify(['a','b','c'].map(track))}; currentTrackIndex = 1; renderQueue();`);
  const rows = elements.get('fpQueueList').children;
  assert.equal(rows.length, 1);
  assert.match(rows[0].innerHTML, />c</);
  run('currentTrackIndex = 2; renderQueue();');
  assert.match(elements.get('fpQueueList').innerHTML, /次に再生する曲はありません/);
});

test('Spotify queue uses actual upcoming order including repeated songs', async () => {
  const { run, elements } = app(async () => response({ currently_playing: track('a'), queue: [track('b'), track('a'), track('b')] }));
  run('contextMode = true;');
  await run('refreshSpotifyQueue()');
  assert.deepEqual(elements.get('fpQueueList').children.map(row => /fp-queue-title">([^<]*)/.exec(row.innerHTML)[1]), ['b', 'a', 'b']);
});

test('access and rate limit failures show retry state without enabling playback', async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    const { run, elements } = app(async () => response({}, status));
    await run('openSpotifyPlaylist({id:"p"})');
    assert.equal(elements.get('playlistPlay').disabled, true);
    assert.equal(elements.get('playlistRetry').hidden, false);
    assert.match(elements.get('playlistTracks').innerHTML, /role="alert"/);
  }
});

test('server playlist routes use Spotify items API and both response shapes', async () => {
  const routes = new Map();
  const requests = [];
  const expressApp = { set() {}, use() {}, listen() {}, get(path, handler) { routes.set(`GET ${path}`, handler); }, post(path, handler) { routes.set(`POST ${path}`, handler); } };
  const express = Object.assign(() => expressApp, { json: () => {}, static: () => {} });
  const context = vm.createContext({
    console: { log() {}, error() {} }, process: { env: {} }, Buffer, URLSearchParams,
    require(name) {
      if (name === 'express') return express;
      if (name === 'dotenv') return { config() {} };
      if (name === '@google/genai') return {};
      return require(name);
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (options.method === 'POST' && url.endsWith('/me/playlists')) return response({ id: 'created' });
      return response({ items: [{ item: track('new') }, { track: track('legacy') }] });
    },
  });
  vm.runInContext(fs.readFileSync('server.js', 'utf8'), context);
  vm.runInContext('getValidSpotifyAccessToken = async () => "synthetic";', context);
  let body;
  const res = { json(value) { body = value; }, status() { return this; } };
  await routes.get('GET /api/my-playlists/:playlistId/items')({ headers: {}, params: { playlistId: 'p' } }, res);
  assert.match(requests[0].url, /\/playlists\/p\/items\?limit=50$/);
  assert.deepEqual(Array.from(body.tracks, t => t.id), ['new', 'legacy']);
  await routes.get('POST /api/create-playlist')({ body: { name: 'Sample', tracks: ['spotify:track:new'] } }, res);
  assert.equal(requests[2].url, 'https://api.spotify.com/v1/playlists/created/items');
  assert.deepEqual(JSON.parse(requests[2].options.body), { uris: ['spotify:track:new'] });
});

test('playlist shuffle and repeat send Spotify commands with device and correct states', async () => {
  const requests = [];
  const { run } = app(async (url, options) => {
    requests.push({url, method: options.method});
    return response({}, 204);
  });
  run('contextMode = true; spotifyDeviceId = "device"; refreshSpotifyQueue = () => {};');
  await run('setShuffle(true)');
  await run('setRepeat("one")');
  await run('setRepeat("all")');
  assert.deepEqual(requests.map(r => [new URL(r.url).pathname, new URL(r.url).searchParams.get('state'), r.method]), [
    ['/v1/me/player/shuffle', 'true', 'PUT'],
    ['/v1/me/player/repeat', 'track', 'PUT'],
    ['/v1/me/player/repeat', 'context', 'PUT'],
  ]);
  assert.ok(requests.every(r => new URL(r.url).searchParams.get('device_id') === 'device'));
});
