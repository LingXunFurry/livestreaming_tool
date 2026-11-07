import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createLocalMusicBridge } from '../server/music-bridge.mjs';

const config = { enabled: true, baseUrl: 'http://127.0.0.1:18726' };

test('本地桥接缺少依赖时不影响服务', { skip: process.platform !== 'win32' }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tavern-bridge-'));
  const events = [];
  const bridge = createLocalMusicBridge(root, event => events.push(event));
  try {
    await bridge.start(config);
    assert.ok(events.includes('music_bridge_missing'));
  } finally { await bridge.close(); await rm(root, { recursive: true, force: true }); }
});

test('本地桥接只关闭自己启动的进程', { skip: process.platform !== 'win32', timeout: 15000 }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tavern-bridge-'));
  const events = [];
  const bridge = createLocalMusicBridge(root, (event, detail) => events.push({ event, detail }));
  const external = net.createServer();
  try {
    await mkdir(path.join(root, '.cache', 'netease-venv', 'Scripts'), { recursive: true });
    await mkdir(path.join(root, '.cache', 'netease-bridge'), { recursive: true });
    await mkdir(path.join(root, 'scripts'), { recursive: true });
    await copyFile(process.execPath, path.join(root, '.cache', 'netease-venv', 'Scripts', 'python.exe'));
    await writeFile(path.join(root, '.cache', 'netease-bridge', 'main.py'), '');
    await writeFile(path.join(root, 'scripts', 'music-bridge.py'), 'setInterval(() => {}, 1000);');
    await new Promise(resolve => external.listen(0, '127.0.0.1', resolve));
    let probePort = external.address().port;
    const createServer = net.createServer;
    t.mock.method(net, 'createServer', (...args) => {
      const server = createServer(...args);
      const listen = server.listen;
      server.listen = function (_port, host, callback) { return listen.call(this, probePort, host, callback); };
      return server;
    });
    await bridge.start(config);
    assert.ok(events.some(item => item.event === 'music_bridge_port_in_use'));
    assert.ok(external.listening);
    probePort = 0;
    await Promise.all([bridge.start(config), bridge.start(config)]);
    const starts = events.filter(item => item.event === 'music_bridge_start_requested');
    assert.equal(starts.length, 1);
    const pid = starts[0].detail.pid;
    assert.ok(pid > 0);
    process.kill(pid, 0);
    await bridge.close();
    assert.ok(external.listening);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try { process.kill(pid, 0); } catch { return; }
      await delay(100);
    }
    assert.fail('桥接子进程未停止');
  } finally { await bridge.close(); if (external.listening) await new Promise(resolve => external.close(resolve)); await rm(root, { recursive: true, force: true }); }
});
