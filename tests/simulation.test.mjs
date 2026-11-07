import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSimulatedMessage, lyricIndexAt } from '../src/simulation.ts';

test('连续同用户同礼物在消息流底部合并，其他事件保持时间顺序', () => {
  const gift = { id: 'gift-1', kind: 'gift', name: '旅人', text: '赠礼', gift: '麦酒', count: 1 };
  const merged = appendSimulatedMessage([gift], { ...gift, id: 'gift-2' });
  assert.equal(merged[0].count, 2);
  assert.equal(merged[0].id, 'gift-1');

  const separate = appendSimulatedMessage([gift], { ...gift, id: 'gift-3', gift: '烛火' });
  assert.equal(separate.length, 2);
  assert.equal(separate[1].id, 'gift-3');
  assert.equal(appendSimulatedMessage([gift], { ...gift, id: 'gift-4', name: '另一位旅人' }).length, 2);
  assert.equal(appendSimulatedMessage([gift, gift, gift, gift], { ...gift, id: 'comment', kind: 'comment' })[4].id, 'comment');
});

test('歌词按八秒切换并循环', () => {
  assert.equal(lyricIndexAt(-1), 0);
  assert.equal(lyricIndexAt(7), 0);
  assert.equal(lyricIndexAt(8), 1);
  assert.equal(lyricIndexAt(32), 0);
});
