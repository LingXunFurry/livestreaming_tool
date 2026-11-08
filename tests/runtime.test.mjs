import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, mkdir, rm, access, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { projectRoot } from '../server/config.mjs';

const execute = promisify(execFile);

async function unusedPort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function cli(command, environment) {
  try {
    const { stdout } = await execute(process.execPath, [path.join(projectRoot, 'scripts', 'runtime.mjs'), command, '--json'], { cwd: os.tmpdir(), env: { ...process.env, ...environment }, timeout: 40000 });
    return { exitCode: 0, ...JSON.parse(stdout.trim()) };
  } catch (error) {
    if (!error.stdout?.trim()) throw error;
    return { exitCode: error.code, ...JSON.parse(error.stdout.trim()) };
  }
}

async function nextJsonMessage(socket) {
  const [message] = await once(socket, 'message');
  return JSON.parse(message.toString());
}

function nextSettingsUpdate(socket, platform) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error('等待设置同步超时'));
    }, 5000);
    function onMessage(raw) {
      const message = JSON.parse(raw.toString());
      if (message.type !== 'settings.updated' || (platform && message.data.platform !== platform)) return;
      clearTimeout(timeout);
      socket.off('message', onMessage);
      resolve(message);
    }
    socket.on('message', onMessage);
  });
}

test('真实服务生命周期、并发、关闭、冲突与恢复', { timeout: 120000 }, async context => {
  const directory = await mkdtemp(path.join(os.tmpdir(), '酒馆 runtime 测试 '));
  const port = await unusedPort();
  const environment = { TAVERN_DATA_DIR: directory, TAVERN_PORT: String(port) };
  const origin = `http://127.0.0.1:${port}`;
  let socket;
  let settingsSocket;
  try {
    await context.test('启动前 STOPPED，后台进程通过真实健康检查', async () => {
      assert.equal((await cli('status', environment)).state, 'STOPPED');
      const result = await cli('start', environment);
      assert.equal(result.exitCode, 0);
      assert.equal(result.state, 'RUNNING');
      assert.equal(result.checkpoint, 'CP7');
      assert.equal(result.port, port);
      assert.equal(result.adapters.music.state, 'DISCONNECTED');
      assert.equal(result.adapters.bilibili.state, 'NOT_CONFIGURED');
      assert.equal(result.adapters.douyin, undefined);
      assert.equal((await (await fetch(`${origin}/health`)).json()).ready, true);
    });

    await context.test('重复启动复用同一实例', async () => {
      const first = await cli('status', environment);
      const repeated = await cli('start', environment);
      assert.equal(repeated.reused, true);
      assert.equal(first.instanceId, repeated.instanceId);
      assert.deepEqual(first.pageChecks, { bilibili: true, douyin: true, admin: true });
      assert.equal(first.websocketReachable, true);
    });

    await context.test('双平台和后台同时可访问，敏感文件与未知 API 不暴露', async () => {
      const responses = await Promise.all(['/live/bilibili', '/live/douyin', '/admin', '/assets/review', '/scene/review'].map(route => fetch(origin + route)));
      for (const response of responses) { assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /text\/html/); }
      assert.equal((await fetch(`${origin}/api/missing`)).status, 404);
      assert.equal((await fetch(`${origin}/data/settings.json`)).status, 404);
      assert.equal((await fetch(`${origin}/%2e%2e%2fpackage.json`)).status, 403);
      const metadata = JSON.parse(await readFile(path.join(directory, 'runtime', 'instance.json'), 'utf8'));
      const publicStatus = await (await fetch(`${origin}/api/runtime/status`)).text();
      assert.ok(!publicStatus.includes(metadata.controlToken));
      assert.ok(!publicStatus.includes(projectRoot));
      assert.equal((await fetch(`${origin}/api/runtime/stop`, { method: 'POST' })).status, 403);
      assert.equal((await fetch(`${origin}/api/runtime/stop`, { method: 'POST', headers: { 'x-tavern-control': metadata.controlToken, Origin: 'https://unrelated.example' } })).status, 403);
    });

    await context.test('后台覆盖全部直播页字段并保持平台设置隔离', async () => {
      const initial = await (await fetch(`${origin}/api/settings`)).json();
      assert.deepEqual(Object.keys(initial.settings.global).sort(), ['fontSizes', 'task']);
      assert.deepEqual(Object.keys(initial.settings.platforms.bilibili).sort(), ['announcementText', 'boardMode', 'bottomAnnouncementText', 'fontSizes', 'lyricsAutoHide', 'lyricsEnabled', 'roomAddress']);
      assert.deepEqual(Object.keys(initial.settings.platforms.douyin).sort(), ['announcementText', 'bottomAnnouncementText', 'fontSizes', 'lyricsAutoHide', 'lyricsEnabled']);
      settingsSocket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      assert.equal((await nextJsonMessage(settingsSocket)).type, 'runtime.status');
      const payload = {
        global: { task: '寻找今晚的风', fontSizes: initial.settings.global.fontSizes },
        music: initial.settings.music,
        platforms: {
          bilibili: { roomAddress: 'https://live.bilibili.com/14041317', boardMode: 'announcement', announcementText: 'B 站今晚公告', lyricsEnabled: false, lyricsAutoHide: false, bottomAnnouncementText: 'B站底部公告\n第二行', fontSizes: initial.settings.platforms.bilibili.fontSizes },
          douyin: initial.settings.platforms.douyin,
        },
      };
      const updatePromise = nextSettingsUpdate(settingsSocket);
      const saved = await fetch(`${origin}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      assert.equal(saved.status, 200);
      assert.deepEqual((await saved.json()).settings, payload);
      const update = await updatePromise;
      assert.equal(update.type, 'settings.updated');
      assert.equal(update.data.platform, 'bilibili');
      assert.equal(update.data.global.task, '寻找今晚的风');
      assert.equal(update.data.platformSettings.boardMode, 'announcement');
      assert.equal(update.data.platformSettings.bottomAnnouncementText, 'B站底部公告\n第二行');
      const afterSave = (await (await fetch(`${origin}/api/settings`)).json()).settings;
      assert.equal(afterSave.global.task, '寻找今晚的风');
      assert.equal(afterSave.platforms.douyin.boardMode, initial.settings.platforms.douyin.boardMode);
      assert.equal(afterSave.platforms.douyin.bottomAnnouncementText, '');
      assert.equal(afterSave.platforms.bilibili.roomAddress, 'https://live.bilibili.com/14041317');
      assert.equal(afterSave.platforms.douyin.roomAddress, undefined);
      const backupCount = (await readdir(path.join(directory, 'backups'))).length;
      const invalid = await fetch(`${origin}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, global: { ...payload.global, title: 42 } }) });
      assert.equal(invalid.status, 400);
      assert.equal((await (await fetch(`${origin}/api/settings`)).json()).settings.global.task, '寻找今晚的风');
      assert.equal((await readdir(path.join(directory, 'backups'))).length, backupCount);
    });

    await context.test('仅 B 站房间地址可配置，抖音旧采集地址被忽略', async () => {
      const settings = (await (await fetch(`${origin}/api/settings`)).json()).settings;
      for (const address of ['http://live.bilibili.com/123', 'https://evil.example/123', 'https://user:pass@live.bilibili.com/123']) {
        const invalid = structuredClone(settings);
        invalid.platforms.bilibili.roomAddress = address;
        assert.equal((await fetch(`${origin}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invalid) })).status, 400);
      }
      const legacy = structuredClone(settings);
      delete legacy.platforms.bilibili.roomAddress;
      legacy.platforms.douyin.roomAddress = 'https://live.douyin.com/523485074400';
      legacy.platforms.douyin.boardMode = 'comments';
      const response = await fetch(`${origin}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(legacy) });
      assert.equal(response.status, 200);
      const saved = (await response.json()).settings;
      assert.equal(saved.platforms.bilibili.roomAddress, settings.platforms.bilibili.roomAddress);
      assert.equal(saved.platforms.douyin.roomAddress, undefined);
      assert.equal(saved.platforms.douyin.boardMode, undefined);
      assert.equal((await (await fetch(`${origin}/ws/douyin`)).status), 404);
    });

    await context.test('底部公告严格校验，旧后台保存兼容且平台隔离', async () => {
      const { settings } = await (await fetch(`${origin}/api/settings`)).json();
      for (const bottomAnnouncementText of [null, 42, '告'.repeat(2502)]) {
        const invalid = structuredClone(settings);
        invalid.platforms.douyin.bottomAnnouncementText = bottomAnnouncementText;
        assert.equal((await fetch(`${origin}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invalid) })).status, 400);
      }
      const legacyPayload = structuredClone(settings);
      delete legacyPayload.platforms.bilibili.bottomAnnouncementText;
      legacyPayload.platforms.douyin.bottomAnnouncementText = '抖音底部公告';
      const updatePromise = nextSettingsUpdate(settingsSocket);
      const saved = await fetch(`${origin}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(legacyPayload) });
      assert.equal(saved.status, 200);
      const result = (await saved.json()).settings;
      assert.equal(result.platforms.bilibili.bottomAnnouncementText, settings.platforms.bilibili.bottomAnnouncementText);
      assert.equal(result.platforms.douyin.bottomAnnouncementText, '抖音底部公告');
      const update = await updatePromise;
      assert.equal(update.data.platform, 'douyin');
      assert.equal(update.data.platformSettings.bottomAnnouncementText, '抖音底部公告');
    });

    await context.test('分区字号校验、全局同步与旧后台保存兼容', async () => {
      const { settings } = await (await fetch(`${origin}/api/settings`)).json();
      const backupCount = (await readdir(path.join(directory, 'backups'))).length;
      for (const fontSizes of [null, [], { lyrics: 25 }, { benefits: '24' }, { benefits: 12.5 }, { comments: 37 }, { announcement: 41 }, { song: 11 }, { unknown: 20 }]) {
        const invalid = structuredClone(settings);
        invalid.platforms.bilibili.fontSizes = fontSizes;
        assert.equal((await fetch(`${origin}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invalid) })).status, 400);
      }
      assert.equal((await readdir(path.join(directory, 'backups'))).length, backupCount);
      settings.global.fontSizes = { task: 56, bottomLabel: 32 };
      settings.platforms.bilibili.fontSizes = { comments: 36, announcement: 40, song: 24, lyrics: 24, benefits: 40 };
      const bilibiliUpdate = nextSettingsUpdate(settingsSocket, 'bilibili');
      const douyinUpdate = nextSettingsUpdate(settingsSocket, 'douyin');
      assert.equal((await fetch(`${origin}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })).status, 200);
      assert.deepEqual((await bilibiliUpdate).data.global.fontSizes, settings.global.fontSizes);
      assert.deepEqual((await douyinUpdate).data.global.fontSizes, settings.global.fontSizes);
      const legacy = structuredClone(settings);
      delete legacy.global.fontSizes;
      delete legacy.platforms.bilibili.fontSizes;
      legacy.platforms.douyin.fontSizes = { benefits: 32 };
      const saved = await fetch(`${origin}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(legacy) });
      assert.equal(saved.status, 200);
      const actual = (await saved.json()).settings;
      assert.deepEqual(actual.global.fontSizes, settings.global.fontSizes);
      assert.deepEqual(actual.platforms.bilibili.fontSizes, settings.platforms.bilibili.fontSizes);
      assert.deepEqual(actual.platforms.douyin.fontSizes, { ...settings.platforms.douyin.fontSizes, benefits: 32 });
    });

    await context.test('音乐桥接经真实服务同步、控制、断线降级和恢复', async () => {
      let playing = false;
      let track = 1;
      const bridge = http.createServer((request, response) => {
        response.setHeader('Content-Type', 'application/json');
        if (request.url === '/info') return response.end(JSON.stringify({ process_active: true, playing, basic_info: { id: track, name: `接口测试歌曲 ${track}`, artist: '测试歌手' }, playback: { current_sec: 2, total_sec: 60 } }));
        if (request.url === '/lyrics') return response.end(JSON.stringify({ id: track, lrc: '[00:00.00]测试第一行\n[00:03.00]测试第二行' }));
        if (request.method === 'POST' && request.url === '/control/playpause') playing = !playing;
        else if (request.method === 'POST' && request.url === '/control/next') track += 1;
        else { response.statusCode = 404; return response.end('{}'); }
        response.end('{"code":200}');
      });
      bridge.listen(0, '127.0.0.1');
      await once(bridge, 'listening');
      const original = (await (await fetch(`${origin}/api/settings`)).json()).settings;
      const events = [];
      const capture = raw => { const message = JSON.parse(raw.toString()); if (message.type === 'music.updated') events.push(message.data); };
      settingsSocket.on('message', capture);
      const waitMusic = async predicate => {
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const snapshot = await (await fetch(`${origin}/api/music`)).json();
          if (predicate(snapshot)) return snapshot;
          await delay(50);
        }
        assert.fail('音乐快照未在限时内更新');
      };
      try {
        assert.equal((await (await fetch(`${origin}/api/music`)).json()).state, 'DISCONNECTED');
        const configured = structuredClone(original);
        configured.music = { enabled: true, baseUrl: `http://127.0.0.1:${bridge.address().port}` };
        assert.equal((await fetch(`${origin}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configured) })).status, 200);
        const connected = await waitMusic(value => value.state === 'CONNECTED');
        assert.equal(connected.title, '接口测试歌曲 1');
        assert.equal(connected.lyrics.length, 2);
        assert.ok(events.some(value => value.state === 'CONNECTED'));
        assert.equal((await fetch(`${origin}/api/music/control`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' }, body: '{"action":"next"}' })).status, 403);
        assert.equal((await fetch(`${origin}/api/music/control`, { method: 'POST', body: '{}' })).status, 415);
        assert.equal((await fetch(`${origin}/api/music/control`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"shutdown"}' })).status, 400);
        assert.equal((await fetch(`${origin}/api/music/control`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"playpause"}' })).status, 200);
        await waitMusic(value => value.playing);
        await fetch(`${origin}/api/music/control`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"next"}' });
        await waitMusic(value => value.title === '接口测试歌曲 2');
        const bridgePort = bridge.address().port;
        await new Promise(resolve => bridge.close(resolve));
        const unavailable = await waitMusic(value => value.state === 'UNAVAILABLE');
        assert.equal(unavailable.title, '');
        assert.deepEqual(unavailable.lyrics, []);
        assert.equal((await (await fetch(`${origin}/api/runtime/status`)).json()).state, 'DEGRADED');
        assert.equal((await fetch(`${origin}/live/bilibili`)).status, 200);
        assert.equal((await fetch(`${origin}/live/douyin`)).status, 200);
        bridge.listen(bridgePort, '127.0.0.1');
        await once(bridge, 'listening');
        await waitMusic(value => value.state === 'CONNECTED');
      } finally {
        settingsSocket.off('message', capture);
        await fetch(`${origin}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(original) });
        if (bridge.listening) await new Promise(resolve => bridge.close(resolve));
      }
    });

    await context.test('WebSocket 真实快照与正常关闭', async () => {
      socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      const [message] = await once(socket, 'message');
      assert.equal(JSON.parse(message.toString()).type, 'runtime.status');
      const closed = once(socket, 'close');
      assert.equal((await cli('stop', environment)).state, 'STOPPED');
      const [closeCode] = await closed;
      assert.equal(closeCode, 1001);
      assert.equal((await cli('status', environment)).state, 'STOPPED');
      assert.equal((await cli('stop', environment)).state, 'STOPPED');
      await assert.rejects(access(path.join(directory, 'runtime', 'instance.json')));
      const probe = net.createServer();
      probe.listen(port, '127.0.0.1');
      await once(probe, 'listening');
      await new Promise(resolve => probe.close(resolve));
    });

    await context.test('两个同时启动命令仅创建一个服务', async () => {
      const results = await Promise.all([cli('start', environment), cli('start', environment)]);
      assert.ok(results.every(result => result.state === 'RUNNING'));
      assert.equal(results[0].instanceId, results[1].instanceId);
      const { settings } = await (await fetch(`${origin}/api/settings`)).json();
      assert.equal(settings.platforms.bilibili.bottomAnnouncementText, 'B站底部公告\n第二行');
      assert.equal(settings.platforms.douyin.bottomAnnouncementText, '抖音底部公告');
      assert.equal(settings.global.fontSizes.task, 56);
      assert.equal(settings.platforms.bilibili.fontSizes.comments, 36);
      assert.equal(settings.platforms.douyin.fontSizes.benefits, 32);
      assert.deepEqual(results.map(result => result.reused).sort(), [false, true]);
      await cli('stop', environment);
    });

    await context.test('端口冲突有明确错误，无关进程保持运行', async () => {
      const unrelated = net.createServer();
      unrelated.listen(port, '127.0.0.1');
      await once(unrelated, 'listening');
      try {
        const result = await cli('start', environment);
        assert.equal(result.state, 'ERROR');
        assert.notEqual(result.exitCode, 0);
        assert.ok(result.message.includes(String(port)));
        assert.equal((await cli('stop', environment)).state, 'STOPPED');
        assert.equal(unrelated.listening, true);
      } finally { await new Promise(resolve => unrelated.close(resolve)); }
    });

    await context.test('失效锁和运行记录恢复', async () => {
      await mkdir(path.join(directory, 'runtime'), { recursive: true });
      await writeFile(path.join(directory, 'runtime', 'start.lock'), JSON.stringify({ pid: 2147483647, createdAt: 0 }));
      await writeFile(path.join(directory, 'runtime', 'instance.json'), JSON.stringify({ pid: 2147483647, port, instanceId: 'stale', projectKey: 'stale' }));
      assert.equal((await cli('start', environment)).state, 'RUNNING');
      await cli('stop', environment);
    });

    await context.test('非法配置 ERROR，启用但未接入的适配器 DEGRADED', async () => {
      const settingsFile = path.join(directory, 'settings.json');
      const settings = JSON.parse(await readFile(settingsFile, 'utf8'));
      await writeFile(settingsFile, JSON.stringify({ ...settings, server: { ...settings.server, host: '0.0.0.0' } }));
      assert.equal((await cli('start', environment)).state, 'ERROR');
      const unavailablePort = await unusedPort();
      await writeFile(settingsFile, JSON.stringify({ ...settings, adapters: { music: { enabled: true, baseUrl: `http://127.0.0.1:${unavailablePort}` }, bilibili: { enabled: true } } }));
      assert.equal((await cli('start', environment)).state, 'DEGRADED');
      const state = await cli('status', environment);
      assert.equal(state.state, 'DEGRADED');
      assert.equal(state.adapters.music.state, 'UNAVAILABLE');
      assert.ok(Object.values(state.pageChecks).every(Boolean));
    });
  } finally {
    socket?.terminate();
    settingsSocket?.terminate();
    await cli('stop', environment);
    await rm(directory, { recursive: true, force: true });
  }
});
