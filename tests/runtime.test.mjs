import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
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

test('真实服务生命周期、并发、关闭、冲突与恢复', { timeout: 120000 }, async context => {
  const directory = await mkdtemp(path.join(os.tmpdir(), '酒馆 runtime 测试 '));
  const port = await unusedPort();
  const environment = { TAVERN_DATA_DIR: directory, TAVERN_PORT: String(port) };
  const origin = `http://127.0.0.1:${port}`;
  let socket;
  try {
    await context.test('启动前 STOPPED，后台进程通过真实健康检查', async () => {
      assert.equal((await cli('status', environment)).state, 'STOPPED');
      const result = await cli('start', environment);
      assert.equal(result.exitCode, 0);
      assert.equal(result.state, 'RUNNING');
      assert.equal(result.port, port);
      assert.equal(result.adapters.music.state, 'DISCONNECTED');
      assert.equal(result.adapters.bilibili.state, 'NOT_CONFIGURED');
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
      const responses = await Promise.all(['/live/bilibili', '/live/douyin', '/admin'].map(route => fetch(origin + route)));
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
      await writeFile(settingsFile, JSON.stringify({ ...settings, adapters: { music: { enabled: true }, bilibili: { enabled: true } } }));
      assert.equal((await cli('start', environment)).state, 'DEGRADED');
      const state = await cli('status', environment);
      assert.equal(state.state, 'DEGRADED');
      assert.equal(state.adapters.music.state, 'UNAVAILABLE');
      assert.ok(Object.values(state.pageChecks).every(Boolean));
    });
  } finally {
    socket?.terminate();
    await cli('stop', environment);
    await rm(directory, { recursive: true, force: true });
  }
});
