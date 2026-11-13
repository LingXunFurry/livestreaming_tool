import test from 'node:test';
import assert from 'node:assert/strict';
import { createInteractionStore, normalizeSnifferEvent } from '../server/interactions.mjs';

test('采集器事件规范化、平台隔离、去重和有界保留', () => {
  const store = createInteractionStore('bilibili');
  const comment = {type: 'danmaku', data: {id: 'first', type: '弹幕', user: '测试旅人', msg: '<b>文字</b>'}};
  assert.equal(store.receive(comment), true);
  assert.equal(store.receive(comment), false);
  assert.equal(store.snapshot().messages[0].text, '<b>文字</b>');
  assert.equal(store.receive({...comment, platform: 'douyin'}), false);
  assert.equal(store.receive({type: 'log', data: {msg: '系统日志'}}), false);
  assert.equal(store.receive({type: 'unknown', user: '用户', msg: '不支持'}), false);
  assert.equal(store.receive({type: '点赞', user: '旅人', msg: '点赞了'}), false);
  assert.equal(normalizeSnifferEvent({type: 'like', user: '旅人', msg: 'liked'}, 'bilibili'), null);
  assert.equal(store.receive({type: '弹幕', user: {}, msg: '坏数据'}), false);
  assert.equal(normalizeSnifferEvent({type: '礼物', user: '旅人', msg: {gift_name: '小花花', gift_count: 3}}, 'bilibili').data.count, 3);
  assert.equal(normalizeSnifferEvent({type: '醒目留言', user: '旅人', msg: {content: '一路顺风', price: 30}}, 'bilibili').data.detail, '¥30');
  assert.equal(normalizeSnifferEvent({type: '舰长', user: '旅人', msg: '加入大航海'}, 'bilibili').data.kind, 'captain');
  assert.equal(store.receive({type: 'room_info', platform: 'bilibili', data: {online_count: 100, like_count: 200}}), true);
  assert.deepEqual(store.snapshot().room, {onlineCount: 100, likeCount: 200});
  store.receive({user: '系统', type: '房间信息', msg: {gift_name: '在线:None 点赞:200', gift_count: ''}});
  assert.deepEqual(store.snapshot().room, {onlineCount: null, likeCount: 200});
  for (let index = 0; index < 120; index += 1) store.receive({type: '弹幕', id: String(index), user: '旅人', msg: '消息'});
  assert.equal(store.snapshot().messages.length, 100);
  assert.equal(store.snapshot().eventCount, 121);
  const restored = createInteractionStore('bilibili', JSON.parse(JSON.stringify(store.snapshot())));
  assert.equal(restored.snapshot().messages.length, 100);
  assert.equal(restored.receive({type: '弹幕', id: '119', user: '旅人', msg: '消息'}), false);
  assert.equal(createInteractionStore('douyin', store.snapshot()).snapshot().messages.length, 0);
  store.clear();
  assert.equal(store.snapshot().messages.length, 0);
});

test('过滤无 ID 的重复弹幕和单条表情，保留带 ID 的重复发言与连送礼物', () => {
  const store = createInteractionStore('bilibili');
  const first = {type: '弹幕', user: '旅人一', msg: '晚上好'};
  const second = {type: '弹幕', user: '旅人二', msg: '欢迎光临'};
  const gift = {type: '礼物', user: '送礼旅人', msg: {gift_name: '灯牌', gift_count: 1}};
  for (const event of [first, second, gift]) store.receive(event);
  for (let index = 0; index < 10; index += 1) {
    store.receive(first);
    store.receive(second);
  }
  assert.equal(store.snapshot().messages.length, 3);
  assert.equal(store.snapshot().messages.at(-1).kind, 'gift');
  assert.equal(store.snapshot().suppressedReplays, 20);
  store.receive(gift);
  assert.equal(store.snapshot().messages.length, 4);
  store.receive(first);
  assert.equal(store.snapshot().messages.length, 4);
  const heart = {type: '弹幕', user: '旅人', msg: '[比心][比心][比心]'};
  for (let index = 0; index < 20; index += 1) store.receive(heart);
  assert.equal(store.snapshot().messages.length, 5);
  const restored = createInteractionStore('bilibili', JSON.parse(JSON.stringify(store.snapshot())));
  restored.receive(first);
  restored.receive(second);
  assert.equal(restored.snapshot().messages.length, 5);
  store.receive({...first, id: 'distinct-event-1'});
  store.receive({...first, id: 'distinct-event-2'});
  assert.equal(store.snapshot().messages.length, 7);
});

test('普通弹幕的滑动去重窗口到期后可再次显示', context => {
  let now = 100000;
  context.mock.method(Date, 'now', () => now);
  const store = createInteractionStore('bilibili');
  const heart = {type: '弹幕', user: '旅人', msg: '[比心]'};
  assert.equal(store.receive(heart), true);
  now += 30000;
  assert.equal(store.receive(heart), false);
  now += 31000;
  assert.equal(store.receive(heart), false);
  now += 61000;
  assert.equal(store.receive(heart), true);
});
