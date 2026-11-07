import { spawn, spawnSync } from 'node:child_process';
import { open, mkdir, readFile, readdir, stat, unlink } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { getPaths, loadSettings, projectRoot, readJson } from '../server/config.mjs';
import { createLogger } from '../server/logger.mjs';

const paths = getPaths();
const command = process.argv[2] || 'status';
const jsonOutput = process.argv.includes('--json');

function processExists(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(1500) });
  if (!response.ok) throw new Error(`本地服务返回 HTTP ${response.status}`);
  return response.json();
}

async function identifyInstance(metadata) {
  if (!metadata || metadata.projectKey !== paths.projectKey || !Number.isInteger(metadata.port)) return null;
  try {
    const baseUrl = `http://127.0.0.1:${metadata.port}`;
    const health = await requestJson(`${baseUrl}/health`);
    if (health.service !== 'lingxun-tavern' || health.instanceId !== metadata.instanceId || health.projectKey !== paths.projectKey) return null;
    return await requestJson(`${baseUrl}/api/runtime/status`);
  } catch { return null; }
}

async function acquireStartLock() {
  await mkdir(paths.runtimeDir, { recursive: true });
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const handle = await open(paths.lockFile, 'wx', 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
      return async () => { await handle.close(); await unlink(paths.lockFile); };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const information = await stat(paths.lockFile).catch(() => null);
      if (!information) continue;
      let owner;
      try { owner = await readJson(paths.lockFile); } catch { owner = null; }
      const staleOwner = owner && !processExists(owner.pid);
      const staleIncompleteFile = !owner && Date.now() - information.mtimeMs > 60000;
      if (staleOwner || staleIncompleteFile) {
        await unlink(paths.lockFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
        continue;
      }
      await delay(200);
    }
  }
  throw new Error('另一个启动任务仍在执行，请稍后运行状态检查');
}

async function newestSourceTime(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const times = await Promise.all(entries.map(async entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? newestSourceTime(file) : (await stat(file)).mtimeMs;
  }));
  return Math.max(0, ...times);
}

async function ensureBuild() {
  const required = ['package.json', 'config/example.json', 'config/font-sizes.json', 'server/index.mjs'];
  for (const file of required) {
    await stat(path.join(projectRoot, file)).catch(() => { throw new Error(`程序文件缺失 ${file}`); });
  }
  try { await import('ws'); } catch { throw new Error('依赖尚未安装，请先在项目目录运行 npm ci'); }
  const built = await stat(path.join(paths.distDir, 'index.html')).catch(() => null);
  const sourceTimes = await Promise.all(['index.html', 'vite.config.ts', 'package.json', 'package-lock.json', 'config/example.json', 'config/font-sizes.json'].map(async file => (await stat(path.join(projectRoot, file))).mtimeMs));
  const latestSource = Math.max(await newestSourceTime(path.join(projectRoot, 'src')), ...sourceTimes);
  let completeBuild = false;
  if (built) {
    const html = await readFile(path.join(paths.distDir, 'index.html'), 'utf8');
    const resources = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)];
    const resourcesExist = await Promise.all(resources.map(match => stat(path.join(paths.distDir, match[1].slice(1))).then(info => info.isFile()).catch(() => false)));
    completeBuild = resources.length > 0 && resourcesExist.every(Boolean);
  }
  if (built && built.mtimeMs >= latestSource && completeBuild) return;
  if (!jsonOutput) console.log('正在构建网页资源…');
  const executable = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const argumentsList = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run build'] : ['run', 'build'];
  const result = spawnSync(executable, argumentsList, { cwd: projectRoot, windowsHide: true, stdio: jsonOutput ? 'pipe' : 'inherit' });
  if (result.error || result.status !== 0) throw new Error('网页构建失败，请运行 npm run build 查看具体错误');
}

async function assertPortAvailable(port) {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', error => reject(new Error(`端口 ${port} 无法使用（${error.code}）。请关闭对应占用程序，或修改 data/settings.json 的 server.port。`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

function openAdminBrowser(url) {
  let executable;
  let argumentsList;
  if (process.platform === 'win32') {
    executable = process.env.ComSpec || 'cmd.exe';
    argumentsList = ['/d', '/s', '/c', `start "" "${url}"`];
  } else if (process.platform === 'darwin') {
    executable = 'open';
    argumentsList = [url];
  } else {
    executable = 'xdg-open';
    argumentsList = [url];
  }
  const browser = spawn(executable, argumentsList, { detached: true, windowsHide: true, windowsVerbatimArguments: process.platform === 'win32', stdio: 'ignore' });
  browser.on('error', () => console.error(`请手动打开 ${url}`));
  browser.unref();
}

async function start() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw new Error('需要 Node.js 22.12 或更新版本');
  const releaseLock = await acquireStartLock();
  try {
    const previous = await readJson(paths.metadataFile);
    const running = await identifyInstance(previous);
    if (running) return { ...running, reused: true };
    if (previous && processExists(previous.pid)) throw new Error('现有运行记录属于存活但无法验证的进程，请检查日志和运行状态');
    const settings = await loadSettings({ initialize: true });
    createLogger(paths.logsDir)('start_requested');
    await ensureBuild();
    await assertPortAvailable(settings.server.port);
    const child = spawn(process.execPath, [path.join(projectRoot, 'server', 'index.mjs')], {
      cwd: projectRoot,
      env: process.env,
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    });
    let spawnError;
    child.on('error', error => { spawnError = error; });
    child.unref();
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (spawnError) throw new Error('后台服务无法启动，请检查 Node.js 与运行目录权限');
      const metadata = await readJson(paths.metadataFile);
      const current = metadata?.pid === child.pid ? await identifyInstance(metadata) : null;
      if (current) {
        if (settings.server.openAdminOnStart && !jsonOutput) openAdminBrowser(current.pages.admin);
        return { ...current, reused: false };
      }
      if (child.exitCode !== null && child.exitCode !== undefined) break;
      await delay(100);
    }
    if (child.exitCode === null) child.kill();
    throw new Error('服务未通过就绪检查，请查看 data/logs/runtime.log');
  } finally {
    await releaseLock();
  }
}

async function stop() {
  const metadata = await readJson(paths.metadataFile);
  if (!metadata) return { state: 'STOPPED' };
  const running = await identifyInstance(metadata);
  if (!running) {
    if (processExists(metadata.pid)) throw new Error('无法核实运行记录所属服务，请检查日志。该进程保持运行。');
    await unlink(paths.metadataFile);
    return { state: 'STOPPED', staleRecordRemoved: true };
  }
  await requestJson(`http://127.0.0.1:${metadata.port}/api/runtime/stop`, { method: 'POST', headers: { 'X-Tavern-Control': metadata.controlToken } });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const current = await readJson(paths.metadataFile);
    if (current?.instanceId !== metadata.instanceId) return { state: 'STOPPED', port: metadata.port };
    await delay(100);
  }
  throw new Error('服务关闭等待超时，请检查日志');
}

async function checkWebsocket(port) {
  const { WebSocket } = await import('ws');
  return new Promise(resolve => {
    const connection = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const timer = setTimeout(() => { connection.terminate(); resolve(false); }, 1500);
    connection.once('open', () => { clearTimeout(timer); connection.close(); resolve(true); });
    connection.once('error', () => { clearTimeout(timer); resolve(false); });
  });
}

async function status() {
  const metadata = await readJson(paths.metadataFile);
  const running = await identifyInstance(metadata);
  if (!running) {
    if (metadata && processExists(metadata.pid)) return { state: 'ERROR', message: '进程存活但服务身份或健康检查失败' };
    return { state: 'STOPPED', staleRecord: Boolean(metadata) };
  }
  const pageResults = await Promise.all(Object.entries(running.pages).map(async ([name, url]) => {
    try { const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(1500) }); return [name, response.ok]; }
    catch { return [name, false]; }
  }));
  const websocketReachable = await checkWebsocket(running.port);
  return { ...running, state: pageResults.every(([, ok]) => ok) && websocketReachable ? running.state : 'DEGRADED', pageChecks: Object.fromEntries(pageResults), websocketReachable };
}

function printResult(result) {
  if (jsonOutput) { console.log(JSON.stringify(result)); return; }
  console.log(`\nLingxun's Tavern Overlay\nSystem: ${result.state}`);
  if (result.reused) console.log('当前项目已运行，复用现有实例。');
  if (result.version) console.log(`Version: ${result.version}\nStarted: ${result.startedAt}`);
  if (result.port) console.log(`Local Service: http://127.0.0.1:${result.port}`);
  for (const [name, url] of Object.entries(result.pages || {})) console.log(`${name}: ${url}`);
  if (result.websocket) console.log(`WebSocket: ${result.websocketReachable === false ? 'ERROR' : result.websocket.state}`);
  if (result.adapters) console.log(`Music Adapter: ${result.adapters.music.state}\nBilibili Events: ${result.adapters.bilibili.state}`);
  if (result.adapters?.music.state === 'UNAVAILABLE') console.log('网易云桥接不可用，请启动本地音乐桥接，并在后台检查连接地址。');
  if (result.pageChecks) console.log(`Pages: ${JSON.stringify(result.pageChecks)}`);
  if (result.message) console.log(result.message);
  console.log(`Logs: ${paths.logsDir}\n`);
}

try {
  const actions = { start, stop, status };
  if (!actions[command]) throw new Error('支持 start、stop、status 三个命令');
  const result = await actions[command]();
  printResult(result);
  if (result.state === 'ERROR') process.exitCode = 1;
} catch (error) {
  try { createLogger(paths.logsDir)('launcher_error', { action: command, code: error.code || 'RUNTIME_ERROR' }); } catch { /* The command still reports an actionable error if logging is unavailable. */ }
  const result = { state: 'ERROR', message: error.message };
  if (jsonOutput) console.log(JSON.stringify(result));
  else console.error(`ERROR\n${error.message}`);
  process.exitCode = 1;
}
