import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { atomicWriteJson, getPaths, loadSettings, projectRoot, readJson } from './config.mjs';
import { createLogger } from './logger.mjs';

const paths = getPaths();
const log = createLogger(paths.logsDir);
const instanceId = randomUUID();
const controlToken = randomUUID() + randomUUID();
const startedAt = new Date().toISOString();
let shuttingDown = false;

try {
  const settings = await loadSettings({ initialize: true });
  const packageInfo = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const realDist = await realpath(paths.distDir);
  await stat(path.join(realDist, 'index.html'));
  const port = settings.server.port;
  const origin = `http://127.0.0.1:${port}`;
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (port === 80) ['127.0.0.1', 'localhost'].forEach(host => allowedHosts.add(host));
  const allowedOrigins = new Set([origin, `http://localhost:${port}`]);
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const adapters = {
    music: { state: settings.adapters.music.enabled ? 'UNAVAILABLE' : 'DISCONNECTED', configured: settings.adapters.music.enabled, implemented: false },
    bilibili: { state: settings.adapters.bilibili.enabled ? 'UNAVAILABLE' : 'NOT_CONFIGURED', configured: settings.adapters.bilibili.enabled, implemented: false },
  };

  function runtimeStatus() {
    const degraded = Object.values(adapters).some(adapter => adapter.configured && adapter.state === 'UNAVAILABLE');
    return {
      service: 'lingxun-tavern',
      projectKey: paths.projectKey,
      instanceId,
      state: degraded ? 'DEGRADED' : 'RUNNING',
      version: packageInfo.version,
      checkpoint: 'CP1',
      startedAt,
      port,
      host: '127.0.0.1',
      pages: { bilibili: `${origin}/live/bilibili`, douyin: `${origin}/live/douyin`, admin: `${origin}/admin` },
      websocket: { state: 'RUNNING', path: '/ws', clients: sockets.clients.size },
      adapters,
      configuration: { schemaVersion: settings.schemaVersion, title: settings.global.title },
    };
  }

  function sendJson(response, status, data) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(JSON.stringify(data));
  }

  function validControlToken(value) {
    if (typeof value !== 'string') return false;
    const received = Buffer.from(value);
    const expected = Buffer.from(controlToken);
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  const applicationRoutes = new Set(['/', '/preview', '/admin', '/live/bilibili', '/live/douyin']);
  const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

  const server = http.createServer(async (request, response) => {
    try {
      if (!allowedHosts.has(request.headers.host)) return sendJson(response, 403, { error: 'HOST_NOT_ALLOWED' });
      const pathname = new URL(request.url, origin).pathname.replace(/\/$/, '') || '/';
      if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, shuttingDown ? 503 : 200, { service: 'lingxun-tavern', ready: !shuttingDown, instanceId, projectKey: paths.projectKey });
      }
      if (request.method === 'GET' && pathname === '/api/runtime/status') return sendJson(response, 200, runtimeStatus());
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
    let validPath;
    try { validPath = new URL(request.url, origin).pathname === '/ws'; }
    catch { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return; }
    if (shuttingDown || !validPath || !allowedHosts.has(request.headers.host) || (request.headers.origin && !allowedOrigins.has(request.headers.origin))) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    sockets.handleUpgrade(request, socket, head, connection => sockets.emit('connection', connection));
  });

  sockets.on('connection', connection => {
    log('websocket_connected');
    connection.alive = true;
    connection.on('pong', () => { connection.alive = true; });
    connection.on('error', error => log('websocket_error', { code: error.code || 'SOCKET_ERROR' }));
    connection.on('close', () => log('websocket_disconnected'));
    connection.send(JSON.stringify({ type: 'runtime.status', data: runtimeStatus() }));
  });
  sockets.on('error', error => log('websocket_server_error', { code: error.code || 'SOCKET_ERROR' }));

  const broadcast = setInterval(() => {
    const message = JSON.stringify({ type: 'runtime.status', data: runtimeStatus() });
    for (const connection of sockets.clients) {
      if (connection.readyState === WebSocket.OPEN) connection.send(message);
    }
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
  log('started', { port, version: packageInfo.version });
  log('adapter_status', { music: adapters.music.state, bilibili: adapters.bilibili.state });
} catch (error) {
  log('startup_error', { code: error.code || 'STARTUP_ERROR' });
  process.exit(1);
}
