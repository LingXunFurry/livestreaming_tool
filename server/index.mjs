import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { atomicWriteJson, getPaths, loadSettings, projectRoot, readJson, saveSettings, validateSettings } from './config.mjs';
import { createLogger } from './logger.mjs';
import { createMusicAdapter } from './music.mjs';
import { createLocalMusicBridge } from './music-bridge.mjs';

const paths = getPaths();
const log = createLogger(paths.logsDir);
const instanceId = randomUUID();
const controlToken = randomUUID() + randomUUID();
const startedAt = new Date().toISOString();
let shuttingDown = false;

try {
  let settings = await loadSettings({ initialize: true });
  const packageInfo = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const realDist = await realpath(paths.distDir);
  await stat(path.join(realDist, 'index.html'));
  const port = settings.server.port;
  const origin = `http://127.0.0.1:${port}`;
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (port === 80) ['127.0.0.1', 'localhost'].forEach(host => allowedHosts.add(host));
  const allowedOrigins = new Set([origin, `http://localhost:${port}`]);
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const localMusicBridge = createLocalMusicBridge(projectRoot, log);
  const adapters = {
    music: { state: 'DISCONNECTED', configured: settings.adapters.music.enabled, implemented: true },
    bilibili: { state: settings.platforms.bilibili.roomAddress ? 'WAITING_AUTHORIZATION' : 'NOT_CONFIGURED', configured: Boolean(settings.platforms.bilibili.roomAddress), implemented: false },
  };
  const music = createMusicAdapter(snapshot => {
    if (adapters.music.state !== snapshot.state) log('music_adapter_status', { state: snapshot.state, error: snapshot.error });
    adapters.music = { state: snapshot.state, configured: settings.adapters.music.enabled, implemented: true, playbackState: snapshot.playbackState, error: snapshot.error };
    broadcastMessage({ type: 'music.updated', data: snapshot });
  });

  function runtimeStatus() {
    const degraded = Object.values(adapters).some(adapter => adapter.configured && adapter.state === 'UNAVAILABLE');
    return {
      service: 'lingxun-tavern',
      projectKey: paths.projectKey,
      instanceId,
      state: degraded ? 'DEGRADED' : 'RUNNING',
      version: packageInfo.version,
      checkpoint: 'CP7',
      startedAt,
      port,
      host: '127.0.0.1',
      pages: { bilibili: `${origin}/live/bilibili`, douyin: `${origin}/live/douyin`, admin: `${origin}/admin` },
      websocket: { state: 'RUNNING', path: '/ws', clients: sockets.clients.size },
      adapters,
      configuration: { schemaVersion: settings.schemaVersion, title: settings.global.title, task: settings.global.task },
    };
  }

  function sendJson(response, status, data) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(JSON.stringify(data));
  }

  function editableSettings() {
    return {
      global: { task: settings.global.task, fontSizes: settings.global.fontSizes },
      music: { enabled: settings.adapters.music.enabled, baseUrl: settings.adapters.music.baseUrl },
      platforms: Object.fromEntries(['bilibili', 'douyin'].map(platform => [platform, {
        ...(platform === 'bilibili' ? {
          roomAddress: settings.platforms.bilibili.roomAddress,
          boardMode: settings.platforms.bilibili.boardMode,
        } : {}),
        announcementText: settings.platforms[platform].announcementText,
        bottomAnnouncementText: settings.platforms[platform].bottomAnnouncementText,
        lyricsEnabled: settings.platforms[platform].lyricsEnabled,
        lyricsAutoHide: settings.platforms[platform].lyricsAutoHide,
        fontSizes: settings.platforms[platform].fontSizes,
      }])),
    };
  }

  function broadcastMessage(message) {
    const serialized = JSON.stringify(message);
    for (const connection of sockets.clients) {
      if (connection.readyState === WebSocket.OPEN) connection.send(serialized);
    }
  }

  function sendUpgradeError(socket, status, message) {
    socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  }

  async function readSettingsRequest(request) {
    if (Number(request.headers['content-length']) > 65536) throw Object.assign(new Error('配置请求超过 64 KB'), { status: 413 });
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 65536) throw Object.assign(new Error('配置请求超过 64 KB'), { status: 413 });
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw Object.assign(new Error('请求内容必须为有效 JSON'), { status: 400 }); }
  }

  function validateEditablePayload(input) {
    const exactKeys = (value, expected, optional = []) => value && typeof value === 'object' && !Array.isArray(value)
      && expected.every(key => Object.hasOwn(value, key))
      && Object.keys(value).every(key => expected.includes(key) || optional.includes(key));
    const platformFields = ['boardMode', 'announcementText', 'lyricsEnabled'];
    if (!exactKeys(input, ['global', 'platforms'], ['music']) || !exactKeys(input.global, ['task'], ['fontSizes'])
      || (input.music !== undefined && !exactKeys(input.music, ['enabled', 'baseUrl']))
      || !exactKeys(input.platforms, ['bilibili', 'douyin'])
      || !exactKeys(input.platforms.bilibili, platformFields, ['benefitsText', 'bottomAnnouncementText', 'fontSizes', 'lyricsAutoHide', 'roomAddress'])
      || !exactKeys(input.platforms.douyin, ['announcementText', 'lyricsEnabled'], ['boardMode', 'benefitsText', 'bottomAnnouncementText', 'fontSizes', 'lyricsAutoHide', 'roomAddress'])) {
      throw Object.assign(new Error('配置字段不完整或包含不允许的字段'), { status: 400 });
    }
    delete input.platforms.douyin.roomAddress;
    delete input.platforms.douyin.boardMode;
    return input;
  }

  function validControlToken(value) {
    if (typeof value !== 'string') return false;
    const received = Buffer.from(value);
    const expected = Buffer.from(controlToken);
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  const applicationRoutes = new Set(['/', '/preview', '/assets/review', '/scene/review', '/admin', '/live/bilibili', '/live/douyin']);
  const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

  const server = http.createServer(async (request, response) => {
    try {
      if (!allowedHosts.has(request.headers.host)) return sendJson(response, 403, { error: 'HOST_NOT_ALLOWED' });
      const pathname = new URL(request.url, origin).pathname.replace(/\/$/, '') || '/';
      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, shuttingDown ? 503 : 200, { service: 'lingxun-tavern', ready: !shuttingDown, instanceId, projectKey: paths.projectKey });
      }
      if (request.method === 'GET' && pathname === '/api/runtime/status') return sendJson(response, 200, runtimeStatus());
      if (request.method === 'GET' && pathname === '/api/settings') return sendJson(response, 200, { settings: editableSettings() });
      if (request.method === 'GET' && pathname === '/api/music') return sendJson(response, 200, music.getState());
      if (request.method === 'POST' && pathname === '/api/music/control') {
        if (request.headers.origin && !allowedOrigins.has(request.headers.origin)) return sendJson(response, 403, { error: 'MUSIC_REQUEST_DENIED' });
        if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return sendJson(response, 415, { error: 'JSON_REQUIRED' });
        try {
          const body = await readSettingsRequest(request);
          if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'action')) return sendJson(response, 400, { error: 'INVALID_MUSIC_ACTION' });
          await music.control(body.action);
          return sendJson(response, 200, { accepted: true });
        } catch (error) { return sendJson(response, error.status || 502, { error: error.message }); }
      }
      if (request.method === 'PUT' && pathname === '/api/settings') {
        if ((request.headers.origin && !allowedOrigins.has(request.headers.origin)) || !String(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
          return sendJson(response, request.headers.origin && !allowedOrigins.has(request.headers.origin) ? 403 : 415, { error: 'SETTINGS_REQUEST_DENIED' });
        }
        let payload;
        let nextSettings;
        try {
          payload = validateEditablePayload(await readSettingsRequest(request));
          nextSettings = validateSettings({
            ...settings,
            global: { ...settings.global, ...payload.global },
            adapters: { ...settings.adapters, music: { ...settings.adapters.music, ...payload.music } },
            platforms: {
              bilibili: { ...settings.platforms.bilibili, ...payload.platforms.bilibili },
              douyin: { ...settings.platforms.douyin, ...payload.platforms.douyin },
            },
          }, settings);
        } catch (error) {
          return sendJson(response, error.status || 400, { error: error.message || 'INVALID_SETTINGS' });
        }
        const previousSettings = settings;
        try { settings = await saveSettings(nextSettings); }
        catch (error) {
          log('settings_save_error', { code: error.code || 'SAVE_FAILED' });
          return sendJson(response, 500, { error: 'SETTINGS_SAVE_FAILED' });
        }
        const globalChanged = JSON.stringify(previousSettings.global) !== JSON.stringify(settings.global);
        const musicChanged = JSON.stringify(previousSettings.adapters.music) !== JSON.stringify(settings.adapters.music);
        if (musicChanged) {
          music.configure(settings.adapters.music);
          void localMusicBridge.start(settings.adapters.music);
        }
        for (const platform of ['bilibili', 'douyin']) {
          const platformChanged = JSON.stringify(previousSettings.platforms[platform]) !== JSON.stringify(settings.platforms[platform]);
          if (!globalChanged && !platformChanged && !musicChanged) continue;
          if (platform === 'bilibili' && previousSettings.platforms.bilibili.roomAddress !== settings.platforms.bilibili.roomAddress) {
            adapters.bilibili = { ...adapters.bilibili, state: settings.platforms.bilibili.roomAddress ? 'WAITING_AUTHORIZATION' : 'NOT_CONFIGURED', configured: Boolean(settings.platforms.bilibili.roomAddress) };
          }
          broadcastMessage({ type: 'settings.updated', data: {
            platform,
            global: editableSettings().global,
            music: editableSettings().music,
            platformSettings: editableSettings().platforms[platform],
          } });
        }
        broadcastMessage({ type: 'runtime.status', data: runtimeStatus() });
        return sendJson(response, 200, { settings: editableSettings() });
      }
      if (request.method === 'POST' && pathname === '/api/runtime/stop') {
        if ((request.headers.origin && !allowedOrigins.has(request.headers.origin)) || !validControlToken(request.headers['x-tavern-control'])) {
          return sendJson(response, 403, { error: 'CONTROL_DENIED' });
        }
        sendJson(response, 202, { state: 'STOPPING' });
        setImmediate(() => shutdown('control'));
        return;
      }
      if (pathname.startsWith('/api/') || pathname === '/health') return sendJson(response, 404, { error: 'ENDPOINT_NOT_FOUND' });
      if (!['GET', 'HEAD'].includes(request.method)) return sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' });
      const decodedPath = decodeURIComponent(pathname);
      const requestedFile = applicationRoutes.has(pathname) ? 'index.html' : decodedPath.slice(1);
      const file = path.resolve(realDist, requestedFile);
      const relativeFile = path.relative(realDist, file);
      if (relativeFile.startsWith('..') || path.isAbsolute(relativeFile)) return sendJson(response, 403, { error: 'PATH_NOT_ALLOWED' });
      const resolvedFile = await realpath(file);
      const realRelative = path.relative(realDist, resolvedFile);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) return sendJson(response, 403, { error: 'PATH_NOT_ALLOWED' });
      const information = await stat(resolvedFile);
      if (!information.isFile()) return sendJson(response, 404, { error: 'FILE_NOT_FOUND' });
      response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream', 'Content-Length': information.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      if (request.method === 'HEAD') return response.end();
      createReadStream(resolvedFile).on('error', () => response.destroy()).pipe(response);
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof URIError) return sendJson(response, 404, { error: 'FILE_NOT_FOUND' });
      log('request_error', { code: error.code || 'INTERNAL_ERROR' });
      if (!response.headersSent) sendJson(response, 500, { error: 'INTERNAL_ERROR' });
      else response.destroy();
    }
  });

  server.on('upgrade', (request, socket, head) => {
    let url;
    try { url = new URL(request.url, origin); }
    catch { sendUpgradeError(socket, 400, 'Bad Request'); return; }
    if (shuttingDown || !allowedHosts.has(request.headers.host)) {
      sendUpgradeError(socket, 403, 'Forbidden');
      return;
    }
    if (url.pathname !== '/ws' || (request.headers.origin && !allowedOrigins.has(request.headers.origin))) {
      sendUpgradeError(socket, 403, 'Forbidden');
      return;
    }
    sockets.handleUpgrade(request, socket, head, connection => sockets.emit('connection', connection, url.searchParams.get('platform')));
  });

  sockets.on('connection', (connection, platform) => {
    log('websocket_connected');
    connection.platform = platform === 'bilibili' || platform === 'douyin' ? platform : null;
    connection.alive = true;
    connection.on('pong', () => { connection.alive = true; });
    connection.on('error', error => log('websocket_error', { code: error.code || 'SOCKET_ERROR' }));
    connection.on('close', () => log('websocket_disconnected'));
    connection.send(JSON.stringify({ type: 'runtime.status', data: runtimeStatus() }));
    connection.send(JSON.stringify({ type: 'music.updated', data: music.getState() }));
  });
  sockets.on('error', error => log('websocket_server_error', { code: error.code || 'SOCKET_ERROR' }));

  const broadcast = setInterval(() => {
    const message = JSON.stringify({ type: 'runtime.status', data: runtimeStatus() });
    for (const connection of sockets.clients) if (connection.readyState === WebSocket.OPEN) connection.send(message);
  }, 5000);
  const heartbeat = setInterval(() => {
    for (const connection of sockets.clients) {
      if (!connection.alive) { connection.terminate(); continue; }
      connection.alive = false;
      connection.ping();
    }
  }, 15000);

  async function removeOwnMetadata() {
    const metadata = await readJson(paths.metadataFile);
    if (metadata?.instanceId === instanceId) await unlink(paths.metadataFile);
  }

  async function shutdown(reason, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    log('stopping', { reason });
    clearInterval(broadcast);
    clearInterval(heartbeat);
    music.close();
    await localMusicBridge.close();
    for (const connection of sockets.clients) connection.close(1001, 'Service stopping');
    const forceClose = setTimeout(() => {
      for (const connection of sockets.clients) connection.terminate();
      server.closeAllConnections();
    }, 1000);
    forceClose.unref();
    const socketsClosed = new Promise(resolve => sockets.close(resolve));
    const httpClosed = new Promise(resolve => server.close(resolve));
    await Promise.all([socketsClosed, httpClosed]);
    clearTimeout(forceClose);
    await removeOwnMetadata().catch(() => log('metadata_cleanup_error'));
    log('stopped', { reason });
    process.exit(exitCode);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', error => {
    log('uncaught_exception', { code: error.code || 'UNCAUGHT_EXCEPTION' });
    shutdown('uncaught_exception', 1);
  });
  process.on('unhandledRejection', () => { log('unhandled_rejection'); shutdown('unhandled_rejection', 1); });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  await atomicWriteJson(paths.metadataFile, { instanceId, controlToken, projectKey: paths.projectKey, pid: process.pid, port, startedAt });
  music.configure(settings.adapters.music);
  void localMusicBridge.start(settings.adapters.music);
  log('started', { port, version: packageInfo.version });
  log('adapter_status', { music: adapters.music.state, bilibili: adapters.bilibili.state });
} catch (error) {
  log('startup_error', { code: error.code || 'STARTUP_ERROR' });
  process.exit(1);
}
