import { createHash, randomUUID } from 'node:crypto';
import { access, copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import fontSizeLimits from '../config/font-sizes.json' with { type: 'json' };

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
let settingsWriteQueue = Promise.resolve();

export function getPaths() {
  const dataDir = path.resolve(projectRoot, process.env.TAVERN_DATA_DIR || 'data');
  const runtimeDir = path.join(dataDir, 'runtime');
  return {
    dataDir,
    runtimeDir,
    settingsFile: path.join(dataDir, 'settings.json'),
    metadataFile: path.join(runtimeDir, 'instance.json'),
    lockFile: path.join(runtimeDir, 'start.lock'),
    logsDir: path.join(dataDir, 'logs'),
    backupsDir: path.join(dataDir, 'backups'),
    distDir: path.join(projectRoot, 'dist'),
    projectKey: createHash('sha256').update(`${projectRoot}|${dataDir}`).digest('hex'),
  };
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`无法读取 JSON 配置 ${path.basename(file)}`, { cause: error });
  }
}

export async function atomicWriteJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  try {
    for (let attempt = 0; ; attempt += 1) {
      try { await rename(temporaryFile, file); break; }
      catch (error) {
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 5) throw error;
        await delay(25 * (attempt + 1));
      }
    }
  } catch (error) {
    await unlink(temporaryFile).catch(() => {});
    throw error;
  }
}

export function validateSettings(input, defaults) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('配置必须为 JSON 对象');
  const sections = {
    server: input.server,
    global: input.global,
    'global.fontSizes': input.global?.fontSizes,
    platforms: input.platforms,
    adapters: input.adapters,
    'platforms.bilibili': input.platforms?.bilibili,
    'platforms.douyin': input.platforms?.douyin,
    'platforms.bilibili.fontSizes': input.platforms?.bilibili?.fontSizes,
    'platforms.douyin.fontSizes': input.platforms?.douyin?.fontSizes,
    'adapters.music': input.adapters?.music,
    'adapters.bilibili': input.adapters?.bilibili,
  };
  for (const [name, value] of Object.entries(sections)) {
    if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) throw new Error(`${name} 必须为 JSON 对象`);
  }
  const settings = {
    schemaVersion: input.schemaVersion ?? 1,
    announcementMovedToBottom: input.announcementMovedToBottom ?? false,
    douyinInteractionRemoved: input.douyinInteractionRemoved ?? false,
    server: { ...defaults.server, ...input.server },
    global: {
      title: defaults.global.title,
      task: input.global?.task ?? defaults.global.task,
      fontSizes: { ...defaults.global.fontSizes, ...input.global?.fontSizes },
    },
    platforms: {
      bilibili: { ...defaults.platforms.bilibili, ...input.platforms?.bilibili, collector: {...defaults.platforms.bilibili.collector, ...input.platforms?.bilibili?.collector}, fontSizes: { ...defaults.platforms.bilibili.fontSizes, ...input.platforms?.bilibili?.fontSizes } },
      douyin: { ...defaults.platforms.douyin, ...input.platforms?.douyin, fontSizes: { ...defaults.platforms.douyin.fontSizes, ...input.platforms?.douyin?.fontSizes } },
    },
    adapters: {
      music: { ...defaults.adapters.music, ...input.adapters?.music },
      bilibili: { ...defaults.adapters.bilibili, ...input.adapters?.bilibili },
    },
  };
  if (settings.schemaVersion !== 1) throw new Error('不支持此配置版本，请保留文件并按迁移说明升级');
  if (typeof settings.announcementMovedToBottom !== 'boolean') throw new Error('公告迁移标记必须为布尔值');
  if (typeof settings.douyinInteractionRemoved !== 'boolean') throw new Error('抖音互动迁移标记必须为布尔值');
  for (const [scope, value] of Object.entries({ global: settings.global, ...settings.platforms })) {
    const allowed = scope === 'global' ? ['task', 'bottomLabel'] : ['comments', 'announcement', 'song', 'lyrics', 'benefits'];
    for (const [field, size] of Object.entries(value.fontSizes)) {
      if (!allowed.includes(field)) throw new Error(`fontSizes 包含未知字段 ${field}`);
      const { min, max } = fontSizeLimits[field];
      if (!Number.isInteger(size) || size < min || size > max) throw new Error(`fontSizes.${field} 必须为 ${min} 到 ${max} 之间的整数`);
    }
  }
  if (settings.server.host !== '127.0.0.1') throw new Error('server.host 必须为 127.0.0.1');
  if (!Number.isInteger(settings.server.port) || settings.server.port < 1 || settings.server.port > 65535) {
    throw new Error('server.port 必须为 1 到 65535 之间的整数');
  }
  if (typeof settings.server.openAdminOnStart !== 'boolean') throw new Error('openAdminOnStart 必须为布尔值');
  for (const [name, platform] of Object.entries(settings.platforms)) {
    if (typeof platform.roomAddress !== 'string' || platform.roomAddress.length > 256) throw new Error('roomAddress 必须为 256 字以内的房间地址');
    const address = platform.roomAddress.trim();
    if (address && !/^\d{1,30}$/.test(address)) {
      let url;
      try { url = new URL(address); } catch { throw new Error('roomAddress 不是有效的直播间地址'); }
      const hosts = name === 'bilibili' ? ['live.bilibili.com', 'b23.tv'] : ['live.douyin.com', 'v.douyin.com'];
      if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash || !/^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) throw new Error('roomAddress 只能填写对应平台的直播间或分享短链接');
    }
    platform.roomAddress = address;
    if (!['comments', 'announcement'].includes(platform.boardMode)) throw new Error('boardMode 必须为 comments 或 announcement');
    if (typeof platform.snifferEnabled !== 'boolean') throw new Error('snifferEnabled 必须为布尔值');
    if (name === 'bilibili') {
      const collector = platform.collector;
      const providedCollector = input.platforms?.[name]?.collector;
      if (providedCollector !== undefined && (!providedCollector || typeof providedCollector !== 'object' || Array.isArray(providedCollector))) throw new Error('collector 必须为配置对象');
      if (Object.keys(collector).some(key => !['url', 'executable', 'autoStart'].includes(key))) throw new Error('collector 包含未知字段');
      if (typeof collector.autoStart !== 'boolean') throw new Error('collector.autoStart 必须为布尔值');
      if (typeof collector.executable !== 'string' || collector.executable.length > 1024 || collector.executable && (!path.win32.isAbsolute(collector.executable) || !collector.executable.toLowerCase().endsWith('.exe'))) throw new Error('采集程序路径必须为空或完整 exe 路径');
      try {
        if (typeof collector.url !== 'string' || collector.url.length > 256) throw new Error();
        const url = new URL(collector.url);
        if (url.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/ws/data') throw new Error();
      } catch { throw new Error('采集 WebSocket 地址必须为本机 ws://.../ws/data'); }
    }
    if (typeof platform.announcementText !== 'string' || platform.announcementText.length > 2000) throw new Error('announcementText 必须为 2000 字以内的文本');
    if (typeof platform.lyricsEnabled !== 'boolean') throw new Error('lyricsEnabled 必须为布尔值');
    if (typeof platform.lyricsAutoHide !== 'boolean') throw new Error('lyricsAutoHide 必须为布尔值');
    if (typeof platform.benefitsText !== 'string' || platform.benefitsText.length > 500) throw new Error('benefitsText 必须为 500 字以内的文本');
    if (typeof platform.bottomAnnouncementText !== 'string' || platform.bottomAnnouncementText.length > 2501) throw new Error('bottomAnnouncementText 必须为 2501 字以内的文本');
    if (name === 'douyin') {
      platform.snifferEnabled = false;
      delete platform.collector;
      platform.roomAddress = '';
      platform.boardMode = 'announcement';
    }
  }
  for (const adapter of Object.values(settings.adapters)) {
    if (typeof adapter.enabled !== 'boolean') throw new Error('适配器 enabled 必须为布尔值');
  }
  try {
    if (typeof settings.adapters.music.baseUrl !== 'string' || settings.adapters.music.baseUrl.length > 256) throw new Error();
    const url = new URL(settings.adapters.music.baseUrl);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    settings.adapters.music.baseUrl = url.origin;
  } catch { throw new Error('音乐桥接 baseUrl 必须为本机回环 HTTP 地址，且不包含路径、凭证或参数'); }
  for (const field of ['task']) {
    if (typeof settings.global[field] !== 'string' || settings.global[field].length > 500) {
      throw new Error(`global.${field} 必须为 500 字以内的文本`);
    }
  }
  return settings;
}

export async function loadSettings({ initialize = false } = {}) {
  const paths = getPaths();
  const defaults = await readJson(path.join(projectRoot, 'config', 'example.json'));
  const existing = await readJson(paths.settingsFile);
  const settings = validateSettings(existing ?? defaults, defaults);
  if (initialize && existing && (!settings.announcementMovedToBottom || !settings.douyinInteractionRemoved)) {
    if (!settings.announcementMovedToBottom) {
      for (const platform of Object.values(settings.platforms)) {
        const oldText = platform.announcementText;
        if (oldText && oldText !== platform.bottomAnnouncementText) {
          platform.bottomAnnouncementText = [platform.bottomAnnouncementText, oldText].filter(Boolean).join('\n');
        }
      }
      settings.announcementMovedToBottom = true;
    }
    if (!settings.douyinInteractionRemoved) {
      settings.platforms.douyin.roomAddress = '';
      settings.platforms.douyin.boardMode = 'announcement';
      settings.douyinInteractionRemoved = true;
    }
    await saveSettings(settings);
  }
  if (process.env.TAVERN_PORT !== undefined) {
    const requestedPort = process.env.TAVERN_PORT;
    if (!/^\d+$/.test(requestedPort)) throw new Error('TAVERN_PORT 必须为整数');
    settings.server.port = Number(requestedPort);
    validateSettings(settings, defaults);
  }
  if (initialize) {
    await Promise.all([paths.runtimeDir, paths.logsDir, paths.backupsDir].map(directory => mkdir(directory, { recursive: true })));
    if (!existing) await atomicWriteJson(paths.settingsFile, validateSettings(defaults, defaults));
  }
  return settings;
}

async function persistSettings(input) {
  const paths = getPaths();
  const defaults = await readJson(path.join(projectRoot, 'config', 'example.json'));
  const settings = validateSettings(input, defaults);
  await mkdir(paths.backupsDir, { recursive: true });
  try {
    await access(paths.settingsFile, constants.F_OK);
    await copyFile(paths.settingsFile, path.join(paths.backupsDir, `settings-${Date.now()}-${randomUUID()}.json`));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await atomicWriteJson(paths.settingsFile, settings);
  return settings;
}

export function saveSettings(input) {
  const operation = settingsWriteQueue.then(() => persistSettings(input));
  settingsWriteQueue = operation.catch(() => {});
  return operation;
}
