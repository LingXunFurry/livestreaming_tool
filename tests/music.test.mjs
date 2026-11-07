import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createMusicAdapter, normalizeInfo, parseLyrics } from '../server/music.mjs';
import { currentLyricIndex, disconnectedMusic, musicStatusLabel } from '../src/music.ts';

test('标准歌词、多时间标签、偏移、逐字歌词与输入上限', () => {
  assert.deepEqual(parseLyrics('[offset:100]\n[00:01.20][00:02:345]测试文本\n[00:03.000]\n[00:99.00]无效'), [
    { timeMs: 1100, text: '测试文本' }, { timeMs: 2245, text: '测试文本' }, { timeMs: 2900, text: '' },
  ]);
  assert.deepEqual(parseLyrics('[1200,300](1200,100,0)像(1300,200,0)素'), [{ timeMs: 1200, text: '像素' }]);
  assert.deepEqual(parseLyrics('纯音乐'), []);
  assert.throws(() => parseLyrics('a'.repeat(131073)), /BAD_RESPONSE/);
  assert.throws(() => parseLyrics({}), /BAD_RESPONSE/);
});

test('真实播放信息校验、暂停和逐行定位', () => {
  const info = { process_active: true, playing: false, basic_info: { id: 1, name: '测试歌曲', artist: '测试歌手' }, playback: { current_sec: 2.5, total_sec: 10 } };
  const music = { ...normalizeInfo(info), lyrics: [{ timeMs: 1000, text: '一' }, { timeMs: 3000, text: '二' }] };
  assert.equal(music.positionMs, 2500);
  assert.equal(music.playbackState, 'PAUSED');
  assert.equal(currentLyricIndex(music), 0);
  assert.equal(currentLyricIndex({ ...music, positionMs: 3000 }), 1);
  assert.equal(currentLyricIndex({ ...music, positionMs: 0 }), -1);
  assert.equal(musicStatusLabel(music), '已暂停');
  assert.equal(musicStatusLabel(disconnectedMusic), '连接已关闭');
  assert.equal(normalizeInfo({ ...info, process_active: false }).playbackState, 'CLIENT_CLOSED');
  assert.throws(() => normalizeInfo({ ...info, playback: { current_sec: -1, total_sec: 10 } }), /BAD_RESPONSE/);
});

test('适配器隔离坏数据、歌词缺失、并发控制与中途关闭', { timeout: 15000 }, async () => {
  let mode = 'valid';
  let lyricMode = 'valid';
  let track = 1;
  let playing = false;
  let inFlight = 0;
  let maxInFlight = 0;
  const bridge = http.createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/info') {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(20);
      inFlight -= 1;
      if (mode === 'redirect') { response.writeHead(302, { Location: 'http://example.com' }); return response.end(); }
      if (mode === 'oversized') return response.end('a'.repeat(262145));
      if (mode === 'invalid') return response.end('{}');
      return response.end(JSON.stringify({ process_active: mode !== 'closed', playing, basic_info: { id: track, name: '测试歌曲', artist: '测试歌手' }, playback: { current_sec: 1, total_sec: 60 } }));
    }
    if (request.url === '/lyrics') {
      if (lyricMode === 'failed') { response.statusCode = 500; return response.end('{}'); }
      return response.end(JSON.stringify({ id: track, lrc: lyricMode === 'none' ? '' : '[00:00.00]测试文字' }));
    }
    await delay(80);
    playing = !playing;
    response.end('{"code":200}');
  });
  bridge.listen(0, '127.0.0.1');
  await once(bridge, 'listening');
  const baseUrl = `http://127.0.0.1:${bridge.address().port}`;
  const adapter = createMusicAdapter(() => {});
  const waitState = async predicate => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (predicate(adapter.getState())) return adapter.getState();
      await delay(50);
    }
    assert.fail('适配器未更新到预期状态');
  };
  try {
    adapter.configure({ enabled: true, baseUrl });
    await waitState(value => value.state === 'CONNECTED');
    const control = adapter.control('playpause');
    await assert.rejects(adapter.control('next'), error => error.status === 409);
    await control;
    await waitState(value => value.playing);
    await assert.rejects(adapter.control('invalid'), error => error.status === 400);
    lyricMode = 'failed'; track += 1;
    await waitState(value => value.lyricsState === 'UNAVAILABLE');
    assert.equal(adapter.getState().state, 'CONNECTED');
    lyricMode = 'none'; track += 1;
    await waitState(value => value.lyricsState === 'NONE');
    assert.equal(adapter.getState().title, '测试歌曲');
    mode = 'invalid';
    await waitState(value => value.error === 'BAD_RESPONSE');
    assert.deepEqual(adapter.getState().lyrics, []);
    mode = 'oversized';
    await delay(600);
    assert.equal(adapter.getState().state, 'UNAVAILABLE');
    mode = 'redirect';
    await delay(600);
    assert.equal(adapter.getState().state, 'UNAVAILABLE');
    mode = 'closed';
    await waitState(value => value.playbackState === 'CLIENT_CLOSED');
    adapter.configure({ enabled: false, baseUrl });
    await delay(600);
    assert.equal(adapter.getState().state, 'DISCONNECTED');
    await assert.rejects(adapter.control('playpause'), error => error.status === 503);
    assert.equal(maxInFlight, 1);
  } finally {
    adapter.close();
    bridge.closeAllConnections();
    await new Promise(resolve => bridge.close(resolve));
  }
});
