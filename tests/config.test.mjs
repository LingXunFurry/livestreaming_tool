import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
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
    assert.throws(() => validateSettings({ server: { host: '0.0.0.0' } }, settings), /127.0.0.1/);
    assert.throws(() => validateSettings({ server: { port: 70000 } }, settings), /65535/);
    assert.throws(() => validateSettings({ schemaVersion: 2 }, settings), /配置版本/);
    assert.throws(() => validateSettings({ server: 'invalid' }, settings), /JSON 对象/);
    assert.throws(() => validateSettings({ platforms: { bilibili: null } }, settings), /JSON 对象/);
    assert.throws(() => validateSettings({ platforms: { bilibili: { lyricsEnabled: 'yes' } } }, settings), /布尔/);
    await saveSettings({ ...settings, global: { ...settings.global, title: '迁移后的酒馆' } });
    assert.equal((await loadSettings()).global.title, '迁移后的酒馆');
    const backups = await readdir(path.join(directory, 'backups'));
    assert.equal(backups.length, 1);
    assert.equal(JSON.parse(await readFile(path.join(directory, 'backups', backups[0]), 'utf8')).global.title, '凌巽的酒馆');
    const writers = Array.from({ length: 8 }, (_, index) => saveSettings({ ...settings, global: { ...settings.global, title: `酒馆 ${index}` } }));
    await Promise.all(writers);
    assert.match((await loadSettings()).global.title, /^酒馆 \d$/);
    assert.equal((await readdir(directory)).filter(name => name.endsWith('.tmp')).length, 0);
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
