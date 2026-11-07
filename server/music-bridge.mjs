import { spawn, execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

export function createLocalMusicBridge(root, log) {
  let child;
  let pending;
  let closed = false;
  let wanted = false;

  async function start(config) {
    wanted = config.enabled && config.baseUrl === 'http://127.0.0.1:18726';
    if (closed || process.platform !== 'win32' || !wanted || child) return;
    if (pending) return pending;
    pending = (async () => {
      const python = path.join(root, '.cache', 'netease-venv', 'Scripts', 'python.exe');
      const source = path.join(root, '.cache', 'netease-bridge', 'main.py');
      const installed = await Promise.all([python, source].map(file => stat(file).then(info => info.isFile()).catch(() => false)));
      if (!installed.every(Boolean)) { log('music_bridge_missing', { message: 'See docs/MUSIC_SETUP.md' }); return; }
      const available = await new Promise(resolve => {
        const probe = net.createServer();
        probe.once('error', () => resolve(false));
        probe.listen(18726, '127.0.0.1', () => probe.close(() => resolve(true)));
      });
      if (!available) { log('music_bridge_port_in_use', { port: 18726 }); return; }
      if (closed || !wanted) return;
      const launched = spawn(python, [path.join(root, 'scripts', 'music-bridge.py')], { cwd: root, windowsHide: true, stdio: 'ignore' });
      child = launched;
      launched.on('error', error => { log('music_bridge_start_error', { code: error.code }); if (child === launched) child = undefined; });
      launched.on('exit', (code, signal) => { log('music_bridge_exit', { code, signal }); if (child === launched) child = undefined; });
      log('music_bridge_start_requested', { pid: launched.pid });
    })().catch(error => log('music_bridge_start_error', { code: error.code || 'START_ERROR' })).finally(() => { pending = undefined; });
    return pending;
  }

  async function close() {
    closed = true;
    await pending;
    if (!child || child.exitCode !== null) return;
    const owned = child;
    await new Promise(resolve => {
      execFile(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(owned.pid), '/T', '/F'], { windowsHide: true }, error => {
        if (error) log('music_bridge_stop_error', { code: error.code });
        resolve();
      });
    });
  }

  return { start, close };
}
