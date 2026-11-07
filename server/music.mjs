const emptyState = (state, error = '') => ({
  state, error, playbackState: 'IDLE', trackId: '', title: '', artist: '', playing: false,
  positionMs: 0, durationMs: 0, lyrics: [], lyricsState: 'NONE', updatedAt: Date.now(),
});

export function parseLyrics(text) {
  if (typeof text !== 'string' || text.length > 131072) throw new Error('BAD_RESPONSE');
  const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0);
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const yrc = raw.match(/^\[(\d+),(\d+)\](.*)$/);
    if (yrc) {
      lines.push({ timeMs: Number(yrc[1]), text: yrc[3].replace(/\(\d+,\d+,\d+\)/g, '').trim().slice(0, 1000) });
      continue;
    }
    const tags = [...raw.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!tags.length) continue;
    const content = raw.slice(tags.at(-1).index + tags.at(-1)[0].length).trim().slice(0, 1000);
    for (const tag of tags) {
      if (Number(tag[2]) >= 60) continue;
      const timeMs = Number(tag[1]) * 60000 + Number(tag[2]) * 1000 + Number((tag[3] || '').padEnd(3, '0')) - offset;
      lines.push({ timeMs: Math.max(0, timeMs), text: content });
    }
  }
  if (lines.length > 2000) throw new Error('BAD_RESPONSE');
  return lines.filter(line => line.timeMs <= 86400000).sort((a, b) => a.timeMs - b.timeMs);
}

export function normalizeInfo(info) {
  if (!info || typeof info.process_active !== 'boolean' || typeof info.playing !== 'boolean') throw new Error('BAD_RESPONSE');
  if (!info.process_active) return { ...emptyState('CONNECTED'), playbackState: 'CLIENT_CLOSED' };
  const basic = info.basic_info;
  const playback = info.playback;
  if (!basic || typeof basic.name !== 'string' || basic.name.length > 500 || typeof basic.artist !== 'string' || basic.artist.length > 500
    || !['string', 'number'].includes(typeof basic.id) || String(basic.id).length > 100
    || !playback || !Number.isFinite(playback.current_sec) || !Number.isFinite(playback.total_sec)
    || playback.current_sec < 0 || playback.total_sec < 0 || playback.current_sec > 86400 || playback.total_sec > 86400) throw new Error('BAD_RESPONSE');
  const durationMs = Math.round(playback.total_sec * 1000);
  const title = basic.name.trim();
  return {
    ...emptyState('CONNECTED'), trackId: String(basic.id), title, artist: basic.artist,
    playbackState: !title ? 'IDLE' : info.playing ? 'PLAYING' : 'PAUSED', playing: Boolean(title && info.playing),
    positionMs: durationMs ? Math.min(durationMs, Math.round(playback.current_sec * 1000)) : 0, durationMs,
  };
}

export function createMusicAdapter(onUpdate) {
  let config = { enabled: false };
  let snapshot = emptyState('DISCONNECTED');
  let generation = 0;
  let timer;
  let controller = new AbortController();
  let lyricTrack = '';
  let lyrics = [];
  let lyricsState = 'NONE';
  let lastLyricsAttempt = 0;
  let controlling = false;

  function publish(next) { snapshot = next; onUpdate(snapshot); }

  async function request(endpoint, method = 'GET') {
    const response = await fetch(`${config.baseUrl}${endpoint}`, {
      method, redirect: 'error', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(1500)]),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('BRIDGE_UNAVAILABLE'); }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 262144) throw new Error('BAD_RESPONSE');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new Error('BAD_RESPONSE'); }
  }

  async function poll(currentGeneration) {
    try {
      const info = normalizeInfo(await request('/info'));
      if (currentGeneration !== generation) return;
      if (info.trackId !== lyricTrack) {
        lyricTrack = info.trackId;
        lyrics = [];
        lyricsState = 'LOADING';
        lastLyricsAttempt = 0;
      }
      if (info.title && (!lyrics.length || lyricsState === 'UNAVAILABLE') && Date.now() - lastLyricsAttempt >= 3000) {
        lastLyricsAttempt = Date.now();
        try {
          const packet = await request('/lyrics');
          if (currentGeneration !== generation) return;
          if (String(packet?.id) === info.trackId) {
            lyrics = parseLyrics(packet.lrc || packet.yrc || '');
            lyricsState = lyrics.length ? 'AVAILABLE' : 'NONE';
          } else lyricsState = 'LOADING';
        } catch {
          if (currentGeneration !== generation) return;
          lyricsState = 'UNAVAILABLE';
        }
      }
      if (currentGeneration !== generation) return;
      publish({ ...info, lyrics: info.title ? lyrics : [], lyricsState: info.title ? lyricsState : 'NONE', updatedAt: Date.now() });
    } catch (error) {
      if (currentGeneration !== generation) return;
      lyrics = [];
      lyricTrack = '';
      publish(emptyState('UNAVAILABLE', error.message === 'BAD_RESPONSE' ? 'BAD_RESPONSE' : 'BRIDGE_UNAVAILABLE'));
    } finally {
      if (currentGeneration === generation && config.enabled) timer = setTimeout(() => void poll(currentGeneration), 500);
    }
  }

  return {
    getState: () => snapshot,
    configure(next) {
      generation += 1;
      clearTimeout(timer);
      controller.abort();
      controller = new AbortController();
      config = next;
      lyrics = [];
      lyricTrack = '';
      lastLyricsAttempt = 0;
      publish(emptyState(next.enabled ? 'CONNECTING' : 'DISCONNECTED'));
      if (next.enabled) void poll(generation);
    },
    async control(action) {
      if (!['prev', 'next', 'playpause'].includes(action)) throw Object.assign(new Error('INVALID_MUSIC_ACTION'), { status: 400 });
      if (!config.enabled || snapshot.state !== 'CONNECTED' || snapshot.playbackState === 'CLIENT_CLOSED') throw Object.assign(new Error('MUSIC_NOT_CONNECTED'), { status: 503 });
      if (controlling) throw Object.assign(new Error('MUSIC_CONTROL_BUSY'), { status: 409 });
      controlling = true;
      try {
        const result = await request(`/control/${action}`, 'POST');
        if (result?.code !== 200) throw new Error('MUSIC_CONTROL_FAILED');
      } catch { throw Object.assign(new Error('MUSIC_CONTROL_FAILED'), { status: 502 }); }
      finally { controlling = false; }
    },
    close() { generation += 1; clearTimeout(timer); controller.abort(); },
  };
}
