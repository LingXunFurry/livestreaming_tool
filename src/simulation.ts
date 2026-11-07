export type Platform = 'bilibili' | 'douyin'
export type MessageKind = 'comment' | 'gift' | 'captain' | 'sc' | 'follow'

export type SimulatedMessage = {
  id: string
  kind: MessageKind
  name: string
  text: string
  gift?: string
  count?: number
  detail?: string
}

export const messageLabels: Record<MessageKind, string> = {
  comment: '弹幕',
  gift: '礼物',
  captain: '舰长',
  sc: 'SC',
  follow: '关注',
}

export const initialMessages: Record<Platform, SimulatedMessage[]> = {
  bilibili: [
    { id: 'b-comment', kind: 'comment', name: '路过的冒险者', text: '晚上好，今天也来酒馆坐坐。' },
    { id: 'b-gift', kind: 'gift', name: '森林来信', text: '送来了一份星光麦酒。', gift: '星光麦酒', count: 1 },
    { id: 'b-captain', kind: 'captain', name: '远航的朋友', text: '加入了这次旅途。' },
    { id: 'b-sc', kind: 'sc', name: '山间的风', text: '愿下一段冒险，也有好风景。', detail: '¥30' },
  ],
  douyin: [
    { id: 'd-comment', kind: 'comment', name: '抖音的旅人', text: '从抖音过来，来酒馆歇歇脚。' },
    { id: 'd-gift', kind: 'gift', name: '夜航来客', text: '送来了一份晚风礼物。', gift: '晚风礼物', count: 1 },
    { id: 'd-follow', kind: 'follow', name: '新来的朋友', text: '关注了这间酒馆。' },
    { id: 'd-comment-2', kind: 'comment', name: '晚风同行', text: '下一段冒险，也一起出发吧。' },
  ],
}

export const eventTimeline: Record<Platform, Omit<SimulatedMessage, 'id'>[]> = {
  bilibili: [
    { kind: 'comment', name: '林间旅人', text: '这首歌很适合酒馆夜晚。' },
    { kind: 'gift', name: '夜航来客', text: '送出星光麦酒。', gift: '星光麦酒', count: 1 },
    { kind: 'gift', name: '夜航来客', text: '送出星光麦酒。', gift: '星光麦酒', count: 1 },
    { kind: 'captain', name: '风铃旅人', text: '加入了这次旅途。' },
    { kind: 'sc', name: '晚风同行', text: '愿这段旋律陪你走远一点。', detail: '¥50' },
  ],
  douyin: [
    { kind: 'comment', name: '抖音旅人', text: '今晚的酒馆很热闹。' },
    { kind: 'gift', name: '晚风同行', text: '送出一份晚风礼物。', gift: '晚风礼物', count: 1 },
    { kind: 'gift', name: '晚风同行', text: '送出一份晚风礼物。', gift: '晚风礼物', count: 1 },
    { kind: 'follow', name: '新来的朋友', text: '关注了这间酒馆。' },
  ],
}

export const lyricLines = [
  '把今天的故事，留在这里',
  '让晚风吹过旅人的梦',
  '下一段旅程，慢慢开启',
  '星光会记得归来的路',
]

export function appendSimulatedMessage(messages: SimulatedMessage[], incoming: SimulatedMessage) {
  const latest = messages[messages.length - 1]
  if (incoming.kind === 'gift' && latest?.kind === 'gift' && latest.name === incoming.name && latest.gift === incoming.gift) {
    return [...messages.slice(0, -1), { ...latest, count: (latest.count ?? 1) + (incoming.count ?? 1) }]
  }
  // shortcut: keep the latest 20 events in the local simulation; replace with adapter-side retention for real streams.
  return [...messages, incoming].slice(-20)
}

export function lyricIndexAt(elapsedSeconds: number) {
  return Math.floor(Math.max(0, elapsedSeconds) / 8) % lyricLines.length
}
