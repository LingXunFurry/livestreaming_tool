import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import WebSocket from 'ws';

function openSocket(url, onMessage) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, {handshakeTimeout: 3000, maxPayload: 65536});
    socket.once('open', () => resolve(socket));
    socket.on('error', reject);
    if (onMessage) socket.on('message', onMessage);
  });
}

export function createCollector(platform, root, onMessage, onState) {
  let active = false;
  let generation = 0;
  let source;
  let control;
  let retry;
  let monitor;
  let startOperation;
  let options;
  let controlledRoom;
  let status = {state: 'STOPPED', error: ''};
  function update(state, error = '') { status = {state, error}; onState(); }
  function baseUrl() { return new URL(options.collector.url).origin.replace('ws:', 'http:'); }
  async function readConfig() {
    const response = await fetch(baseUrl() + '/api/config', {signal: AbortSignal.timeout(2000), redirect: 'error'});
    if (!response.ok) throw new Error('采集软件接口不可用');
    return response.json();
  }
  async function connectData(version) {
    if (!active || version !== generation) return;
    try {
      const config = await readConfig();
      if (config.platform !== platform || config.url !== controlledRoom) throw new Error('采集器平台或房间不匹配，请重新开始 B 站采集');
      const socket = await openSocket(options.collector.url, raw => {
        if (active && version === generation) onMessage(raw);
      });
      if (!active || version !== generation) {socket.close(); return;}
      source = socket;
      socket.on('close', () => {
        if (!active || version !== generation) return;
        update('UNAVAILABLE', '采集连接已断开');
        clearTimeout(retry);
        retry = setTimeout(() => void connectData(version), 2000);
      });
      update('CONNECTED');
    } catch (error) {
      if (!active || version !== generation) return;
      update('UNAVAILABLE', error.message);
      clearTimeout(retry);
      retry = setTimeout(() => void connectData(version), 2000);
    }
  }
  async function start(nextOptions) {
    if (startOperation) await startOperation.catch(() => {});
    if (active) return;
    active = true;
    options = nextOptions;
    const version = ++generation;
    update('CONNECTING');
    startOperation = (async () => {
      try {
        if (!options.roomAddress) throw new Error('请填写对应平台的直播间地址');
        let config;
        try {config = await readConfig();}
        catch {
          const url = new URL(options.collector.url);
          let fallback = '';
          if (url.port === '8000') {
            for (const directory of [root, path.resolve(root, '../../../..')]) {
              const candidate = path.join(directory, '.cache', 'live-stream-sniffer', 'LiveStreamSniffer.exe');
              if (await access(candidate).then(() => true, () => false)) {fallback = candidate; break;}
            }
          }
          const executable = options.collector.executable || fallback;
          if (!executable) throw new Error('请先配置支持该端口的独立采集程序');
          await access(executable).catch(() => {throw new Error('采集程序不存在，请检查 exe 路径');});
          if (!active || version !== generation) return;
          const child = spawn(executable, [], {cwd: path.dirname(executable), detached: true, windowsHide: true, stdio: 'ignore'});
          await new Promise((resolve, reject) => {child.once('spawn', resolve); child.once('error', () => reject(new Error('采集程序无法启动，请检查 exe 路径')));});
          child.unref();
          for (let attempt = 0; attempt < 120 && active && version === generation; attempt += 1) {
            await delay(250);
            try {config = await readConfig(); break;} catch { /* Wait for the collector's local server. */ }
          }
          if (!config) throw new Error('采集软件未在配置端口就绪');
        }
        if (!active || version !== generation) return;
        const address = options.roomAddress;
        const roomUrl = /^\d+$/.test(address) ? `https://${platform === 'bilibili' ? 'live.bilibili.com' : 'live.douyin.com'}/${address}` : address;
        controlledRoom = roomUrl;
        control = await openSocket(baseUrl().replace('http:', 'ws:') + '/ws/ui');
        if (!active || version !== generation) {control.close(); return;}
        control.send(JSON.stringify({action: 'start', config: {...config, platform, url: roomUrl, debug_mode: false, ws_forward_enable: false, ws_room_info_interval: 3}}));
        await delay(100);
        if (!active || version !== generation) return;
        await connectData(version);
        if (!active || version !== generation) return;
        monitor = setInterval(async () => {
          try {
            const current = await readConfig();
            if (active && version === generation && (current.platform !== platform || current.url !== roomUrl)) {
              update('UNAVAILABLE', '采集器房间已改变，请重新开始 B 站采集');
              source?.close();
            }
          } catch { /* The data socket reports connectivity separately. */ }
        }, 3000);
      } catch (error) {
        if (version !== generation) return;
        active = false;
        update('UNAVAILABLE', error.message);
        throw error;
      } finally {startOperation = null;}
    })();
    return startOperation;
  }
  async function stop() {
    active = false;
    const stoppedVersion = ++generation;
    clearTimeout(retry);
    clearInterval(monitor);
    const closingControl = control;
    const closingRoom = controlledRoom;
    const closingUrl = options ? baseUrl() : '';
    source?.close();
    source = null;
    control = null;
    if (closingControl?.readyState === WebSocket.OPEN) {
      const current = await fetch(closingUrl + '/api/config', {signal: AbortSignal.timeout(2000), redirect: 'error'}).then(response => response.json()).catch(() => null);
      if (current?.platform === platform && current.url === closingRoom) await new Promise(resolve => closingControl.send(JSON.stringify({action: 'stop'}), () => resolve()));
      closingControl.close();
    }
    if (stoppedVersion === generation) update('STOPPED');
  }
  return {start, stop, getState: () => status, isActive: () => active};
}
