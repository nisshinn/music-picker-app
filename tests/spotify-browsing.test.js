const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app(fetch, timers = {}) {
  const elements = new Map();
  const element = () => ({
    children: [], dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild(child) { this.children.push(child); },
    set innerHTML(value) { this.html = value; this.children = []; },
    get innerHTML() { return this.html; },
    setAttribute() {}, addEventListener(type, fn) { this[type] = fn; },
  });
  const context = vm.createContext({
    console, URL, Date, setTimeout: timers.setTimeout || setTimeout, clearTimeout: timers.clearTimeout || clearTimeout, setInterval: () => 0, fetch,
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
  run(`localPlayback = true; currentPlaylist = ${JSON.stringify(['a','b','c'].map(track))}; currentTrackIndex = 1; playOrder = [0,1,2]; orderCursor = 1; renderQueue();`);
  const rows = elements.get('fpQueueList').children;
  assert.equal(rows.length, 1);
  assert.match(rows[0].innerHTML, />c</);
  run('currentTrackIndex = 2; orderCursor = 2; renderQueue();');
  assert.match(elements.get('fpQueueList').innerHTML, /次に再生する曲はありません/);
});

test('Spotify queue uses actual upcoming order including repeated songs', async () => {
  const { run, elements } = app(async () => response({ currently_playing: track('a'), queue: [track('b'), track('a'), track('b')] }));
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

test('shuffle and repeat are local controls and make no restricted Spotify requests', async () => {
  const { run } = app(async () => { throw Error('Unexpected Spotify request'); });
  await run('setShuffle(true); setRepeat("one");');
  assert.equal(run('appSettings.shuffle'), true);
  assert.equal(run('appSettings.repeat'), 'one');
});

function playerApp(searchItems = []) {
  const requests = [];
  const timeouts = new Map();
  let timeoutId = 0;
  const fixture = app(async (url, options) => {
    requests.push({ url, options });
    if (url.includes('/search?')) return response({ tracks: { items: searchItems } });
    return response({}, 204);
  }, { setTimeout(fn) { timeouts.set(++timeoutId, fn); return timeoutId; }, clearTimeout(id) { timeouts.delete(id); } });
  fixture.run(`
    window.pauses = 0; window.messages = [];
    showToast = message => window.messages.push(message);
    spotifyDeviceId = "local-device";
    spotifyPlayer = {
      pause: async () => { window.pauses++; },
      getCurrentState: async () => null,
      activateElement: async () => {},
    };
  `);
  return { ...fixture, requests, timeouts };
}
const state = (id, position = 0, paused = false) => JSON.stringify({
  position, paused, duration: 10000, track_window: { current_track: track(id) },
});
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Spotify playlist playback snapshots only its tracks and sends a single URI to the browser device', async () => {
  const { run, requests } = playerApp();
  await run(`playSpotifyPlaylist({id:'p'}, 2, ${JSON.stringify([{position:0,track:track('a')},{position:2,track:track('b')}])})`);
  assert.deepEqual(Array.from(run('currentPlaylist'), t => t.id), ['a','b']);
  assert.deepEqual(JSON.parse(requests[0].options.body), {uris:['spotify:track:b'],position_ms:0});
  assert.match(requests[0].url, /device_id=local-device/);
});

test('a five-track selection stops after five without fetching or accepting Spotify additions', async () => {
  const { run, requests } = playerApp();
  await run(`startTrackList(${JSON.stringify(['a','b','c','d','e'].map(track))})`);
  for (const id of ['a','b','c','d','e']) {
    run(`onSpotifyPlayerState(${state(id,9000)}); finishManagedTrack();`);
    await settle();
  }
  assert.equal(requests.length, 5);
  assert.equal(run('playbackStopped'), true);
  run(`onSpotifyPlayerState(${state('outside')});`);
  await settle();
  assert.equal(run('currentTrackData.id'), 'e');
  assert.equal(requests.length, 5);
  assert.equal(run('infiniteMode'), false);
});

test('Spotify autoplay transition is stopped and replaced by the next selected track', async () => {
  const { run, requests } = playerApp();
  await run(`startTrackList(${JSON.stringify(['a','b'].map(track))})`);
  run(`onSpotifyPlayerState(${state('a',9000)}); onSpotifyPlayerState(${state('outside')});`);
  await settle();
  assert.equal(run('currentTrackData.id'), 'b');
  assert.equal(requests.length, 2);
});

test('repeat one repeats one track, repeat all stays inside the selected list', async () => {
  const { run, requests } = playerApp();
  await run(`startTrackList(${JSON.stringify(['a','b'].map(track))})`);
  run(`setRepeat('one'); onSpotifyPlayerState(${state('a',9000)}); finishManagedTrack();`);
  await settle();
  assert.equal(run('currentTrackData.id'), 'a');
  run(`setRepeat('all');`);
  await run('playNext()');
  run(`onSpotifyPlayerState(${state('b',9000)}); finishManagedTrack();`);
  await settle();
  assert.equal(run('currentTrackData.id'), 'a');
  assert.ok(requests.every(r => ['spotify:track:a','spotify:track:b'].includes(JSON.parse(r.options.body).uris[0])));
});

test('shuffle visits each remaining selection once and queue matches playback order', async () => {
  const { run, requests, elements } = playerApp();
  await run(`startTrackList(${JSON.stringify(['a','b','c','d','e'].map(track))});`);
  run('setShuffle(true);');
  const expected = Array.from(run('playOrder.slice(1).map(i=>currentPlaylist[i].id)'));
  assert.equal(new Set(expected).size, 4);
  assert.deepEqual(elements.get('fpQueueList').children.map(row => /fp-queue-title">([^<]*)/.exec(row.innerHTML)[1]), expected);
  for (let i=0;i<5;i++) await run('playNext()');
  assert.deepEqual(requests.slice(1).map(r=>JSON.parse(r.options.body).uris[0].split(':').pop()), expected);
  assert.equal(run('playbackStopped'), true);
});

test('infinite mode alone fetches another song without modifying the selected playlist', async () => {
  const { run, requests } = playerApp([{...track('outside'), artists:[{name:'Artist'}]}]);
  await run(`startTrackList(${JSON.stringify([{...track('a'),artists:[{name:'Artist'}]}])})`);
  run('setInfiniteMode(true);');
  await run('playNext()');
  assert.equal(run('currentTrackData.id'), 'outside');
  assert.deepEqual(Array.from(run('currentPlaylist'), t=>t.id), ['a']);
  assert.equal(requests.filter(r=>r.url.includes('/search?')).length,1);
  run('setInfiniteMode(false);');
  await run('playNext()');
  assert.equal(requests.length,3);
  assert.equal(run('playbackStopped'),true);
});

test('repeat and infinite modes are mutually exclusive and a new list resets infinite mode', async () => {
  const { run } = playerApp();
  run('setRepeat("all");setInfiniteMode(true);');
  assert.equal(run('appSettings.repeat'),'off');
  run('setRepeat("one");');
  assert.equal(run('infiniteMode'),false);
  run('setInfiniteMode(true);');
  await run(`startTrackList(${JSON.stringify([track('a')])})`);
  assert.equal(run('infiniteMode'),false);
});

test('end timer is cancelled on pause and SDK repeat cannot override app repeat off', async () => {
  const { run, timeouts, requests } = playerApp();
  await run(`startTrackList(${JSON.stringify(['a','b'].map(track))})`);
  run(`onSpotifyPlayerState(${state('a',5000)});`);
  assert.equal(timeouts.size,1);
  run(`onSpotifyPlayerState(${state('a',5000,true)});`);
  assert.equal(timeouts.size,0);
  run(`onSpotifyPlayerState(${state('a',9900)}); onSpotifyPlayerState(${state('a',0)});`);
  await settle();
  assert.equal(run('currentTrackData.id'),'b');
  assert.equal(requests.length,2);
});

test('SDK events for the old track during a pending request do not skip the new selection', async () => {
  const { run, requests } = playerApp();
  await run(`startTrackList(${JSON.stringify(['a','b','c'].map(track))})`);
  run(`onSpotifyPlayerState(${state('a',9000)});`);
  const pending = run('playNext()');
  run(`onSpotifyPlayerState(${state('outside')});`);
  await pending;
  assert.equal(run('currentTrackData.id'),'b');
  assert.equal(requests.length,2);
});

test('turning infinite mode off discards recommendations already loading', async () => {
  const { run, requests } = playerApp();
  await run(`startTrackList(${JSON.stringify([{...track('a'),artists:[{name:'Artist'}]}])})`);
  run('fetch = async () => new Promise(resolve => { window.completeSearch = resolve; }); setInfiniteMode(true);');
  const loading = run('playNext()');
  await settle();
  run('setInfiniteMode(false);');
  run(`window.completeSearch({ok:true,status:200,json:async()=>({tracks:{items:[${JSON.stringify(track('outside'))}]}})});`);
  await loading;
  assert.equal(run('currentTrackData.id'), 'a');
  assert.equal(requests.length, 1);
});

test('turning infinite off while preparing playback cancels the outside track request', async () => {
  const { run, requests } = playerApp([{...track('outside'),artists:[{name:'Artist'}]}]);
  await run(`startTrackList(${JSON.stringify([{...track('a'),artists:[{name:'Artist'}]}])})`);
  run(`const initialToken = getFreshSpotifyToken; let count = 0;
    getFreshSpotifyToken = () => ++count === 2 ? new Promise(resolve => window.finishToken = resolve) : initialToken();
    setInfiniteMode(true);`);
  const loading = run('playNext()');
  await settle();
  run('setInfiniteMode(false); window.finishToken("test");');
  await loading;
  assert.equal(requests.filter(r => r.options.method === 'PUT').length, 1);
  assert.equal(run('playbackPending'), false);
});

test('repeat all displays the exact prepared shuffle order for the next cycle', async () => {
  const { run, elements } = playerApp();
  await run(`startTrackList(${JSON.stringify(['a','b','c'].map(track))},2)`);
  run('setShuffle(true); setRepeat("all");');
  const expected = /fp-queue-title">([^<]*)/.exec(elements.get('fpQueueList').children[0].innerHTML)[1];
  await run('playNext()');
  assert.equal(run('currentTrackData.id'), expected);
});

test('making new AI recommendations does not replace a list already playing', async () => {
  const { run } = playerApp();
  await run(`startTrackList(${JSON.stringify(['a','b'].map(track))})`);
  run(`selectedMood = '楽しい'; displayPlaylist = tracks => { window.recommended = tracks; };
    fetch = async () => ({ok:true,json:async()=>({tracks:[${JSON.stringify(track('new'))}]})});`);
  await run('makePlaylist()');
  assert.deepEqual(Array.from(run('currentPlaylist'), t => t.id), ['a','b']);
  assert.equal(run('window.recommended[0].id'), 'new');
});

test('the scheduled boundary pauses and advances once even if an end event arrives too', async () => {
  const { run, timeouts, requests } = playerApp();
  await run(`startTrackList(${JSON.stringify(['a','b','c'].map(track))})`);
  run(`onSpotifyPlayerState(${state('a',9900)});`);
  [...timeouts.values()][0]();
  run(`onSpotifyPlayerState(${state('a',0,true)});`);
  await settle();
  assert.equal(requests.length,2);
  assert.equal(run('currentTrackData.id'),'b');
});

test('a delayed old SDK snapshot does not pause a newly requested track', async () => {
  const { run } = playerApp();
  run(`spotifyPlayer.getCurrentState = async () => (${state('old')});`);
  await run(`startTrackList(${JSON.stringify([track('a')])})`);
  assert.equal(run('window.pauses'), 1); // only the deliberate pause before PUT
  assert.equal(run('managedTrackConfirmed'), false);
  run(`onSpotifyPlayerState(${state('a',100)});`);
  assert.equal(run('managedTrackConfirmed'), true);
});

test('missing playback confirmation stops safely instead of allowing unrelated audio', async () => {
  const { run, timeouts } = playerApp();
  await run(`startTrackList(${JSON.stringify([track('a')])})`);
  [...timeouts.values()][0]();
  assert.equal(run('playbackStopped'), true);
  assert.match(run('window.messages.at(-1)'), /再生を確認できません/);
});

test('Home samples unique saved playlists without mutating the library, including late pages', async () => {
  const { run, elements } = app(async (url) => response(url.includes('offset=50')
    ? { items: [{ id: 'last', name: 'Last page' }], next: null }
    : { items: Array.from({ length: 50 }, (_, i) => ({ id: String(i) })), next: 'https://api.spotify.com/v1/me/playlists?offset=50' }));
  run('createSpotifyPlaylistCard = (playlist, sourcePage) => ({ playlist, sourcePage }); let firstRandom = true; Math.random = () => { if(firstRandom) {firstRandom=false;return 0;}return .999; };');
  await run('loadSpotifyPlaylists()');
  const shown = elements.get('homePlaylists').children;
  assert.equal(shown.length, 4);
  assert.equal(shown[0].playlist.id, 'last');
  assert.equal(shown[0].sourcePage, 'homePage');
  assert.equal(elements.get('playlistList').children.length, 51);
  assert.equal(run('spotifyPlaylistCache[0].id'), '0');
  const sampled = run('samplePlaylists([null,{id:"a"},{id:"a"},{id:"b"},{}])');
  assert.deepEqual(Array.from(sampled, p => p.id).sort(), ['a', 'b']);
});

test('late playlist errors cannot clear a newer Home/library response', async () => {
  let rejectOld;
  const { run, elements } = app(async () => new Promise((resolve, reject) => { rejectOld = reject; }));
  const old = run('loadSpotifyPlaylists()');
  await new Promise(resolve => setImmediate(resolve));
  run('fetchSpotifyPages = async () => [{id:"new",name:"New account list"}];');
  await run('loadSpotifyPlaylists()');
  rejectOld(Error('late error'));
  await old;
  assert.equal(run('spotifyPlaylistCache[0].id'), 'new');
  assert.equal(elements.get('homePlaylists').children.length, 1);
  run('getFreshSpotifyToken = async () => "";');
  await run('loadSpotifyPlaylists()');
  assert.equal(run('spotifyPlaylistCache.length'), 0);
  assert.match(elements.get('homePlaylists').innerHTML, /ログイン/);
  assert.equal(elements.get('playlistList').children.length, 0);
});

test('saved Home cards browse without starting playback and remember the return page', async () => {
  const { run, elements } = app(async () => response({ items: [{ item: track('song') }] }));
  run('spotifyPlaylistCache = [{id:"mine",name:"My playlist"}];createTrackCard = (track) => ({track});renderHomePlaylists();');
  await elements.get('homePlaylists').children[0].click();
  assert.equal(run('playlistSourcePage'), 'homePage');
  assert.equal(run('currentPlaylist.length'), 0);
  assert.equal(elements.get('playlistTracks').children.length, 1);
});

test('preset mood with an artist and explicit genre sends all conditions to the curator', async () => {
  let payload;
  const { run } = app(async (url, options) => {
    assert.equal(url, '/api/gemini/recommend-from-mood');
    payload = JSON.parse(options.body);
    return response({ tracks: ['a','b','c','d','e'].map(track) });
  });
  run('selectedMood="落ち着きたい"; selectedArtistId="artist"; selectedArtistName="Artist"; setSelectedGenre("jazz"); displayPlaylist=()=>{}; showToast=()=>{};');
  await run('makePlaylist()');
  assert.equal(payload.genre, 'jazz');
  assert.equal(payload.artistId, 'artist');
  assert.equal(payload.text, '落ち着きたい');
});

test('curator applies an explicit genre to artist catalogue queries and ranking', async () => {
  const routes = new Map();
  const expressApp = { set() {}, use() {}, listen() {}, get() {}, post(path, handler) { routes.set(path, handler); } };
  const express = Object.assign(() => expressApp, { json: () => {}, static: () => {} });
  const context = vm.createContext({
    console: { log() {}, error() {} }, process: { env: {} }, Buffer, URLSearchParams,
    require(name) {
      if (name === 'express') return express;
      if (name === 'dotenv') return { config() {} };
      if (name === '@google/genai') return {};
      return require(name);
    },
  });
  vm.runInContext(fs.readFileSync('server.js', 'utf8'), context);
  vm.runInContext(`getSpotifyToken=async()=>"test";get80Tracks=async(token,query)=>{globalThis.catalogQuery=query;return Array.from({length:5},(_,i)=>({id:String(i),uri:'spotify:track:'+i,name:'Song '+i,artists:[{id:'artist',name:'Artist'}]}));};generateContentWithRetry=async(prompt)=>{globalThis.rankPrompt=prompt;return JSON.stringify({selected:[0,1,2,3,4].map(index=>({index}))});};`, context);
  let body;
  await routes.get('/api/gemini/recommend-from-mood')({ body: { text: '静か', artistId: 'artist', artistName: 'Artist', genre: 'jazz', analysis: { mood: 'calm' } } }, { json(value) { body = value; }, status() { return this; } });
  assert.equal(context.catalogQuery, 'artist:"Artist" genre:"jazz"');
  assert.match(context.rankPrompt, /希望ジャンル: jazz/);
  assert.equal(body.tracks.length, 5);
  vm.runInContext(`globalThis.searchQueries=[];searchSpotifyTracks=async(token,query)=>{searchQueries.push(query);return {tracks:{items:Array.from({length:5},(_,i)=>({id:String(i),uri:'spotify:track:'+i,name:'Song '+i}))}};};`, context);
  await routes.get('/api/gemini/recommend-from-mood')({ body: { text: '静か', genre: 'jazz', analysis: { keywords: ['calm'], searchQueries: ['night'] } } }, { json(value) { body = value; }, status() { return this; } });
  assert.equal(context.searchQueries.length, 2);
  assert.ok(context.searchQueries.every(q => q.includes('genre:"jazz"')));
  assert.equal(body.tracks.length, 5);
});

function memoryStorage(run) {
  run('globalThis.savedData = new Map(); localStorage.getItem = key => savedData.get(key) || null; localStorage.setItem = (key,value) => savedData.set(key,value);');
}

test('selection presets persist, overwrite by name, restore all conditions without playing, and delete', () => {
  const { run, elements } = app();
  memoryStorage(run);
  run('initSelectionPresets();selectedMood="楽しい";selectedArtistId="artist";selectedArtistName="Artist";selectedGenre="jazz";excludeRecent=true;document.getElementById("presetName").value="帰り道";saveSelectionPreset();');
  assert.equal(run('readSelectionPresets().length'), 1);
  assert.equal(run('readSelectionPresets()[0].excludeRecent'), true);
  run('aiMoodText="夜にゆっくり";saveSelectionPreset();');
  assert.equal(run('readSelectionPresets().length'), 1);
  assert.equal(run('readSelectionPresets()[0].mood'), '');
  run('document.getElementById("genre").options=[{value:"all"},{value:"jazz"}];selectedArtistId="other";setSelectedGenre("all");excludeRecent=false;applySelectionPreset(readSelectionPresets()[0]);');
  assert.equal(run('aiMoodText'), '夜にゆっくり');
  assert.equal(run('selectedArtistId'), 'artist');
  assert.equal(run('selectedGenre'), 'jazz');
  assert.equal(run('excludeRecent'), true);
  assert.equal(run('aiMoodAnalysis'), null);
  assert.equal(run('currentPlaylist.length'), 0);
  elements.get('deletePreset').click();
  assert.equal(run('readSelectionPresets().length'), 0);
});

test('preset storage handles malformed data, capacity and write failures', () => {
  const { run, elements } = app();
  memoryStorage(run);
  run('localStorage.setItem(SELECTION_PRESETS_KEY,"{}");');
  assert.equal(run('readSelectionPresets().length'), 0);
  run('localStorage.setItem(SELECTION_PRESETS_KEY,JSON.stringify(Array.from({length:20},(_,i)=>({id:String(i),name:"Preset"+i,mood:"楽しい"}))));selectedMood="楽しい";document.getElementById("presetName").value="Extra";saveSelectionPreset();');
  assert.equal(run('readSelectionPresets().length'), 20);
  assert.match(elements.get('presetStatus').textContent, /20件/);
  run('document.getElementById("presetName").value="Preset0";localStorage.setItem=()=>{throw Error("quota")};saveSelectionPreset();');
  assert.match(elements.get('presetStatus').textContent, /保存できません/);
  assert.equal(run('readSelectionPresets().length'), 20);
});

test('loading a preset discards an older mood analysis response', async () => {
  let finish;
  const { run, elements } = app(async () => new Promise(resolve => { finish = resolve; }));
  memoryStorage(run);
  run('initHome();document.getElementById("freeMoodInput").value="old text";document.getElementById("genre").options=[{value:"all"}];');
  const analysis = elements.get('aiMoodButton').click();
  run('applySelectionPreset({name:"New",mood:"楽しい",freeMood:"",artistId:"",artistName:"",genre:"all",excludeRecent:false});');
  finish(response({ analysis: { mood: 'しんみり', summary: 'old result' } }));
  await analysis;
  assert.equal(run('selectedMood'), '楽しい');
  assert.equal(run('aiMoodAnalysis'), null);
  assert.equal(elements.get('aiMoodResult').textContent, '');
});

test('recent exclusion uses only the latest 50 local tracks, handles relinks and is optional', () => {
  const { run } = app();
  memoryStorage(run);
  run('localStorage.setItem("music_picker_history",JSON.stringify(Array.from({length:60},(_,i)=>({uri:"spotify:track:"+i,linked_from:i===0?{uri:"spotify:track:original"}:undefined}))));');
  assert.equal(run('getRecentTrackUris().length'), 0);
  run('excludeRecent=true;');
  assert.equal(run('getRecentTrackUris().length'), 51);
  assert.equal(run('getRecentTrackUris().includes("spotify:track:50")'), false);
  assert.equal(run('getRecentTrackUris().includes("spotify:track:original")'), true);
  run('localStorage.setItem("music_picker_history","null");');
  assert.equal(run('getRecentTrackUris().length'), 0);
});

test('direct artist picks filter history before taking five; insufficient results never display excluded tracks', async () => {
  let catalogue = Array.from({ length: 8 }, (_, i) => track(String(i)));
  const { run } = app(async () => response(catalogue));
  memoryStorage(run);
  run('selectedMood="楽しい";selectedArtistId="artist";excludeRecent=true;localStorage.setItem("music_picker_history",JSON.stringify([{uri:"spotify:track:0"},{uri:"spotify:track:1"}]));displayPlaylist=tracks=>{window.result=tracks};showToast=()=>{};globalThis.alert=message=>{window.error=message};');
  await run('makePlaylist()');
  assert.deepEqual(Array.from(run('window.result'), t => t.id), ['2','3','4','5','6']);
  catalogue = [track('0'),track('1'),track('2')];
  run('window.result=null;');
  await run('makePlaylist()');
  assert.equal(run('window.result'), null);
  assert.match(run('window.error'), /5曲そろいません/);
  run('excludeRecent=false;');
  await run('makePlaylist()');
  assert.equal(run('window.result[0].id'), '0');
});

function exclusionServer() {
  const routes = new Map();
  const expressApp = { set() {}, use() {}, listen() {}, get() {}, post(path, handler) { routes.set(path, handler); } };
  const express = Object.assign(() => expressApp, { json: () => {}, static: () => {} });
  const context = vm.createContext({console:{log(){},error(){}},process:{env:{}},Buffer,URLSearchParams,
    require(name) { if(name==='express')return express;if(name==='dotenv')return {config(){}};if(name==='@google/genai')return {};return require(name); }
  });
  vm.runInContext(fs.readFileSync('server.js','utf8'),context);
  vm.runInContext('getSpotifyToken=async()=>"synthetic";globalThis.rankCalls=0;generateContentWithRetry=async prompt=>{rankCalls++;globalThis.lastPrompt=prompt;return JSON.stringify({selected:[{index:0},{index:0},{index:999},{index:1}]})};',context);
  return {context,run:code=>vm.runInContext(code,context),async recommend(body){let result,status=200;await routes.get('/api/gemini/recommend-from-mood')({body:{text:'calm',analysis:{keywords:[],searchQueries:[]},...body}},{json(value){result=value},status(value){status=value;return this}});return {result,status};}};
}

test('curator excludes history before ranking and fills duplicate AI selections with distinct eligible tracks', async () => {
  const api = exclusionServer();
  api.run('get80Tracks=async()=>Array.from({length:40},(_,i)=>({id:String(i),uri:"spotify:track:"+i,artists:[{id:"artist"}]}));');
  const { result, status } = await api.recommend({ artistId:'artist',excludedTrackUris:Array.from({length:31},(_,i)=>`spotify:track:${i}`) });
  assert.equal(status,200);
  assert.deepEqual(Array.from(result.tracks,t=>t.id),['31','32','33','34','35']);
});

test('curator searches later pages for unseen tracks and reports exclusion exhaustion', async () => {
  const api=exclusionServer();
  api.run('globalThis.offsets=[];searchSpotifyTracks=async(token,query,limit,offset)=>{offsets.push(offset);return {tracks:{items:Array.from({length:offset===20?4:10},(_,i)=>({id:String(offset+i),uri:"spotify:track:"+(offset+i)}))}}};');
  const response=await api.recommend({excludedTrackUris:Array.from({length:10},(_,i)=>`spotify:track:${i}`)});
  assert.equal(response.status,200);
  assert.deepEqual(Array.from(api.context.offsets),[0,10,20]);
  assert.ok(response.result.tracks.every(t=>Number(t.id)>=10));
  api.run('get80Tracks=async()=>[{id:"a",uri:"spotify:track:a",artists:[{id:"artist"}]}];rankCalls=0;');
  const empty=await api.recommend({artistId:'artist',excludedTrackUris:['spotify:track:a']});
  assert.equal(empty.status,404);
  assert.match(empty.result.error,/最近聴いた曲/);
  assert.equal(api.context.rankCalls,0);
});
