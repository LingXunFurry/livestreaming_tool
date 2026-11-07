import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { projectRoot } from '../server/config.mjs';

const execute = promisify(execFile);
await mkdir(path.join(projectRoot, '.cache'), { recursive: true });
const destination = await mkdtemp(path.join(projectRoot, '.cache', 'CP0 中文 迁移 '));
const files = ['src', 'server', 'scripts', 'config', 'assets', 'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'start.bat', 'stop.bat', 'status.bat', '启动直播间.bat', '关闭直播间.bat', '检查运行状态.bat'];
for (const file of files) await cp(path.join(projectRoot, file), path.join(destination, file), { recursive: true });
const environment = { ...process.env };
delete environment.TAVERN_DATA_DIR;
delete environment.TAVERN_PORT;

async function npmCommand(command) {
  const executable = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${command}`] : command.split(' ');
  const result = await execute(executable, args, { cwd: destination, env: environment, windowsVerbatimArguments: process.platform === 'win32', timeout: 180000, maxBuffer: 1024 * 1024 });
  console.log(result.stdout.trim());
}

async function entry(name, action) {
  let executable = process.execPath;
  let args = [path.join(destination, 'scripts', 'runtime.mjs'), action, '--json'];
  if (process.platform === 'win32') {
    executable = process.env.ComSpec || 'cmd.exe';
    args = ['/d', '/s', '/c', `call "${path.join(destination, name)}" --json`];
  }
  const result = await execute(executable, args, { cwd: os.tmpdir(), env: environment, windowsVerbatimArguments: process.platform === 'win32', timeout: 40000 });
  return JSON.parse(result.stdout.trim());
}

const portProbe = net.createServer();
portProbe.listen(0, '127.0.0.1');
await once(portProbe, 'listening');
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const settings = JSON.parse(await readFile(path.join(destination, 'config', 'example.json'), 'utf8'));
settings.server.port = port;
settings.global.title = '迁移验收酒馆';
await mkdir(path.join(destination, 'data'), { recursive: true });
await writeFile(path.join(destination, 'data', 'settings.json'), JSON.stringify(settings, null, 2));

console.log('在新的中文与空格目录中，用空缓存重新安装依赖。');
await npmCommand('ci --cache .cache/npm --no-audit --no-fund');
await npmCommand('run build');

try {
  const started = await entry('启动直播间.bat', 'start');
  assert.equal(started.state, 'RUNNING');
  assert.equal(started.port, port);
  const repeated = await entry('启动直播间.bat', 'start');
  assert.equal(repeated.reused, true);
  assert.equal(repeated.instanceId, started.instanceId);
  const running = await entry('检查运行状态.bat', 'status');
  assert.deepEqual(running.pageChecks, { bilibili: true, douyin: true, admin: true });
  assert.equal(running.websocketReachable, true);
  assert.equal(running.configuration.title, '迁移验收酒馆');
  assert.equal(running.adapters.music.state, 'DISCONNECTED');
  assert.equal(running.adapters.bilibili.state, 'NOT_CONFIGURED');
  assert.equal((await entry('关闭直播间.bat', 'stop')).state, 'STOPPED');
  assert.equal((await entry('检查运行状态.bat', 'status')).state, 'STOPPED');
  const evidence = {
    checkedAt: new Date().toISOString(),
    hostPlatform: process.platform,
    nodeVersion: process.versions.node,
    directory: path.relative(projectRoot, destination),
    freshDependencyCache: true,
    launchedFromDifferentWorkingDirectory: true,
    chineseAndSpacePath: true,
    entrypoints: ['启动直播间.bat', '检查运行状态.bat', '关闭直播间.bat'],
    start: 'RUNNING',
    repeatedStartReused: true,
    pages: running.pageChecks,
    websocketReachable: true,
    persistedTitle: running.configuration.title,
    finalState: 'STOPPED',
    scope: '当前电脑的新目录开发版迁移测试，第二台电脑和实际直播客户端等待 CP8 实测',
  };
  await writeFile(path.join(projectRoot, 'docs', 'CP0_MIGRATION_CHECK.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await entry('关闭直播间.bat', 'stop').catch(() => {});
}
