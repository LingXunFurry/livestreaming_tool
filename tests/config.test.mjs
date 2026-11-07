import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadSettings, saveSettings, validateSettings } from '../server/config.mjs';
import { createLogger } from '../server/logger.mjs';

test('配置校验、原子写入与备份', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tavern-config-'));
  const previousDataDir = process.env.TAVERN_DATA_DIR;
  process.env.TAVERN_DATA_DIR = directory;
  try {
    const settings = await loadSettings({ initialize: true });
    assert.equal(settings.server.host, '127.0.0.1');
    const legacySettings = JSON.parse(await readFile(path.join(directory, 'settings.json'), 'utf8'));
    delete legacySettings.platforms.bilibili.benefitsText;
    delete legacySettings.platforms.douyin.benefitsText;
    delete legacySettings.global.fontSizes;
    delete legacySettings.platforms.bilibili.fontSizes;
    delete legacySettings.platforms.douyin.fontSizes;
    delete legacySettings.platforms.bilibili.lyricsAutoHide;
    delete legacySettings.platforms.douyin.lyricsAutoHide;
    delete legacySettings.adapters.music.baseUrl;
    await writeFile(path.join(directory, 'settings.json'), JSON.stringify(legacySettings));
    assert.equal((await loadSettings()).platforms.bilibili.benefitsText, '');
    assert.equal((await loadSettings()).platforms.douyin.benefitsText, '');
    assert.equal((await loadSettings()).platforms.douyin.bottomAnnouncementText, '');
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'settings.json'), 'utf8')), legacySettings);
    assert.deepEqual((await loadSettings()).global.fontSizes, { task: 34, bottomLabel: 20 });
    assert.equal((await loadSettings()).platforms.douyin.fontSizes.comments, 20);
    assert.equal((await loadSettings()).platforms.bilibili.lyricsAutoHide, false);
    assert.equal((await loadSettings()).adapters.music.baseUrl, 'http://127.0.0.1:18726');
    for (const baseUrl of ['https://127.0.0.1:18726', 'http://example.com', 'http://127.0.0.1:18726/info', 'http://user:pass@localhost', ['http://localhost'], null]) {
      assert.throws(() => validateSettings({ adapters: { music: { baseUrl } } }, settings), /baseUrl/);
    }
    assert.throws(() => validateSettings({ platforms: { bilibili: { lyricsAutoHide: 'yes' } } }, settings), /lyricsAutoHide/);
    for (const fontSizes of [null, [], { task: '34' }, { task: 57 }, { task: 15 }, { task: 34.5 }, { unknown: 20 }]) {
      assert.throws(() => validateSettings({ global: { fontSizes } }, settings), /fontSizes/);
    }
    assert.throws(() => validateSettings({ platforms: { bilibili: { fontSizes: { task: 20 } } } }, settings), /fontSizes/);
    for (const benefitsText of [null, 42, '福'.repeat(501)]) {
      assert.throws(() => validateSettings({ platforms: { bilibili: { benefitsText } } }, settings), /benefitsText/);
    }
    assert.equal(validateSettings({ platforms: { bilibili: { benefitsText: '专属徽章\n一起开黑' } } }, settings).platforms.bilibili.benefitsText, '专属徽章\n一起开黑');
    for (const bottomAnnouncementText of [null, 42, '告'.repeat(2502)]) {
      assert.throws(() => validateSettings({ platforms: { bilibili: { bottomAnnouncementText } } }, settings), /bottomAnnouncementText/);
    }
    const legacyBenefits = validateSettings({ platforms: { bilibili: { benefitsText: '旧福利' } } }, settings).platforms.bilibili;
    assert.equal(legacyBenefits.benefitsText, '旧福利');
    assert.equal(legacyBenefits.bottomAnnouncementText, '');
    assert.throws(() => validateSettings({ server: { host: '0.0.0.0' } }, settings), /127.0.0.1/);
    assert.throws(() => validateSettings({ server: { port: 70000 } }, settings), /65535/);
    assert.throws(() => validateSettings({ schemaVersion: 2 }, settings), /配置版本/);
    assert.throws(() => validateSettings({ server: 'invalid' }, settings), /JSON 对象/);
    assert.throws(() => validateSettings({ platforms: { bilibili: null } }, settings), /JSON 对象/);
    assert.equal(validateSettings({ global: { title: '不可编辑' } }, settings).global.title, '凌巽的酒馆');
    assert.throws(() => validateSettings({ platforms: { bilibili: { lyricsEnabled: 'yes' } } }, settings), /布尔/);
    await saveSettings({ ...settings, global: { ...settings.global, title: '不可编辑', task: '迁移后的委托' } });
    assert.equal((await loadSettings()).global.title, '凌巽的酒馆');
    assert.equal((await loadSettings()).global.task, '迁移后的委托');
    const backups = await readdir(path.join(directory, 'backups'));
    assert.equal(backups.length, 1);
    assert.equal(JSON.parse(await readFile(path.join(directory, 'backups', backups[0]), 'utf8')).global.title, '凌巽的酒馆');
    const writers = Array.from({ length: 8 }, (_, index) => saveSettings({ ...settings, global: { ...settings.global, title: `酒馆 ${index}`, task: `委托 ${index}` } }));
    await Promise.all(writers);
    assert.match((await loadSettings()).global.task, /^委托 \d$/);
    assert.equal((await loadSettings()).global.title, '凌巽的酒馆');
    assert.equal((await readdir(directory)).filter(name => name.endsWith('.tmp')).length, 0);
  } finally {
    if (previousDataDir === undefined) delete process.env.TAVERN_DATA_DIR;
    else process.env.TAVERN_DATA_DIR = previousDataDir;
    await rm(directory, { recursive: true, force: true });
  }
});

test('旧右栏公告迁移到底部并保留备份，只迁移一次', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tavern-announcement-'));
  const previousDataDir = process.env.TAVERN_DATA_DIR;
  process.env.TAVERN_DATA_DIR = directory;
  try {
    const old = JSON.parse(await readFile(new URL('../config/example.json', import.meta.url), 'utf8'));
    delete old.announcementMovedToBottom;
    old.platforms.bilibili.bottomAnnouncementText = '现有底部公告';
    old.platforms.bilibili.announcementText = '**原公告**';
    old.platforms.douyin.bottomAnnouncementText = '';
    old.platforms.douyin.announcementText = '抖音原公告';
    await writeFile(path.join(directory, 'settings.json'), JSON.stringify(old));
    const migrated = await loadSettings({ initialize: true });
    assert.equal(migrated.platforms.bilibili.bottomAnnouncementText, '现有底部公告\n**原公告**');
    assert.equal(migrated.platforms.douyin.bottomAnnouncementText, '抖音原公告');
    assert.equal(migrated.announcementMovedToBottom, true);
    const backups = await readdir(path.join(directory, 'backups'));
    assert.equal(backups.length, 1);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'backups', backups[0]), 'utf8')), old);
    migrated.platforms.douyin.bottomAnnouncementText = '';
    await saveSettings(migrated);
    assert.equal((await loadSettings({ initialize: true })).platforms.douyin.bottomAnnouncementText, '');
  } finally {
    if (previousDataDir === undefined) delete process.env.TAVERN_DATA_DIR;
    else process.env.TAVERN_DATA_DIR = previousDataDir;
    await rm(directory, { recursive: true, force: true });
  }
});

test('日志轮换和敏感字段过滤', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tavern-logs-'));
  try {
    const log = createLogger(directory, { maxBytes: 500, keep: 3 });
    for (let index = 0; index < 30; index += 1) log('test', { index, cookie: 'private-cookie', nested: { accessToken: 'private-token' } });
    const files = await readdir(directory);
    assert.ok(files.length <= 4);
    for (const file of files) {
      const contents = await readFile(path.join(directory, file), 'utf8');
      assert.ok(Buffer.byteLength(contents) <= 500);
      assert.ok(!contents.includes('private-cookie'));
      assert.ok(!contents.includes('private-token'));
      assert.ok(contents.includes('[REDACTED]'));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
