import { randomUUID } from 'node:crypto';

const kinds = new Map([
  ['弹幕', 'comment'], ['danmaku', 'comment'], ['comment', 'comment'],
  ['礼物', 'gift'], ['gift', 'gift'],
  ['舰长', 'captain'], ['提督', 'captain'], ['总督', 'captain'], ['大航海', 'captain'], ['captain', 'captain'],
  ['醒目留言', 'sc'], ['SC', 'sc'], ['sc', 'sc'],
  ['关注', 'follow'], ['follow', 'follow'],
  ['进房', 'enter'], ['enter_room', 'enter'],
  ['会员', 'member'], ['粉丝团', 'member'],
]);

const plainText = (value, limit = 2000) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const fingerprint = message => JSON.stringify([message.kind, message.name, message.text, message.gift, message.count, message.detail]);

function createReplayFilter(platform) {
  const recent = new Map();
  let suppressed = 0;
  return {
    isDuplicate(message, now = Date.now()) {
      if (message.id.startsWith(`${platform}-`) || ['gift', 'captain', 'sc'].includes(message.kind)) return false;
      const key = fingerprint(message);
      const previous = recent.get(key);
      recent.delete(key);
      recent.set(key, now);
      if (recent.size > 1000) recent.delete(recent.keys().next().value);
      const duplicate = previous !== undefined && now >= previous && now - previous < 60000;
      if (duplicate) suppressed += 1;
      return duplicate;
    },
    suppressed: () => suppressed,
    clear: () => {recent.clear(); suppressed = 0;},
  };
}

export function normalizeSnifferEvent(payload, platform) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const data = payload.type === 'danmaku' && payload.data ? payload.data : payload;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if ((payload.platform && payload.platform !== platform) || (data.platform && data.platform !== platform)) return null;
  const eventType = data.type;
  if (eventType === '房间信息' || eventType === 'room_info' || eventType === 'room_stats') {
    const stats = data.data || data;
    const summary = plainText(data.msg?.gift_name).match(/^在线:(\d+|None)\s+点赞:(\d+|None)$/);
    if (summary) return {type: 'stats', data: {onlineCount: summary[1] === 'None' ? null : Number(summary[1]), likeCount: summary[2] === 'None' ? null : Number(summary[2])}};
    const metric = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
    return {type: 'stats', data: {onlineCount: metric(stats.online_count), likeCount: metric(stats.like_count)}};
  }
  const kind = kinds.get(eventType);
  const name = plainText(data.user, 100);
  if (!kind || !name) return null;
  const content = data.msg;
  let text = plainText(content) || plainText(content?.content) || plainText(content?.gift_name);
  let gift;
  let count;
  let detail;
  if (kind === 'gift' && content && typeof content === 'object') {
    gift = plainText(content.gift_name, 100);
    const quantity = Number(content.gift_count);
    count = Number.isSafeInteger(quantity) && quantity > 0 ? Math.min(quantity, 1000000) : 1;
    if (!gift) return null;
    text = `送出 ${gift}`;
  } else if (kind === 'gift') {
    gift = text;
    count = 1;
  } else if (kind === 'sc' && content && typeof content === 'object') {
    text = plainText(content.content);
    const price = Number(content.price);
    if (Number.isFinite(price) && price >= 0) detail = `¥${price}`;
  }
  if (!text) return null;
  const sourceId = plainText(String(data.id ?? data.msg_id ?? ''), 160);
  return {type: 'message', data: {
    id: sourceId ? `${platform}-${sourceId}` : randomUUID(), platform, kind, name, text,
    receivedAt: Date.now(),
    ...(gift ? {gift, count} : {}), ...(detail ? {detail} : {}),
  }};
}

export function createInteractionStore(platform, saved = {}) {
  const replay = createReplayFilter(platform);
  const knownKinds = new Set(kinds.values());
  const storedMessages = Array.isArray(saved.messages) ? saved.messages : [];
  let messages = storedMessages.filter(message => message && message.platform === platform
    && typeof message.id === 'string' && message.id.length > 0 && message.id.length <= 200
    && knownKinds.has(message.kind) && plainText(message.name, 100) === message.name
    && plainText(message.text) === message.text && message.name && message.text
    && (message.gift === undefined || typeof message.gift === 'string' && message.gift.length <= 100)
    && (message.detail === undefined || typeof message.detail === 'string' && message.detail.length <= 100)
    && (message.count === undefined || Number.isInteger(message.count) && message.count > 0 && message.count <= 1000000)
  ).slice(-100).map(({id, platform, kind, name, text, gift, count, detail, receivedAt}) => ({id, platform, kind, name, text, gift, count, detail, receivedAt: Number.isSafeInteger(receivedAt) ? receivedAt : 0}))
    .filter(message => !replay.isDuplicate(message, message.receivedAt));
  const seen = new Set(messages.map(message => message.id));
  let eventCount = messages.length;
  let lastEventAt = null;
  let lastPacketAt = null;
  let room = null;
  return {
    receive(payload) {
      const event = normalizeSnifferEvent(payload, platform);
      if (!event) return false;
      lastPacketAt = new Date().toISOString();
      if (event.type === 'stats') { room = event.data; return true; }
      if (seen.has(event.data.id)) return false;
      if (replay.isDuplicate(event.data)) return false;
      seen.add(event.data.id);
      if (seen.size > 1000) seen.delete(seen.values().next().value);
      messages = [...messages, event.data].slice(-100);
      eventCount += 1;
      lastEventAt = new Date().toISOString();
      return true;
    },
    snapshot() { return {platform, messages, eventCount, lastEventAt, lastPacketAt, room, suppressedReplays: replay.suppressed()}; },
    disconnect() { lastPacketAt = null; },
    clear() { replay.clear(); seen.clear(); messages = []; eventCount = 0; lastEventAt = null; lastPacketAt = null; room = null; },
  };
}
